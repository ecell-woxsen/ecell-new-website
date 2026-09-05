import { getAssetUrl } from "./assets";

let cachedUrls: Record<string, string> | null = null;
let pendingPromise: Promise<Record<string, string>> | null = null;

/**
 * Downloads and unpacks all event images from a single binary pack (events_pack.bin).
 * Returns a dictionary mapping relative event paths (e.g. "/events/hult.png")
 * to in-memory Blob Object URLs for instant, zero-latency rendering.
 */
export function loadEventsPack(): Promise<Record<string, string>> {
  if (cachedUrls) {
    return Promise.resolve(cachedUrls);
  }

  if (pendingPromise) {
    return pendingPromise;
  }

  // _v2: re-encoded WebP (<=1024px) — versioned filename busts the
  // immutable browser/edge CDN caches.
  const packUrl = getAssetUrl("/ecell_packs/events_pack_v2.bin");

  pendingPromise = fetch(packUrl, { cache: "force-cache" })
    .then((res) => {
      if (!res.ok) {
        throw new Error(`Failed to fetch events pack: HTTP ${res.status}`);
      }
      return res.arrayBuffer();
    })
    .then((buffer) => {
      const view = new DataView(buffer);
      const headerLen = view.getUint32(0, true);
      const headerBytes = new Uint8Array(buffer, 4, headerLen);
      const headerText = new TextDecoder().decode(headerBytes);
      const manifest: { id: string; path: string; mime: string; len: number }[] = JSON.parse(headerText);

      const urls: Record<string, string> = {};
      let offset = 4 + headerLen;

      for (const item of manifest) {
        const payloadSlice = buffer.slice(offset, offset + item.len);
        const blob = new Blob([payloadSlice], { type: item.mime });
        urls[item.path] = URL.createObjectURL(blob);
        offset += item.len;
      }

      cachedUrls = urls;
      return urls;
    })
    .catch((err) => {
      console.warn("Could not load events_pack.bin, falling back to direct asset URLs:", err);
      return {};
    })
    .finally(() => {
      pendingPromise = null;
    });

  return pendingPromise;
}

/**
 * Synchronously returns the loaded Blob URL for an event path if already unpacked.
 */
export function getCachedEventUrl(path: string): string | null {
  return cachedUrls?.[path] || null;
}
