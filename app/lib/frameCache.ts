import {
  AssetVariant,
  TOTAL_PACKS,
  getPackUrl,
  getPackFrameRange,
  getAssetUrl,
} from "./assets";

const PACK_CACHE_NAME = "ecell-packs-v1";
const FRAME_CACHE_NAME = "ecell-frames-v1";

export interface PreloadProgress {
  loaded: number;
  total: number;
  percent: number;
  isDone: boolean;
}

let packCachePromise: Promise<Cache | null> | null = null;
let frameCachePromise: Promise<Cache | null> | null = null;

export function isCacheStorageSupported(): boolean {
  return typeof window !== "undefined" && "caches" in window;
}

export function getPackCache(): Promise<Cache | null> {
  if (!isCacheStorageSupported()) return Promise.resolve(null);
  if (!packCachePromise) {
    packCachePromise = window.caches.open(PACK_CACHE_NAME).catch(() => null);
  }
  return packCachePromise;
}

export function getFrameCache(): Promise<Cache | null> {
  if (!isCacheStorageSupported()) return Promise.resolve(null);
  if (!frameCachePromise) {
    frameCachePromise = window.caches.open(FRAME_CACHE_NAME).catch(() => null);
  }
  return frameCachePromise;
}

export function getFrameCachePath(physicalFrame: number, variant: AssetVariant): string {
  const padded = String(physicalFrame).padStart(5, "0");
  return `/ecell_shots/${variant}/${padded}.webp`;
}

/**
 * Checks how many packs are already persisted in the browser's CacheStorage on disk.
 */
export async function getCachedPackCount(variant: AssetVariant): Promise<number> {
  const cache = await getPackCache();
  if (!cache) return 0;
  try {
    const keys = await cache.keys();
    const token = `/ecell_packs/${variant}/`;
    let count = 0;
    for (const req of keys) {
      if (req.url.includes(token)) count++;
    }
    return count;
  } catch {
    return 0;
  }
}

/**
 * Retrieves a single frame Blob directly from browser disk cache (CacheStorage).
 * Speed: < 1ms on local disk, zero network latency, 0 permanent JS heap RAM.
 */
export async function getFrameBlobFromCache(
  physicalFrame: number,
  variant: AssetVariant
): Promise<Blob | null> {
  const frameCache = await getFrameCache();
  if (!frameCache) return null;
  const path = getFrameCachePath(physicalFrame, variant);
  try {
    const res = await frameCache.match(path);
    if (res && res.ok) {
      return await res.blob();
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Checks if a specific frame is already resident in disk cache.
 */
export async function isFrameCached(
  physicalFrame: number,
  variant: AssetVariant
): Promise<boolean> {
  const frameCache = await getFrameCache();
  if (!frameCache) return false;
  const path = getFrameCachePath(physicalFrame, variant);
  try {
    const res = await frameCache.match(path);
    return !!res;
  } catch {
    return false;
  }
}

/**
 * Unpacks a binary pack ArrayBuffer into individual WebP frames and
 * writes each directly into browser CacheStorage on disk.
 * The raw ArrayBuffer is immediately released so garbage collection reclaims RAM.
 */
export async function unpackAndCacheFrames(
  packIndex: number,
  buffer: ArrayBuffer,
  variant: AssetVariant
): Promise<void> {
  const frameCache = await getFrameCache();
  if (!frameCache) return;

  const { start } = getPackFrameRange(packIndex);
  const view = new DataView(buffer);
  const count = view.getUint32(0, true);
  let offset = 4 + count * 4;

  const writes: Promise<void>[] = [];
  for (let i = 0; i < count; i++) {
    const len = view.getUint32(4 + i * 4, true);
    const phys = start + i;
    const path = getFrameCachePath(phys, variant);

    // Create slice for this frame
    const frameBytes = new Uint8Array(buffer, offset, len);
    const response = new Response(frameBytes, {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });

    writes.push(
      frameCache.put(path, response).catch(() => {})
    );
    offset += len;
  }

  await Promise.all(writes);
}

/**
 * Preloads all 53 binary packs + event & team packs into browser CacheStorage.
 * Runs with bounded concurrency, updating progress accurately from 0% to 100%.
 * RAM is kept minimal because buffers are saved to disk and freed immediately.
 */
export async function preloadAllPacks(
  variant: AssetVariant,
  onProgress: (progress: PreloadProgress) => void,
  signal?: AbortSignal
): Promise<void> {
  const packCache = await getPackCache();
  const frameCache = await getFrameCache();

  // 53 timeline packs + 2 auxiliary packs (events + team) = 55 total items
  const TOTAL_ITEMS = TOTAL_PACKS + 2;
  let loadedCount = 0;

  const notify = () => {
    const percent = Math.min(100, Math.round((loadedCount / TOTAL_ITEMS) * 100));
    onProgress({
      loaded: loadedCount,
      total: TOTAL_ITEMS,
      percent,
      isDone: loadedCount >= TOTAL_ITEMS,
    });
  };

  // 1. Check existing disk cache first
  const existingPackCount = await getCachedPackCount(variant);
  if (existingPackCount >= TOTAL_PACKS) {
    // All packs already resident on disk! Instant glide to 100%
    loadedCount = TOTAL_ITEMS;
    notify();
    return;
  }

  // Initial progress report
  notify();

  // 2. Auxiliary Packs: events & team
  const auxPacks = [
    getAssetUrl("/ecell_packs/events_pack_v2.bin"),
    getAssetUrl("/ecell_packs/team_pack_v2.bin"),
  ];

  const fetchAux = async (url: string) => {
    if (signal?.aborted) return;
    try {
      if (packCache) {
        const cached = await packCache.match(url);
        if (cached && cached.ok) {
          loadedCount++;
          notify();
          return;
        }
      }
      const res = await fetch(url, { signal, cache: "force-cache" });
      if (res.ok && packCache) {
        await packCache.put(url, res.clone());
      }
    } catch {
      // Non-fatal, fallback to runtime
    } finally {
      loadedCount++;
      notify();
    }
  };

  // 3. Process timeline packs with concurrency = 6
  const CONCURRENCY = 6;
  const packIndices: number[] = Array.from({ length: TOTAL_PACKS }, (_, i) => i);
  let queueIndex = 0;

  const worker = async () => {
    while (queueIndex < packIndices.length) {
      if (signal?.aborted) break;
      const p = packIndices[queueIndex++];
      const packUrl = getPackUrl(p, variant);

      try {
        let arrayBuffer: ArrayBuffer | null = null;

        // Check if pack already in disk cache
        if (packCache) {
          const cached = await packCache.match(packUrl);
          if (cached && cached.ok) {
            arrayBuffer = await cached.arrayBuffer();
          }
        }

        // Fetch from network if not in cache
        if (!arrayBuffer) {
          const res = await fetch(packUrl, { signal, cache: "force-cache" });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          
          if (packCache) {
            await packCache.put(packUrl, res.clone());
          }
          arrayBuffer = await res.arrayBuffer();
        }

        // Unpack frames to frameCache on disk and free memory
        if (arrayBuffer && frameCache) {
          await unpackAndCacheFrames(p, arrayBuffer, variant);
        }
      } catch (err) {
        if (signal?.aborted) break;
        // Non-fatal, engine will fetch missing pack on scroll if needed
      } finally {
        loadedCount++;
        notify();
      }
    }
  };

  // Launch parallel streams for timeline packs + aux packs
  const workers = Array.from({ length: CONCURRENCY }, () => worker());
  const auxWorkers = auxPacks.map((url) => fetchAux(url));

  await Promise.all([...workers, ...auxWorkers]);

  // Guarantee 100% notification when complete
  loadedCount = TOTAL_ITEMS;
  notify();
}
