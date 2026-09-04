"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import Lenis from "lenis";
import PreloadManager from "./PreloadManager";
import HeroOverlay from "./overlays/HeroOverlay";
import DoorAboutOverlay from "./overlays/DoorAboutOverlay";
import WallGalleryOverlay from "./overlays/WallGalleryOverlay";
import {
  getAssetUrl,
  getFrameUrl,
  getPhysicalFrameNumber,
  TOTAL_PHYSICAL_FRAMES,
  TOTAL_PACKS,
  getPackIndex,
  getPackFrameRange,
  getPackUrl,
  type AssetVariant,
} from "../lib/assets";
import { loadEventsPack } from "../lib/eventsPack";
import { loadTeamPack } from "../lib/teamPack";

interface ScrollytellingEngineProps {
  onFrameUpdate?: (frame: number) => void;
  onOpenJoinModal: () => void;
  targetNavigationFrame?: number | null;
  onNavigationComplete?: () => void;
  isJoinModalOpen?: boolean;
}

const TOTAL_FRAMES = 1262; // Virtual timeline length (scroll track, events, team & contact overlays)
const SCROLL_TRACK_HEIGHT = TOTAL_FRAMES * 12; // 15,144px scroll track for 1:1 frame pacing

// ---------------------------------------------------------------------------
// LOADING PIPELINE TUNING
// ---------------------------------------------------------------------------
// Hero video covers frames 1-15, so the boot corridor only needs ~14 contiguous
// frames before reveal (was 24 — the video hid most of them).
const CRITICAL_PRELOAD_COUNT = 14;
const BOOT_TIMEOUT_MS = 2500;

// Unified concurrency budget. On the R2 worker CDN (HTTP/2) 8 parallel streams
// is comfortable; on an HTTP/1.1 fallback origin the browser queues these on
// 6 connections without breaking anything.
const MAX_URGENT_CONCURRENT = 8;
const MAX_IDLE_CONCURRENT = 2; // idle streamer runs only when zero urgent requests exist
const MAX_URGENT_PACK_CONCURRENT = 3;
const MAX_IDLE_PACK_CONCURRENT = 1;


// Coarse-first corridor: fetch stride anchors (t, +/-4, +/-8, +/-16, +/-32)
// before filling the gaps, so a cold fling or nav jump always lands within
// <=4 frames of a loaded anchor while the dense corridor catches up.
const STRIDE_ANCHORS = [0, 4, 8, 16, 32] as const;
const LOOKAHEAD_FORWARD = 32;
const LOOKAHEAD_BACKWARD = 12;
const PREFETCH_ABORT_DISTANCE = 40; // abort in-flight requests this far from the playhead

// Decode pipeline: decode-ahead window aligned with the fetch corridor (the old
// decode window [t-3, t+10] was far smaller than the fetch window, so frames
// arrived downloaded-but-undecoded and triggered micro-stutter), with a hard
// concurrency cap to prevent decode storms during post-warm flings.
const DECODE_BACK = 4;
const DECODE_FORWARD = 16;
const MAX_CONCURRENT_DECODES = 4;

// Bitmap keep window (pruned every scheduler tick)
const KEEP_BACK = 8;
const KEEP_FORWARD = 24;

// Failed-frame retry with exponential backoff (previously failures left
// permanent holes that were re-fetched on every corridor pass).
const RETRY_LIMIT = 3;
const RETRY_BASE_DELAY_MS = 400;

// Failure isolation (defense in depth — whatever the CDN does):
//  - a frame that exhausts its retries is blocked with an escalating cooldown,
//    so a single bad frame can never loop the pipeline again
//  - a blob whose decode repeatedly fails is blocked (kills the infinite
//    JIT re-decode loop on corrupt bytes)
//  - many distinct-key failures in a row pause the whole endpoint with
//    doubling backoff instead of a fetch storm
const FETCH_FAILURE_COOLDOWN_MS = 30_000;
const FETCH_FAILURE_COOLDOWN_MAX_MS = 120_000;
const DECODE_FAILURE_LIMIT = 2;
const DECODE_FAILURE_COOLDOWN_MS = 60_000;
const ENDPOINT_FAILURE_THRESHOLD = 15;
const ENDPOINT_BACKOFF_MIN_MS = 5_000;
const ENDPOINT_BACKOFF_MAX_MS = 60_000;

const VARIANT_SWITCH_DEBOUNCE_MS = 300;
const RESIZE_DEBOUNCE_MS = 150;

const resolveDeviceVariant = (): AssetVariant => {
  if (typeof window === "undefined") return "1080p";
  if (window.innerWidth < 768) return "mobile_720p";
  if (window.innerWidth < 1024) return "720p";
  return "1080p";
};

// Image asset type: ImageBitmap (decoded off-main-thread) or HTMLImageElement fallback
type FrameAsset = ImageBitmap | HTMLImageElement;

const physOfKey = (key: string): number => parseInt(key.slice(key.indexOf(":") + 1), 10);
const closeAsset = (asset: FrameAsset) => {
  if ("close" in asset && typeof asset.close === "function") asset.close();
};

// ---------------------------------------------------------------------------
// KPI TELEMETRY (inspect via window.__frameStats; add ?debug to the URL for
// console output every 5s). staleDraws is the smoothness KPI: draws where the
// drawn frame is more than 2 frames away from the scroll target.
// ---------------------------------------------------------------------------
const stats = {
  drawn: 0,
  staleDraws: 0,
  netRequests: 0,
  packRequests: 0,
  dedupedHits: 0,
  netErrors: 0,
  fetchFailures: 0,
  decodeFailures: 0,
  endpointPauses: 0,
  decodes: 0,
  decodeDrops: 0,
};
if (typeof window !== "undefined") {
  (window as unknown as { __frameStats?: typeof stats }).__frameStats = stats;
}

// Safe cross-browser idle callback helper (with iOS/Safari fallback)
type IdleHandle = number;
const requestIdle: (cb: () => void) => IdleHandle =
  typeof window !== "undefined" && "requestIdleCallback" in window
    ? (cb) =>
        (window as Window & { requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback(
          cb,
          { timeout: 1000 }
        )
    : (cb) => setTimeout(cb, 60) as unknown as IdleHandle;

const cancelIdle: (id: IdleHandle) => void =
  typeof window !== "undefined" && "cancelIdleCallback" in window
    ? (id) =>
        (window as Window & { cancelIdleCallback: (id: number) => void }).cancelIdleCallback(id)
    : (id) => clearTimeout(id as unknown as ReturnType<typeof setTimeout>);

// Native off-thread bitmap decoder (no slow software resampler on the main thread)
const decodeViaImageElement = (blob: Blob): Promise<FrameAsset | null> =>
  new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    const objectUrl = URL.createObjectURL(blob);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(null);
    };
    img.src = objectUrl;
  });

const decodeAsset = (blob: Blob): Promise<FrameAsset | null> => {
  if (typeof window !== "undefined" && "createImageBitmap" in window) {
    return createImageBitmap(blob).catch(() => decodeViaImageElement(blob));
  }
  return decodeViaImageElement(blob);
};

function ScrollytellingEngine({
  onFrameUpdate,
  onOpenJoinModal,
  targetNavigationFrame,
  onNavigationComplete,
  isJoinModalOpen = false,
}: ScrollytellingEngineProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const videoWrapperRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lenisRef = useRef<Lenis | null>(null);

  // =========================================================================
  // UNIFIED TWO-TIER CACHE (variant-scoped keys: "<variant>:<physicalFrame>")
  // =========================================================================
  // Tier 1: compressed blobs (all 840 physical frames eventually, via the idle
  // streamer). Keys are variant-scoped so a 1024px breakpoint crossing can
  // invalidate cleanly instead of silently mixing 720p/1080p playback.
  const blobCacheRef = useRef<Map<string, Blob>>(new Map());

  // Tier 2: decoded GPU bitmaps, strictly pruned to [playhead-8, playhead+24].
  const bitmapCacheRef = useRef<Map<string, FrameAsset>>(new Map());

  // Unified in-flight registry — ONE place tracks every network request
  // (boot, urgent corridor and idle streamer all share it). Fixes the old
  // boot double-fetch bug (boot requests were invisible to the scheduler)
  // and the in-flight counter double-decrement drift.
  const inflightRef = useRef<Map<string, { controller: AbortController; priority: "urgent" | "idle"; physical: number }>>(new Map());
  const urgentCountRef = useRef(0);
  const idleCountRef = useRef(0);
  const unmountedRef = useRef(false);

  // Failure isolation state
  const blockedKeysRef = useRef<Map<string, { until: number; count: number }>>(new Map());
  const badDecodeRef = useRef<Map<string, number>>(new Map());
  const endpointGuardRef = useRef({ pausedUntil: 0, backoffMs: ENDPOINT_BACKOFF_MIN_MS, consecutive: 0 });

  // Decode pipeline state (bounded concurrency + FIFO queue with jump slots)
  const decodeInflightRef = useRef<Set<string>>(new Set());
  const decodeQueueRef = useRef<string[]>([]);
  const decodeQueuedRef = useRef<Set<string>>(new Set());

  // Scheduling handles
  const idleHandleRef = useRef<IdleHandle | null>(null);
  const lastScheduledIntegerRef = useRef<number>(-1);
  const scheduleRef = useRef<((center: number, velocity: number) => void) | null>(null);
  const scheduleIdleStreamRef = useRef<() => void>(() => {});

  // React state for boot & overlays
  const [loadProgress, setLoadProgress] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [currentFrame, setCurrentFrame] = useState(1);

  // Rendering & window dimension refs
  const currentFrameRef = useRef(1);
  const lastTimeRef = useRef(0); // set on the first RAF tick (pure init)
  const lastReportedFrameRef = useRef<number>(1);
  const maxGalleryWidthRef = useRef(3200);
  const windowWidthRef = useRef(typeof window !== "undefined" ? window.innerWidth : 1920);
  const windowHeightRef = useRef(typeof window !== "undefined" ? window.innerHeight : 1080);
  const scrollVelocityRef = useRef(0);
  const maxScrollRef = useRef(1);

  // Redraw/skip guards
  const lastDrawnFrameRef = useRef<number>(-1);
  const lastDrawnWidthRef = useRef<number>(0);
  const lastDrawnHeightRef = useRef<number>(0);

  // Change-gated style write cache (skip identical setProperty calls per frame)
  const lastCssRef = useRef<Record<string, string>>({});
  const videoPermanentlyStoppedRef = useRef(false);

  // Pack batching state (Track B)
  const noPacksRef = useRef(false);
  const packInflightRef = useRef<
    Map<string, { controller: AbortController; priority: "urgent" | "idle"; packIndex: number }>
  >(new Map());
  const urgentPackCountRef = useRef(0);
  const idlePackCountRef = useRef(0);
  const blockedPacksRef = useRef<Map<string, { until: number; count: number }>>(new Map());

  // Check ?nopacks A/B testing flag
  useEffect(() => {
    if (typeof window !== "undefined") {
      noPacksRef.current = new URLSearchParams(window.location.search).has("nopacks");
    }
  }, []);

  // Adaptive Resolution: "mobile_720p" (<768px), "720p" tablet (768-1023px), "1080p" desktop (>=1024px)
  const assetVariantRef = useRef<AssetVariant>(resolveDeviceVariant());

  // Sync video poster to client-detected resolution without triggering cascading renders or hydration mismatch
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.poster = getFrameUrl(1, resolveDeviceVariant());
    }
  }, []);

  // =========================================================================
  // UNIFIED FRAME LOADER
  // =========================================================================
  // Single entry point for every frame network request:
  //  - dedupes against blob cache AND in-flight requests (fixes boot double-fetch)
  //  - upgrades idle requests to urgent when the playhead needs them
  //  - preempts far-away in-flight requests when urgent slots are exhausted
  //  - retries transient failures with exponential backoff
  //  - single ownership of counter/map cleanup in .finally (fixes count drift)
  // Returns true only when a new network request was actually started.
  // Circuit-breaker bookkeeping for a frame whose fetch retries exhausted.
  const markFetchFailure = useCallback((key: string) => {
    const now = Date.now();
    const guard = endpointGuardRef.current;

    // Endpoint-level guard: many distinct-key failures in a row -> pause all
    // dispatch with doubling backoff instead of hammering a broken endpoint.
    guard.consecutive++;
    if (guard.consecutive >= ENDPOINT_FAILURE_THRESHOLD) {
      guard.pausedUntil = now + guard.backoffMs;
      guard.backoffMs = Math.min(ENDPOINT_BACKOFF_MAX_MS, guard.backoffMs * 2);
      guard.consecutive = 0;
      stats.endpointPauses++;
    }

    // Per-key breaker: escalating cooldown (30s -> 60s -> 120s cap)
    const prev = blockedKeysRef.current.get(key);
    const count = (prev?.count ?? 0) + 1;
    const cooldown = Math.min(
      FETCH_FAILURE_COOLDOWN_MAX_MS,
      FETCH_FAILURE_COOLDOWN_MS * Math.pow(2, count - 1)
    );
    blockedKeysRef.current.set(key, { until: now + cooldown, count });
  }, []);

  const dispatchFetch = useCallback(
    (physical: number, priority: "urgent" | "idle"): boolean => {
    const variant = assetVariantRef.current;
    const key = `${variant}:${physical}`;

    if (blobCacheRef.current.has(key)) return false; // already downloaded

    // Endpoint guard: while paused, start nothing (cached frames still render)
    const now = Date.now();
    if (now < endpointGuardRef.current.pausedUntil) return false;

    // Per-key breaker: skip cooling frames; allow exactly one probe after expiry
    const blocked = blockedKeysRef.current.get(key);
    if (blocked) {
      if (now < blocked.until) return false;
      blockedKeysRef.current.delete(key);
    }

    const existing = inflightRef.current.get(key);
    if (existing) {
      if (priority === "urgent" && existing.priority === "idle") {
        // Upgrade: abort the idle request; its own .finally owns cleanup.
        existing.controller.abort();
        // fall through and dispatch a fresh urgent request below
      } else {
        stats.dedupedHits++;
        return false; // dedupe: already in flight at sufficient priority
      }
    }

    if (priority === "urgent") {
      if (urgentCountRef.current >= MAX_URGENT_CONCURRENT) {
        // Preempt distant in-flight requests; each aborted request's .finally
        // kicks the scheduler, which re-dispatches this corridor immediately.
        const curPhys = getPhysicalFrameNumber(currentFrameRef.current);
        for (const entry of inflightRef.current.values()) {
          if (Math.abs(entry.physical - curPhys) > PREFETCH_ABORT_DISTANCE) {
            entry.controller.abort();
          }
        }
        return false; // slots free asynchronously; the completion kick re-dispatches
      }
    } else {
      // Idle traffic only runs when the urgent pipeline is completely idle.
      if (urgentCountRef.current > 0 || idleCountRef.current >= MAX_IDLE_CONCURRENT) return false;
    }

    const controller = new AbortController();
    inflightRef.current.set(key, { controller, priority, physical });
    if (priority === "urgent") urgentCountRef.current++;
    else idleCountRef.current++;
    stats.netRequests++;

    const url = getFrameUrl(physical, variant);

    const attempt = (triesLeft: number): Promise<void> =>
      fetch(url, { signal: controller.signal, cache: "force-cache" })
        .then(async (res) => {
          // Status whitelist: only 200 (full) and 206 (valid partial) are
          // acceptable — anything else (3xx surprises, 4xx, 5xx, protocol
          // garbage) is a failure and feeds the circuit breaker.
          if (res.status !== 200 && res.status !== 206) {
            throw new Error(`HTTP ${res.status}`);
          }
          return res.blob();
        })
        .then((blob) => {
          if (assetVariantRef.current === variant) {
            blobCacheRef.current.set(key, blob);
            // Any success resets the endpoint guard entirely
            endpointGuardRef.current.consecutive = 0;
            endpointGuardRef.current.backoffMs = ENDPOINT_BACKOFF_MIN_MS;
            endpointGuardRef.current.pausedUntil = 0;
          }
        })
        .catch(async (err) => {
          if (err && err.name === "AbortError") return;
          stats.netErrors++;
          stats.fetchFailures++;
          const retryable =
            triesLeft > 0 &&
            !controller.signal.aborted &&
            assetVariantRef.current === variant &&
            Date.now() >= endpointGuardRef.current.pausedUntil;
          if (retryable) {
            await new Promise<void>((r) =>
              setTimeout(r, RETRY_BASE_DELAY_MS * Math.pow(2, RETRY_LIMIT - triesLeft))
            );
            if (!controller.signal.aborted && assetVariantRef.current === variant) {
              return attempt(triesLeft - 1);
            }
          }
          // Retries exhausted (or non-retryable) -> trip the breakers.
          // Without this, a permanently-failing frame was re-dispatched by
          // every scheduler kick forever (fetch storm).
          if (!controller.signal.aborted && assetVariantRef.current === variant) {
            markFetchFailure(key);
          }
        });

    attempt(RETRY_LIMIT).finally(() => {
      // SINGLE ownership of counter + map cleanup. The abort/preempt paths never
      // touch these — the old code decremented in both places and drifted.
      if (priority === "urgent") urgentCountRef.current = Math.max(0, urgentCountRef.current - 1);
      else idleCountRef.current = Math.max(0, idleCountRef.current - 1);

      const entry = inflightRef.current.get(key);
      if (entry && entry.controller === controller) inflightRef.current.delete(key);

      if (!unmountedRef.current) {
        scheduleRef.current?.(currentFrameRef.current, scrollVelocityRef.current);
        scheduleIdleStreamRef.current();
      }
    });

    return true;
    },
    [markFetchFailure]
  );

  // =========================================================================
  // DECODE PIPELINE (bounded concurrency, stale-drop, JIT jump slots)
  // =========================================================================
  const pumpDecodeQueueRef = useRef<() => void>(() => {});

  const pumpDecodeQueue = useCallback(() => {
    while (decodeInflightRef.current.size < MAX_CONCURRENT_DECODES && decodeQueueRef.current.length > 0) {
      const key = decodeQueueRef.current.shift()!;
      decodeQueuedRef.current.delete(key);

      const colon = key.indexOf(":");
      const variant = key.slice(0, colon);
      const phys = physOfKey(key);

      // Drop stale queue entries (variant flipped, or playhead moved far past)
      if (variant !== assetVariantRef.current) {
        stats.decodeDrops++;
        continue;
      }
      const curPhys = getPhysicalFrameNumber(currentFrameRef.current);
      if (Math.abs(phys - curPhys) > KEEP_FORWARD + 16) {
        stats.decodeDrops++;
        continue;
      }

      const blob = blobCacheRef.current.get(key);
      if (!blob || bitmapCacheRef.current.has(key)) continue;

      decodeInflightRef.current.add(key);
      stats.decodes++;
      decodeAsset(blob).then((asset) => {
        decodeInflightRef.current.delete(key);
        if (asset) {
          if (!unmountedRef.current) {
            const cur = getPhysicalFrameNumber(currentFrameRef.current);
            if (variant === assetVariantRef.current && Math.abs(phys - cur) <= KEEP_FORWARD + 16) {
              bitmapCacheRef.current.set(key, asset);
              if (Math.abs(phys - cur) <= 1) {
                lastDrawnFrameRef.current = -1; // fresh playhead frame — force redraw
              }
            } else {
              closeAsset(asset); // stale completion — release immediately
              stats.decodeDrops++;
            }
          } else {
            closeAsset(asset); // component unmounted — release immediately
          }
        } else {
          // Decode failed (corrupt bytes). Memoize it — without this, the
          // playhead JIT re-enqueue would spin on the same bad blob forever.
          stats.decodeFailures++;
          const fails = (badDecodeRef.current.get(key) ?? 0) + 1;
          badDecodeRef.current.set(key, fails);
          if (fails >= DECODE_FAILURE_LIMIT) {
            blockedKeysRef.current.set(key, { until: Date.now() + DECODE_FAILURE_COOLDOWN_MS, count: 1 });
            badDecodeRef.current.delete(key);
          }
        }
        if (!unmountedRef.current) pumpDecodeQueueRef.current();
      });
    }
  }, []);

  useEffect(() => {
    pumpDecodeQueueRef.current = pumpDecodeQueue;
  }, [pumpDecodeQueue]);

  const enqueueDecode = useCallback(
    (key: string, jumpQueue = false) => {
      if (decodeInflightRef.current.has(key) || decodeQueuedRef.current.has(key)) return;
      if (!blobCacheRef.current.has(key) || bitmapCacheRef.current.has(key)) return;
      // Skip keys blocked by the breaker (repeated decode failures)
      const blocked = blockedKeysRef.current.get(key);
      if (blocked && Date.now() < blocked.until) return;
      decodeQueuedRef.current.add(key);
      if (jumpQueue) decodeQueueRef.current.unshift(key);
      else decodeQueueRef.current.push(key);
      pumpDecodeQueue();
    },
    [pumpDecodeQueue]
  );

  // Find nearest loaded bitmap key for the current variant, preferring the
  // preceding frame along the travel trajectory.
  const findNearestLoadedKey = useCallback((targetPhysical: number): string | null => {
    const variant = assetVariantRef.current;
    let bestKey: string | null = null;
    let bestDist = Infinity;
    let bestPreceding = false;
    for (const [key] of bitmapCacheRef.current) {
      const colon = key.indexOf(":");
      if (key.slice(0, colon) !== variant) continue;
      const p = physOfKey(key);
      const dist = Math.abs(p - targetPhysical);
      const preceding = p <= targetPhysical;
      if (
        dist < bestDist ||
        (dist === bestDist && preceding && !bestPreceding)
      ) {
        bestKey = key;
        bestDist = dist;
        bestPreceding = preceding;
      }
    }
    return bestKey;
  }, []);

  // =========================================================================
  // PACK BATCHING LOADER (Track B: 16 frames / pack binary fetch layer)
  // =========================================================================
  const markPackFetchFailure = useCallback((key: string) => {
    const now = Date.now();
    const guard = endpointGuardRef.current;

    guard.consecutive++;
    if (guard.consecutive >= ENDPOINT_FAILURE_THRESHOLD) {
      guard.pausedUntil = now + guard.backoffMs;
      guard.backoffMs = Math.min(ENDPOINT_BACKOFF_MAX_MS, guard.backoffMs * 2);
      guard.consecutive = 0;
      stats.endpointPauses++;
    }

    const prev = blockedPacksRef.current.get(key);
    const count = (prev?.count ?? 0) + 1;
    const cooldown = Math.min(
      FETCH_FAILURE_COOLDOWN_MAX_MS,
      FETCH_FAILURE_COOLDOWN_MS * Math.pow(2, count - 1)
    );
    blockedPacksRef.current.set(key, { until: now + cooldown, count });
  }, []);

  const dispatchPackFetch = useCallback(
    (packIndex: number, priority: "urgent" | "idle"): boolean => {
      const variant = assetVariantRef.current;
      const key = `${variant}:pack:${packIndex}`;
      const { start, end } = getPackFrameRange(packIndex);

      let hasMissing = false;
      for (let f = start; f <= end; f++) {
        if (!blobCacheRef.current.has(`${variant}:${f}`)) {
          hasMissing = true;
          break;
        }
      }
      if (!hasMissing) return false;

      const now = Date.now();
      if (now < endpointGuardRef.current.pausedUntil) return false;

      const blocked = blockedPacksRef.current.get(key);
      if (blocked) {
        if (now < blocked.until) {
          // Direct per-frame fetch fallback: ensure single bad pack cannot create 16 holes
          for (let f = start; f <= end; f++) {
            if (!blobCacheRef.current.has(`${variant}:${f}`)) {
              dispatchFetch(f, priority);
            }
          }
          return false;
        }
        blockedPacksRef.current.delete(key);
      }

      const existing = packInflightRef.current.get(key);
      if (existing) {
        if (priority === "urgent" && existing.priority === "idle") {
          existing.controller.abort();
        } else {
          stats.dedupedHits++;
          return false;
        }
      }

      if (priority === "urgent") {
        if (urgentPackCountRef.current >= MAX_URGENT_PACK_CONCURRENT) {
          return false;
        }
      } else {
        if (
          urgentCountRef.current > 0 ||
          urgentPackCountRef.current > 0 ||
          idlePackCountRef.current >= MAX_IDLE_PACK_CONCURRENT
        ) {
          return false;
        }
      }

      const controller = new AbortController();
      packInflightRef.current.set(key, { controller, priority, packIndex });
      if (priority === "urgent") urgentPackCountRef.current++;
      else idlePackCountRef.current++;
      stats.netRequests++;
      stats.packRequests++;

      const url = getPackUrl(packIndex, variant);

      const attempt = (triesLeft: number): Promise<void> =>
        fetch(url, { signal: controller.signal, cache: "force-cache" })
          .then(async (res) => {
            if (res.status !== 200 && res.status !== 206) {
              throw new Error(`HTTP ${res.status}`);
            }
            return res.arrayBuffer();
          })
          .then((buffer) => {
            if (assetVariantRef.current !== variant) return;

            const view = new DataView(buffer);
            const count = view.getUint32(0, true);
            let offset = 4 + count * 4;

            for (let i = 0; i < count; i++) {
              const len = view.getUint32(4 + i * 4, true);
              const phys = start + i;
              const frameKey = `${variant}:${phys}`;

              if (!blobCacheRef.current.has(frameKey)) {
                const frameBlob = new Blob([new Uint8Array(buffer, offset, len)], {
                  type: "image/webp",
                });
                blobCacheRef.current.set(frameKey, frameBlob);
              }
              offset += len;
            }

            endpointGuardRef.current.consecutive = 0;
            endpointGuardRef.current.backoffMs = ENDPOINT_BACKOFF_MIN_MS;
            endpointGuardRef.current.pausedUntil = 0;

            const curPhys = getPhysicalFrameNumber(currentFrameRef.current);
            for (let f = start; f <= end; f++) {
              if (Math.abs(f - curPhys) <= DECODE_FORWARD) {
                enqueueDecode(`${variant}:${f}`);
              }
            }
          })
          .catch(async (err) => {
            if (err && err.name === "AbortError") return;
            stats.netErrors++;
            stats.fetchFailures++;
            const retryable =
              triesLeft > 0 &&
              !controller.signal.aborted &&
              assetVariantRef.current === variant &&
              Date.now() >= endpointGuardRef.current.pausedUntil;

            if (retryable) {
              await new Promise<void>((r) =>
                setTimeout(r, RETRY_BASE_DELAY_MS * Math.pow(2, RETRY_LIMIT - triesLeft))
              );
              if (!controller.signal.aborted && assetVariantRef.current === variant) {
                return attempt(triesLeft - 1);
              }
            }

            if (!controller.signal.aborted && assetVariantRef.current === variant) {
              markPackFetchFailure(key);
              // Fallback to direct per-frame fetches so a single failing pack doesn't leave 16 holes
              for (let f = start; f <= end; f++) {
                if (!blobCacheRef.current.has(`${variant}:${f}`)) {
                  dispatchFetch(f, priority);
                }
              }
            }
          });

      attempt(RETRY_LIMIT).finally(() => {
        if (priority === "urgent") urgentPackCountRef.current = Math.max(0, urgentPackCountRef.current - 1);
        else idlePackCountRef.current = Math.max(0, idlePackCountRef.current - 1);

        const entry = packInflightRef.current.get(key);
        if (entry && entry.controller === controller) packInflightRef.current.delete(key);

        if (!unmountedRef.current) {
          scheduleRef.current?.(currentFrameRef.current, scrollVelocityRef.current);
          scheduleIdleStreamRef.current();
        }
      });

      return true;
    },
    [dispatchFetch, enqueueDecode, markPackFetchFailure]
  );

  // =========================================================================
  // PLAYHEAD-FIRST PRIORITY SCHEDULER (coarse-first corridor)
  // =========================================================================
  const schedulePriorityBuffer = useCallback(
    (centerFloat: number, velocity: number) => {
      const centerVirtual = Math.min(TOTAL_FRAMES, Math.max(1, Math.round(centerFloat)));
      const targetPhysical = getPhysicalFrameNumber(centerVirtual);
      const isForward = velocity >= -0.05;
      const dir = isForward ? 1 : -1;
      const variant = assetVariantRef.current;

      // 1) Prune decoded bitmaps outside [target-KEEP_BACK, target+KEEP_FORWARD]
      for (const [key, asset] of bitmapCacheRef.current) {
        if (!key.startsWith(`${variant}:`)) {
          closeAsset(asset); // stale variant (defensive — flip handler clears these)
          bitmapCacheRef.current.delete(key);
          continue;
        }
        const p = physOfKey(key);
        if (p < targetPhysical - KEEP_BACK || p > targetPhysical + KEEP_FORWARD) {
          closeAsset(asset);
          bitmapCacheRef.current.delete(key);
        }
      }

      // 2) Decode-ahead: keep the decode window aligned with the fetch corridor
      //    (blobs for [t-4, t+16] are decoded BEFORE the playhead arrives).
      for (let p = Math.max(1, targetPhysical - DECODE_BACK); p <= Math.min(TOTAL_PHYSICAL_FRAMES, targetPhysical + DECODE_FORWARD); p++) {
        enqueueDecode(`${variant}:${p}`);
      }

      // 3) Coarse-first fetch order: stride anchors land first so cold jumps
      //    and hard flings always have a nearby anchor frame, then the dense
      //    corridor fills the gaps.
      const order: number[] = [];
      const seen = new Set<number>();
      const pushVirtual = (v: number) => {
        if (v < 1 || v > TOTAL_FRAMES) return;
        const p = getPhysicalFrameNumber(v);
        if (!seen.has(p)) {
          seen.add(p);
          order.push(p);
        }
      };

      for (const s of STRIDE_ANCHORS) pushVirtual(centerVirtual + s * dir); // anchors ahead
      for (const s of [4, 8]) pushVirtual(centerVirtual - s * dir); // reverse safety anchors
      const fwdLook = isForward ? LOOKAHEAD_FORWARD : LOOKAHEAD_BACKWARD;
      for (let i = 1; i <= fwdLook; i++) pushVirtual(centerVirtual + i * dir); // dense fill ahead
      const backLook = isForward ? LOOKAHEAD_BACKWARD : LOOKAHEAD_FORWARD;
      for (let i = 1; i <= backLook; i++) pushVirtual(centerVirtual - i * dir); // dense fill behind

      if (noPacksRef.current) {
        for (const p of order) dispatchFetch(p, "urgent");
      } else {
        const packOrder: number[] = [];
        const seenPacks = new Set<number>();
        for (const p of order) {
          const pIdx = getPackIndex(p);
          if (!seenPacks.has(pIdx)) {
            seenPacks.add(pIdx);
            const { start, end } = getPackFrameRange(pIdx);
            let needed = false;
            for (let f = start; f <= end; f++) {
              if (!blobCacheRef.current.has(`${variant}:${f}`)) {
                needed = true;
                break;
              }
            }
            if (needed) packOrder.push(pIdx);
          }
        }
        for (const pIdx of packOrder) dispatchPackFetch(pIdx, "urgent");
      }

      // Pre-warm the single events pack well before reaching the gallery (frame 598)
      if (centerVirtual > 300) {
        loadEventsPack().catch(() => {});
      }
      // Pre-warm the single team pack well before reaching the team wall (frame 840)
      if (centerVirtual > 500) {
        loadTeamPack().catch(() => {});
      }
    },
    [dispatchFetch, dispatchPackFetch, enqueueDecode]
  );

  // =========================================================================
  // BACKGROUND IDLE STREAMER
  // =========================================================================
  // Quietly downloads the remaining compressed WebP blobs into RAM when the
  // user is idle (urgent pipeline empty, no active fling).
  const scheduleIdleStream = useCallback(() => {
    if (idleHandleRef.current !== null) return;
    if (urgentCountRef.current > 0 || urgentPackCountRef.current > 0) return;

    // Pre-warm the events and team packs quietly during idle periods
    loadEventsPack().catch(() => {});
    loadTeamPack().catch(() => {});

    const variant = assetVariantRef.current;
    let blobCount = 0;
    for (const k of blobCacheRef.current.keys()) {
      if (k.startsWith(`${variant}:`)) blobCount++;
    }
    if (blobCount >= TOTAL_PHYSICAL_FRAMES) return; // fully warmed

    idleHandleRef.current = requestIdle(() => {
      idleHandleRef.current = null;
      if (
        urgentCountRef.current > 0 ||
        urgentPackCountRef.current > 0 ||
        Math.abs(scrollVelocityRef.current) > 2
      ) {
        return;
      }

      const curPhys = getPhysicalFrameNumber(currentFrameRef.current);
      let dispatched = 0;

      if (noPacksRef.current) {
        // Forward corridor from playhead first, then backward to the beginning
        for (let f = curPhys; f <= TOTAL_PHYSICAL_FRAMES && dispatched < MAX_IDLE_CONCURRENT; f++) {
          if (dispatchFetch(f, "idle")) dispatched++;
        }
        if (dispatched < MAX_IDLE_CONCURRENT) {
          for (let f = curPhys - 1; f >= 1 && dispatched < MAX_IDLE_CONCURRENT; f--) {
            if (dispatchFetch(f, "idle")) dispatched++;
          }
        }
      } else {
        const curPack = getPackIndex(curPhys);
        const isPackNeeded = (pIdx: number) => {
          const { start, end } = getPackFrameRange(pIdx);
          for (let f = start; f <= end; f++) {
            if (!blobCacheRef.current.has(`${variant}:${f}`)) return true;
          }
          return false;
        };

        for (let p = curPack; p < TOTAL_PACKS && dispatched < MAX_IDLE_PACK_CONCURRENT; p++) {
          if (isPackNeeded(p)) {
            if (dispatchPackFetch(p, "idle")) dispatched++;
          }
        }
        if (dispatched < MAX_IDLE_PACK_CONCURRENT) {
          for (let p = curPack - 1; p >= 0 && dispatched < MAX_IDLE_PACK_CONCURRENT; p--) {
            if (isPackNeeded(p)) {
              if (dispatchPackFetch(p, "idle")) dispatched++;
            }
          }
        }
      }
      // Continuation is driven by each request's .finally kick.
    });
  }, [dispatchFetch, dispatchPackFetch]);

  useEffect(() => {
    scheduleIdleStreamRef.current = scheduleIdleStream;
    scheduleRef.current = (center, velocity) => schedulePriorityBuffer(center, velocity);
  }, [scheduleIdleStream, schedulePriorityBuffer]);

  // =========================================================================
  // CANVAS RENDER (variant-scoped, KPI-instrumented)
  // =========================================================================
  const drawFrameToCanvas = useCallback(
    (frameFloat: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const clamped = Math.min(TOTAL_FRAMES, Math.max(1, frameFloat));
      let targetInt = Math.floor(clamped);

      // Deliberate blit throttle during flings (Track A1):
      // When |velocity| > 400 frames/s, draw every 4th integer frame;
      // When |velocity| > 120 frames/s, draw every 2nd integer frame.
      // Landing matters; full rate resumes the instant velocity drops.
      const absVel = Math.abs(scrollVelocityRef.current);
      if (absVel > 400) {
        targetInt = Math.max(1, targetInt - (targetInt % 4));
      } else if (absVel > 120) {
        targetInt = Math.max(1, targetInt - (targetInt % 2));
      }

      const targetPhysical = getPhysicalFrameNumber(targetInt);
      const variant = assetVariantRef.current;
      const targetKey = `${variant}:${targetPhysical}`;

      let drawKey: string | null = targetKey;
      if (!bitmapCacheRef.current.has(drawKey)) {
        // JIT decode for the exact playhead frame — jumps the decode queue
        if (blobCacheRef.current.has(targetKey)) enqueueDecode(targetKey, true);
        drawKey = findNearestLoadedKey(targetPhysical);
      }
      if (!drawKey) return;

      const asset = bitmapCacheRef.current.get(drawKey);
      if (!asset) return;

      // KPI: stale draw = drawn frame more than 2 frames from scroll target
      if (Math.abs(physOfKey(drawKey) - targetPhysical) > 2) stats.staleDraws++;

      const width = windowWidthRef.current || window.innerWidth;
      const height = windowHeightRef.current || window.innerHeight;

      // Skip redundant GPU blits when frame + dimensions unchanged (60Hz & 120Hz win)
      if (
        physOfKey(drawKey) === lastDrawnFrameRef.current &&
        width === lastDrawnWidthRef.current &&
        height === lastDrawnHeightRef.current
      ) {
        return;
      }

      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const targetWidth = Math.round(width * dpr);
      const targetHeight = Math.round(height * dpr);

      if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
        canvas.width = targetWidth;
        canvas.height = targetHeight;
      }

      let ctx = ctxRef.current;
      if (!ctx) {
        ctx = canvas.getContext("2d", {
          alpha: false,
        }) as CanvasRenderingContext2D | null;
        ctxRef.current = ctx;
      }
      if (!ctx) return;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "medium";

      const imgWidth = "naturalWidth" in asset && asset.naturalWidth ? asset.naturalWidth : asset.width;
      const imgHeight = "naturalHeight" in asset && asset.naturalHeight ? asset.naturalHeight : asset.height;
      if (!imgWidth || !imgHeight) return;

      const imgRatio = imgWidth / imgHeight;
      const canvasRatio = width / height;

      let drawW = Math.round(width);
      let drawH = Math.round(height);
      let offsetX = 0;
      let offsetY = 0;

      if (canvasRatio > imgRatio) {
        drawW = Math.round(width);
        drawH = Math.round(width / imgRatio);
        offsetY = Math.round((height - drawH) / 2);
      } else {
        drawH = Math.round(height);
        drawW = Math.round(height * imgRatio);
        offsetX = Math.round((width - drawW) / 2);
      }

      ctx.globalAlpha = 1.0;
      ctx.drawImage(asset, offsetX, offsetY, drawW, drawH);

      stats.drawn++;
      lastDrawnFrameRef.current = physOfKey(drawKey);
      lastDrawnWidthRef.current = width;
      lastDrawnHeightRef.current = height;
    },
    [enqueueDecode, findNearestLoadedKey]
  );

  // =========================================================================
  // DIMENSIONS, CACHED MAX-SCROLL & ADAPTIVE VARIANT SWITCH
  // =========================================================================
  // maxScroll is recomputed on resize / body-size changes ONLY. The old RAF
  // loop read document.documentElement.scrollHeight every frame after Lenis
  // had dirtied scroll — a forced layout/recalc on a 15,144px document.
  useEffect(() => {
    let variantTimer: ReturnType<typeof setTimeout> | null = null;
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;

    const recomputeMaxScroll = () => {
      maxScrollRef.current = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    };

    const applyVariantSwitch = (next: AssetVariant) => {
      const old = assetVariantRef.current;
      if (old === next) return;

      // Abort old-variant in-flight requests (their .finally owns cleanup)
      for (const [key, entry] of inflightRef.current) {
        if (key.startsWith(`${old}:`)) entry.controller.abort();
      }
      for (const [key, entry] of packInflightRef.current) {
        if (key.startsWith(`${old}:`)) entry.controller.abort();
      }
      blockedPacksRef.current.clear();
      // Drop old-variant caches (fixes the mixed 720p/1080p playback bug)
      for (const [key, asset] of bitmapCacheRef.current) {
        if (key.startsWith(`${old}:`)) {
          closeAsset(asset);
          bitmapCacheRef.current.delete(key);
        }
      }
      for (const key of blobCacheRef.current.keys()) {
        if (key.startsWith(`${old}:`)) blobCacheRef.current.delete(key);
      }
      decodeQueueRef.current.length = 0;
      decodeQueuedRef.current.clear();
      // Fresh failure-isolation state for the new variant
      blockedKeysRef.current.clear();
      badDecodeRef.current.clear();
      endpointGuardRef.current = { pausedUntil: 0, backoffMs: ENDPOINT_BACKOFF_MIN_MS, consecutive: 0 };

      assetVariantRef.current = next;
      lastDrawnFrameRef.current = -1;
      lastDrawnWidthRef.current = 0;
      lastDrawnHeightRef.current = 0;

      requestAnimationFrame(() => {
        drawFrameToCanvas(currentFrameRef.current);
        scheduleRef.current?.(currentFrameRef.current, scrollVelocityRef.current);
        scheduleIdleStreamRef.current();
      });
    };

    const onResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        windowWidthRef.current = window.innerWidth;
        windowHeightRef.current = window.innerHeight;
        recomputeMaxScroll();

        const next: AssetVariant = resolveDeviceVariant();
        if (next !== assetVariantRef.current) {
          if (variantTimer) clearTimeout(variantTimer);
          variantTimer = setTimeout(() => applyVariantSwitch(next), VARIANT_SWITCH_DEBOUNCE_MS);
        } else if (variantTimer) {
          clearTimeout(variantTimer);
          variantTimer = null;
        }

        lastDrawnFrameRef.current = -1; // force redraw on resize
        requestAnimationFrame(() => drawFrameToCanvas(currentFrameRef.current));
      }, RESIZE_DEBOUNCE_MS);
    };

    windowWidthRef.current = window.innerWidth;
    windowHeightRef.current = window.innerHeight;
    recomputeMaxScroll();

    const ro = new ResizeObserver(recomputeMaxScroll);
    ro.observe(document.body);

    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      ro.disconnect();
      if (resizeTimer) clearTimeout(resizeTimer);
      if (variantTimer) clearTimeout(variantTimer);
    };
  }, [drawFrameToCanvas]);

  // =========================================================================
  // PROGRESSIVE BOOT (unified loader, scroll-locked, right-sized corridor)
  // =========================================================================
  useEffect(() => {
    unmountedRef.current = false;
    let isCancelled = false;
    let bootInterval: ReturnType<typeof setInterval> | null = null;
    let bootTimeout: ReturnType<typeof setTimeout> | null = null;

    // Lock native scroll while the splash is up (prevents scrolling into
    // cold, unloaded regions underneath the loading screen).
    const lockScroll = () => {
      document.documentElement.style.overflow = "hidden";
    };
    const unlockScroll = () => {
      document.documentElement.style.overflow = "";
    };
    lockScroll();

    // Dispatch the boot corridor: if packs are enabled, Pack 0 contains frames
    // 1-16 (covering CRITICAL_PRELOAD_COUNT = 14) in a single request.
    if (noPacksRef.current) {
      for (let i = 1; i <= CRITICAL_PRELOAD_COUNT; i++) {
        dispatchFetch(i, "urgent");
      }
    } else {
      dispatchPackFetch(0, "urgent");
    }

    const bootDone = () => {
      if (isCancelled) return;
      if (bootInterval) clearInterval(bootInterval);
      if (bootTimeout) clearTimeout(bootTimeout);
      bootInterval = null;
      bootTimeout = null;
      setIsReady(true);
      setLoadProgress(100);
      unlockScroll();
      drawFrameToCanvas(1);
      scheduleRef.current?.(1, 1.0); // start the corridor + idle warm-ahead
      scheduleIdleStreamRef.current();
      videoRef.current?.play().catch(() => {});
    };

    bootInterval = setInterval(() => {
      if (isCancelled) return;
      const variant = assetVariantRef.current;
      let have = 0;
      for (let i = 1; i <= CRITICAL_PRELOAD_COUNT; i++) {
        if (blobCacheRef.current.has(`${variant}:${i}`)) have++;
      }
      setLoadProgress(Math.min(100, Math.round((have / CRITICAL_PRELOAD_COUNT) * 100)));
      if (have >= CRITICAL_PRELOAD_COUNT) bootDone();
    }, 100);

    // Fast-boot timeout: never hold the splash longer than BOOT_TIMEOUT_MS
    bootTimeout = setTimeout(bootDone, BOOT_TIMEOUT_MS);

    return () => {
      isCancelled = true;
      if (bootInterval) clearInterval(bootInterval);
      if (bootTimeout) clearTimeout(bootTimeout);
      unlockScroll();
      if (idleHandleRef.current !== null) {
        cancelIdle(idleHandleRef.current);
        idleHandleRef.current = null;
      }
      // Abort all in-flight network requests (their .finally owns accounting)
      for (const entry of inflightRef.current.values()) entry.controller.abort();
      inflightRef.current.clear();
      for (const entry of packInflightRef.current.values()) entry.controller.abort();
      packInflightRef.current.clear();
      // Free decoded bitmaps + compressed blobs + decode queue + breaker state
      for (const asset of bitmapCacheRef.current.values()) closeAsset(asset);
      bitmapCacheRef.current.clear();
      blobCacheRef.current.clear();
      decodeQueueRef.current.length = 0;
      decodeQueuedRef.current.clear();
      blockedKeysRef.current.clear();
      blockedPacksRef.current.clear();
      badDecodeRef.current.clear();
      endpointGuardRef.current = { pausedUntil: 0, backoffMs: ENDPOINT_BACKOFF_MIN_MS, consecutive: 0 };
      unmountedRef.current = true;
    };
  }, [dispatchFetch, dispatchPackFetch, drawFrameToCanvas]);

  // =========================================================================
  // MAIN SCROLL ENGINE (single RAF loop, cached maxScroll, gated style writes)
  // =========================================================================
  useEffect(() => {
    if (!isReady) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const lenis = new Lenis({
      duration: prefersReducedMotion ? 0 : 0.85,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: "vertical",
      gestureOrientation: "vertical",
      smoothWheel: true,
      wheelMultiplier: 1.0,
      touchMultiplier: 1.6,
      infinite: false,
    });

    lenisRef.current = lenis;

    let animFrameId: number;
    let debugInterval: ReturnType<typeof setInterval> | null = null;

    if (new URLSearchParams(window.location.search).has("debug")) {
      debugInterval = setInterval(() => {
        console.log("[frameStats]", {
          ...stats,
          urgent: urgentCountRef.current,
          idle: idleCountRef.current,
          urgentPacks: urgentPackCountRef.current,
          idlePacks: idlePackCountRef.current,
          blobs: blobCacheRef.current.size,
          bitmaps: bitmapCacheRef.current.size,
          blocked: blockedKeysRef.current.size,
          blockedPacks: blockedPacksRef.current.size,
          endpointPaused: Date.now() < endpointGuardRef.current.pausedUntil,
        });
      }, 5000);
    }

    const setVar = (container: HTMLElement, name: string, value: string) => {
      if (lastCssRef.current[name] !== value) {
        lastCssRef.current[name] = value;
        container.style.setProperty(name, value);
      }
    };

    const renderLoop = (time: number) => {
      lenis.raf(time);

      const scrollY = lenis.scroll;
      const maxScroll = maxScrollRef.current; // cached — no per-frame layout read
      const progress = maxScroll > 0 ? Math.min(1, Math.max(0, scrollY / maxScroll)) : 0;

      const renderFloat = 1 + progress * (TOTAL_FRAMES - 1);
      const prevFloat = currentFrameRef.current;
      currentFrameRef.current = renderFloat;

      const now = performance.now();
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTimeRef.current) / 1000));
      lastTimeRef.current = now;

      const velocity = (renderFloat - prevFloat) / dt;
      scrollVelocityRef.current = velocity;

      // Priority scheduler: run when the integer frame advances or velocity is high
      const currentInt = Math.floor(renderFloat);
      if (currentInt !== lastScheduledIntegerRef.current || Math.abs(velocity) > 3) {
        lastScheduledIntegerRef.current = currentInt;
        schedulePriorityBuffer(renderFloat, velocity);
      } else if (Math.abs(velocity) < 1.0 && urgentCountRef.current === 0) {
        scheduleIdleStreamRef.current();
      }

      // ---- Hero video crossfade (gated writes + true pause when hidden) ----
      const vOpacity = Math.min(1, Math.max(0, 1 - (renderFloat - 1) / 14));
      const vw = videoWrapperRef.current;
      if (vw) {
        const o = vOpacity.toFixed(3);
        if (lastCssRef.current["__video-o"] !== o) {
          lastCssRef.current["__video-o"] = o;
          vw.style.opacity = o;
        }
        const disp = vOpacity <= 0.005 ? "none" : "block";
        if (lastCssRef.current["__video-d"] !== disp) {
          lastCssRef.current["__video-d"] = disp;
          vw.style.display = disp;
        }
      }
      const vid = videoRef.current;
      if (vid && !videoPermanentlyStoppedRef.current) {
        // Fire-and-forget (Track A2): play once at boot → on fade-out pause + reset currentTime to 0 → never resume.
        // Scrolled-back hero shows the paused first frame (visually same scene as canvas frame 1).
        if (vOpacity <= 0.005) {
          videoPermanentlyStoppedRef.current = true;
          vid.pause();
          try {
            vid.currentTime = 0;
          } catch {}
        }
      }

      // ---- Overlay CSS custom properties (compositor-friendly, gated) ----
      const container = containerRef.current;
      if (container) {
        const heroOpacity = Math.min(1, Math.max(0, 1 - (renderFloat - 1) / 32));
        const heroTY = Math.max(0, (renderFloat - 1) * 2);
        setVar(container, "--hero-opacity", heroOpacity.toFixed(3));
        setVar(container, "--hero-ty", `-${heroTY.toFixed(2)}px`);
        setVar(container, "--hero-vis", heroOpacity <= 0.01 ? "hidden" : "visible");

        let doorOpacity = 0;
        let doorTY = 0;
        if (renderFloat >= 355 && renderFloat < 368) {
          const t = (renderFloat - 355) / 13;
          doorOpacity = t;
          doorTY = (1 - t) * 10;
        } else if (renderFloat >= 368 && renderFloat <= 398) {
          doorOpacity = 1;
          doorTY = 0;
        } else if (renderFloat > 398 && renderFloat <= 415) {
          const t = (renderFloat - 398) / 17;
          doorOpacity = 1 - t;
          doorTY = t * -10;
        }
        setVar(container, "--door-opacity", doorOpacity.toFixed(3));
        setVar(container, "--door-ty", `${doorTY.toFixed(2)}px`);
        setVar(container, "--door-vis", doorOpacity <= 0.005 ? "hidden" : "visible");

        const startScrollFrame = 648;
        const endFrame = 1262;
        const galleryProgress =
          renderFloat <= startScrollFrame
            ? 0
            : Math.min(1, Math.max(0, (renderFloat - startScrollFrame) / (endFrame - startScrollFrame)));
        const galleryTX = -(galleryProgress * maxGalleryWidthRef.current);

        let galleryOpacity = 0;
        if (renderFloat >= 598 && renderFloat < 618) {
          galleryOpacity = (renderFloat - 598) / 20;
        } else if (renderFloat >= 618) {
          galleryOpacity = 1;
        }
        setVar(container, "--gallery-tx", `${galleryTX.toFixed(2)}px`);
        setVar(container, "--gallery-opacity", galleryOpacity.toFixed(3));
        setVar(container, "--gallery-vis", galleryOpacity <= 0.005 ? "hidden" : "visible");
        setVar(container, "--gallery-pe", galleryOpacity > 0.1 ? "auto" : "none");
      }

      // ---- Canvas render ----
      drawFrameToCanvas(renderFloat);

      // ---- Section boundary throttle (only cross-boundary React updates) ----
      const roundedFrame = Math.round(renderFloat);
      const isBoundaryCrossed =
        (lastReportedFrameRef.current !== 1 && roundedFrame <= 1) ||
        (lastReportedFrameRef.current < 50 && roundedFrame >= 50) ||
        (lastReportedFrameRef.current >= 50 && roundedFrame < 50) ||
        (lastReportedFrameRef.current < 350 && roundedFrame >= 350) ||
        (lastReportedFrameRef.current >= 350 && roundedFrame < 350) ||
        (lastReportedFrameRef.current < 365 && roundedFrame >= 365) ||
        (lastReportedFrameRef.current >= 365 && roundedFrame < 365) ||
        (lastReportedFrameRef.current < 425 && roundedFrame >= 425) ||
        (lastReportedFrameRef.current >= 425 && roundedFrame < 425) ||
        (lastReportedFrameRef.current < 598 && roundedFrame >= 598) ||
        (lastReportedFrameRef.current >= 598 && roundedFrame < 598) ||
        (lastReportedFrameRef.current < 840 && roundedFrame >= 840) ||
        (lastReportedFrameRef.current >= 840 && roundedFrame < 840) ||
        (lastReportedFrameRef.current < 1140 && roundedFrame >= 1140) ||
        (lastReportedFrameRef.current >= 1140 && roundedFrame < 1140);

      // Section tracking for Header navigation highlights
      const prevSection =
        lastReportedFrameRef.current >= 1140 ? 4 :
        lastReportedFrameRef.current >= 840 ? 3 :
        lastReportedFrameRef.current >= 598 ? 2 :
        lastReportedFrameRef.current >= 365 && lastReportedFrameRef.current < 450 ? 1 : 0;
      const nextSection =
        roundedFrame >= 1140 ? 4 :
        roundedFrame >= 840 ? 3 :
        roundedFrame >= 598 ? 2 :
        roundedFrame >= 365 && roundedFrame < 450 ? 1 : 0;
      const isSectionChanged = prevSection !== nextSection;

      if (isBoundaryCrossed || isSectionChanged) {
        const reportedFrame = roundedFrame <= 1 ? 1 : roundedFrame;
        lastReportedFrameRef.current = reportedFrame;
        setCurrentFrame(reportedFrame);
        if (onFrameUpdate) {
          onFrameUpdate(reportedFrame);
        }
      }

      animFrameId = requestAnimationFrame(renderLoop);
    };

    animFrameId = requestAnimationFrame(renderLoop);

    return () => {
      cancelAnimationFrame(animFrameId);
      if (debugInterval) clearInterval(debugInterval);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, [isReady, drawFrameToCanvas, onFrameUpdate, schedulePriorityBuffer]);

  // Pause / Resume Lenis scrolling when modal opens or closes
  useEffect(() => {
    if (!lenisRef.current) return;
    if (isJoinModalOpen) {
      lenisRef.current.stop();
    } else {
      lenisRef.current.start();
    }
  }, [isJoinModalOpen]);

  // Respond to programmatic header navigation
  useEffect(() => {
    if (targetNavigationFrame !== null && targetNavigationFrame !== undefined && lenisRef.current) {
      const target = Math.min(TOTAL_FRAMES, Math.max(1, targetNavigationFrame));
      const targetProgress = (target - 1) / (TOTAL_FRAMES - 1);
      const targetScrollY = targetProgress * maxScrollRef.current;

      schedulePriorityBuffer(target, 1.0);

      lenisRef.current.scrollTo(targetScrollY, {
        duration: 1.2,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        onComplete: () => {
          lastReportedFrameRef.current = target;
          setCurrentFrame(target);
          if (onFrameUpdate) {
            onFrameUpdate(target);
          }
          if (onNavigationComplete) {
            onNavigationComplete();
          }
        },
      });
    }
  }, [targetNavigationFrame, schedulePriorityBuffer, onNavigationComplete, onFrameUpdate]);

  const handleExploreEvents = useCallback(() => {
    if (lenisRef.current) {
      const targetProgress = (630 - 1) / (TOTAL_FRAMES - 1);
      schedulePriorityBuffer(630, 1.0);
      lenisRef.current.scrollTo(targetProgress * maxScrollRef.current, { duration: 1.2 });
    }
  }, [schedulePriorityBuffer]);

  return (
    <>
      {/* Frame Loading Screen */}
      <PreloadManager progress={loadProgress} isReady={isReady} />

      {/* Scrollable Track Element mapping page height to total frames */}
      <div
        className="relative w-full pointer-events-none"
        style={{ height: `${SCROLL_TRACK_HEIGHT}px` }}
      />

      {/* Fixed Viewport Container for Canvas & Interactive Overlays */}
      <div
        ref={containerRef}
        className="fixed inset-0 w-screen h-screen overflow-hidden select-none bg-[#040608] z-0"
      >
        {/* HTML5 High-Performance Scrollytelling Canvas */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full object-cover z-0"
        />

        {/* Ambient Video (poster paints instantly; playback starts once the
            boot corridor is ready; paused the moment it fades out) */}
        <div
          ref={videoWrapperRef}
          className="absolute inset-0 w-full h-full pointer-events-none z-10"
          style={{ opacity: 1 }}
        >
          <video
            ref={videoRef}
            src={getAssetUrl("/still_shot.mp4")}
            poster={getFrameUrl(1, "1080p")}
            suppressHydrationWarning
            loop
            muted
            playsInline
            preload="metadata"
            className="w-full h-full object-cover"
          />
        </div>

        {/* Subtle Vignette for Depth */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/20 pointer-events-none z-10" />

        {/* Overlay 1: Hero Landing (Frames 1 - 35) */}
        <HeroOverlay
          currentFrame={currentFrame}
          onExploreClick={handleExploreEvents}
          onOpenJoinModal={onOpenJoinModal}
        />

        {/* Overlay 2: Door About Us (Frames 368 - 395) */}
        <DoorAboutOverlay
          currentFrame={currentFrame}
          onOpenJoinModal={onOpenJoinModal}
        />

        {/* Overlay 3: Wall Gallery (Frames 598 - 1262) */}
        <WallGalleryOverlay
          currentFrame={currentFrame}
          onOpenJoinModal={onOpenJoinModal}
          onTrackWidthChange={(w) => {
            maxGalleryWidthRef.current = w;
          }}
        />
      </div>
    </>
  );
}

export default React.memo(ScrollytellingEngine);
