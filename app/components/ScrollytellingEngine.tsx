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
  FRAMES_PER_PACK,
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

// Decode pipeline: dense decode-ahead window co-sized with the bitmap cap so
// freshly decoded frames are never immediately evicted (the old mobile
// profile decoded +24 forward against a cap of 16 — decoded-then-evicted
// churn). Dense window + one stride anchor slot must fit inside the cap.
const DECODE_BACK = 4;
const DECODE_FORWARD_DESKTOP = 12; // t-4..t+12 = 17 + anchor slot = cap 18
const DECODE_FORWARD_TABLET = 8; //  t-4..t+8  = 13 + anchor slot = cap 14
const DECODE_FORWARD_MOBILE = 10; // t-4..t+10 = 15 + anchor slot = cap 16
const MAX_CONCURRENT_DECODES = 6;

const getDecodeForward = (variant: AssetVariant): number =>
  variant === "mobile_720p"
    ? DECODE_FORWARD_MOBILE
    : variant === "720p"
    ? DECODE_FORWARD_TABLET
    : DECODE_FORWARD_DESKTOP;

// Bounded bitmap cache capacities (strictly limits peak RAM consumption).
// Decoded bytes per bitmap: 1080p = 1920*1080*4 ≈ 8.29MB, 720p = 1280*720*4
// ≈ 3.68MB, mobile_720p = 404*720*4 ≈ 1.16MB.
// Desktop (1080p): 18 bitmaps * 8.29MB ≈ 149MB peak RAM
// Tablet (720p):   14 bitmaps * 3.68MB ≈ 52MB peak RAM
// Mobile (720p):   16 bitmaps * 1.16MB ≈ 19MB peak RAM
const MAX_BITMAP_CACHE_SIZE_DESKTOP = 18;
const MAX_BITMAP_CACHE_SIZE_TABLET = 14;
const MAX_BITMAP_CACHE_SIZE_MOBILE = 16;

const getDecodeConcurrency = (): number => {
  if (typeof window === "undefined" || typeof navigator === "undefined") return 4;
  const cores = navigator.hardwareConcurrency || 4;
  return Math.min(MAX_CONCURRENT_DECODES, Math.max(4, cores));
};

// ---------------------------------------------------------------------------
// BOUNDED TIER-1 BLOB CACHE (sliding pack window)
// ---------------------------------------------------------------------------
// The idle streamer no longer accumulates all 840 compressed frames in RAM.
// It warms packs within BLOB_WARM_PACK_RADIUS of the playhead, and
// pruneBlobCache evicts packs beyond BLOB_EVICT_PACK_RADIUS. Eviction is
// nearly free: the CDN serves immutable cache headers and every fetch uses
// cache: "force-cache", so a re-fetch after eviction is a browser disk-cache
// hit — no network round trip, no visible stall on scroll-back.
const BLOB_WARM_PACK_RADIUS = 6; // idle warm corridor: ±6 packs (±96 frames)
const BLOB_EVICT_PACK_RADIUS = 8; // hard eviction boundary: ±8 packs (±128 frames)

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
  blobEvictions: 0,
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
    return createImageBitmap(blob, {
      colorSpaceConversion: "none",
      premultiplyAlpha: "default",
    }).catch(() =>
      createImageBitmap(blob).catch(() => decodeViaImageElement(blob))
    );
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
  const lastScheduleTimeRef = useRef(0);
  const lastReportedFrameRef = useRef<number>(1);
  const maxGalleryWidthRef = useRef(3200);
  const windowWidthRef = useRef(typeof window !== "undefined" ? window.innerWidth : 1920);
  const windowHeightRef = useRef(typeof window !== "undefined" ? window.innerHeight : 1080);
  const scrollVelocityRef = useRef(0);
  const maxScrollRef = useRef(1);

  // Redraw/skip guards & cache protection
  const lastDrawnFrameRef = useRef<number>(-1);
  const lastDrawnKeyRef = useRef<string | null>(null);
  const lastDrawnWidthRef = useRef<number>(0);
  const lastDrawnHeightRef = useRef<number>(0);
  const drawFrameToCanvasRef = useRef<((frameFloat: number) => void) | null>(null);

  // Change-gated style write cache (skip identical setProperty calls per frame)
  const lastCssRef = useRef<Record<string, string>>({});
  const isProgrammaticNavRef = useRef(false);
  const targetNavigationFrameRef = useRef<number | null>(null);
  const videoPermanentlyStoppedRef = useRef(false);

  // Simulated scrollback navigation state
  const navSimulationRef = useRef<{
    active: boolean;
    startY: number;
    targetY: number;
    targetFrame: number;
    onComplete?: () => void;
  }>({
    active: false,
    startY: 0,
    targetY: 0,
    targetFrame: 1,
  });
  const onNavigationCompleteRef = useRef(onNavigationComplete);
  const pendingNavRef = useRef<number | null>(null);

  useEffect(() => {
    onNavigationCompleteRef.current = onNavigationComplete;
  }, [onNavigationComplete]);

  // Pack batching state (Track B)
  const noPacksRef = useRef(false);
  const lastBlobPrunePackRef = useRef(-1);
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
  // BOUNDED DISTANCE-BASED BITMAP CACHE PRUNER
  // =========================================================================
  const pruneBitmapCache = useCallback((currentPhysical: number) => {
    const variant = assetVariantRef.current;
    const maxCapacity =
      variant === "mobile_720p"
        ? MAX_BITMAP_CACHE_SIZE_MOBILE
        : variant === "720p"
        ? MAX_BITMAP_CACHE_SIZE_TABLET
        : MAX_BITMAP_CACHE_SIZE_DESKTOP;

    // 1. Evict stale variant bitmaps first
    for (const [key, asset] of bitmapCacheRef.current) {
      if (!key.startsWith(`${variant}:`)) {
        closeAsset(asset);
        bitmapCacheRef.current.delete(key);
      }
    }

    // 2. If within capacity, nothing to prune
    if (bitmapCacheRef.current.size <= maxCapacity) return;

    // 3. Sort entries by distance from currentPhysical (farthest first)
    // CRITICAL: Protect lastDrawnKeyRef.current from eviction so canvas never loses its active texture
    const protectedKey = lastDrawnKeyRef.current;
    const candidates: Array<{ key: string; dist: number }> = [];

    for (const key of bitmapCacheRef.current.keys()) {
      if (key === protectedKey) continue;
      const p = physOfKey(key);
      candidates.push({ key, dist: Math.abs(p - currentPhysical) });
    }

    candidates.sort((a, b) => b.dist - a.dist);

    let excess = bitmapCacheRef.current.size - maxCapacity;
    for (let i = 0; i < candidates.length && excess > 0; i++) {
      const k = candidates[i].key;
      const asset = bitmapCacheRef.current.get(k);
      if (asset) {
        closeAsset(asset);
        bitmapCacheRef.current.delete(k);
        excess--;
      }
    }
  }, []);

  // =========================================================================
  // BOUNDED DISTANCE-BASED BLOB (TIER 1) PRUNER
  // =========================================================================
  // Evicts compressed blobs (and their failure-isolation state) beyond
  // BLOB_EVICT_PACK_RADIUS of the playhead, at pack granularity. Only the
  // active variant's entries are touched — applyVariantSwitch already clears
  // stale-variant state. In-flight frames are safe: their keys are not in the
  // blob cache yet, and a far request that lands afterwards is re-pruned on
  // the next pack crossing. Pack-blocker keys use the `${variant}:pack:${n}`
  // shape, so they are distance-checked on their pack index directly.
  const pruneBlobCache = useCallback((currentPhysical: number) => {
    const variant = assetVariantRef.current;
    const curPack = getPackIndex(currentPhysical);
    const destFrame = targetNavigationFrameRef.current;
    const destPack = destFrame !== null && destFrame !== undefined ? getPackIndex(getPhysicalFrameNumber(destFrame)) : -1;

    const isFar = (phys: number) => {
      const pIdx = getPackIndex(phys);
      if (destPack >= 0 && Math.abs(pIdx - destPack) <= 1) return false;
      return Math.abs(pIdx - curPack) > BLOB_EVICT_PACK_RADIUS;
    };

    for (const key of blobCacheRef.current.keys()) {
      const colon = key.indexOf(":");
      if (key.slice(0, colon) !== variant) continue;
      if (isFar(physOfKey(key))) {
        blobCacheRef.current.delete(key);
        stats.blobEvictions++;
      }
    }

    for (const key of blockedKeysRef.current.keys()) {
      const colon = key.indexOf(":");
      if (key.slice(0, colon) !== variant || isFar(physOfKey(key))) {
        blockedKeysRef.current.delete(key);
      }
    }

    for (const key of badDecodeRef.current.keys()) {
      const colon = key.indexOf(":");
      if (key.slice(0, colon) !== variant || isFar(physOfKey(key))) {
        badDecodeRef.current.delete(key);
      }
    }

    for (const key of blockedPacksRef.current.keys()) {
      const pIdx = parseInt(key.slice(key.lastIndexOf(":") + 1), 10);
      if (
        !key.startsWith(`${variant}:pack:`) ||
        Math.abs(pIdx - curPack) > BLOB_EVICT_PACK_RADIUS
      ) {
        blockedPacksRef.current.delete(key);
      }
    }
  }, []);

  const pumpDecodeQueueRef = useRef<() => void>(() => {});

  const pumpDecodeQueue = useCallback(() => {
    const isMobile = assetVariantRef.current === "mobile_720p";
    const maxDecodes = isMobile ? Math.min(4, getDecodeConcurrency()) : getDecodeConcurrency();
    while (decodeInflightRef.current.size < maxDecodes && decodeQueueRef.current.length > 0) {
      const key = decodeQueueRef.current.shift()!;
      decodeQueuedRef.current.delete(key);

      const colon = key.indexOf(":");
      const variant = key.slice(0, colon);
      const phys = physOfKey(key);

      // Drop stale queue entries (variant flipped, or playhead moved far past > 60 frames)
      if (variant !== assetVariantRef.current) {
        stats.decodeDrops++;
        continue;
      }
      const curPhys = getPhysicalFrameNumber(currentFrameRef.current);
      if (Math.abs(phys - curPhys) > 60) {
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
            if (variant === assetVariantRef.current) {
              bitmapCacheRef.current.set(key, asset);
              pruneBitmapCache(cur);

              // Immediate redraw: if decoded frame is close to playhead or canvas hasn't drawn
              const distToCur = Math.abs(phys - cur);
              if (distToCur <= 8 || lastDrawnFrameRef.current === -1) {
                lastDrawnFrameRef.current = -1; // force redraw
                drawFrameToCanvasRef.current?.(currentFrameRef.current);
              }
            } else {
              closeAsset(asset); // stale variant completion — release immediately
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
  }, [pruneBitmapCache]);

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
          // Preempt distant in-flight packs when urgent queue is saturated
          const curPhys = getPhysicalFrameNumber(currentFrameRef.current);
          const curPack = getPackIndex(curPhys);
          const destFrame = targetNavigationFrameRef.current;
          const destPack = destFrame !== null && destFrame !== undefined ? getPackIndex(getPhysicalFrameNumber(destFrame)) : -1;

          for (const entry of packInflightRef.current.values()) {
            if (entry.packIndex !== destPack && Math.abs(entry.packIndex - curPack) > 4) {
              entry.controller.abort();
            }
          }
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
            const decodeHorizon = getDecodeForward(variant) + DECODE_BACK;
            for (let f = start; f <= end; f++) {
              if (Math.abs(f - curPhys) <= decodeHorizon) {
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
      const absVel = Math.abs(velocity);

      const isMobile = variant === "mobile_720p";
      const lookaheadForward = isMobile ? 40 : LOOKAHEAD_FORWARD;

      // 1) Prune decoded bitmaps via bounded distance-based capacity
      pruneBitmapCache(targetPhysical);

      // 1b) Prune Tier-1 blobs beyond the sliding window (throttled to pack
      // crossings so the map scan runs once per 16 frames, not per frame)
      const curPackIdx = getPackIndex(targetPhysical);
      if (curPackIdx !== lastBlobPrunePackRef.current) {
        lastBlobPrunePackRef.current = curPackIdx;
        pruneBlobCache(targetPhysical);
      }

      // 2) Stale decode queue flush during fast movement:
      // Drop queued decodes that are behind the playhead along the direction of travel
      if (absVel >= 15 && decodeQueueRef.current.length > 0) {
        const filtered: string[] = [];
        for (const qKey of decodeQueueRef.current) {
          const qPhys = physOfKey(qKey);
          const isBehind = dir > 0 ? qPhys < targetPhysical - 2 : qPhys > targetPhysical + 2;
          if (isBehind) {
            decodeQueuedRef.current.delete(qKey);
            stats.decodeDrops++;
          } else {
            filtered.push(qKey);
          }
        }
        decodeQueueRef.current = filtered;
      }

      // 3) Decode scheduling: Velocity-adjusted stride and projected lookahead
      // JIT target frame first (jump queue to front)
      enqueueDecode(`${variant}:${targetPhysical}`, true);

      if (absVel < 15) {
        // Low velocity / normal reading: decode dense contiguous corridor
        const decodeFwd = getDecodeForward(variant);
        const decodeBack = DECODE_BACK;
        for (let p = Math.max(1, targetPhysical - decodeBack); p <= Math.min(TOTAL_PHYSICAL_FRAMES, targetPhysical + decodeFwd); p++) {
          if (p !== targetPhysical) enqueueDecode(`${variant}:${p}`);
        }
        // Also enqueue stride anchors ahead [t+4, t+8, t+16]
        for (const s of [4, 8, 16]) {
          const anchorP = targetPhysical + s * dir;
          if (anchorP >= 1 && anchorP <= TOTAL_PHYSICAL_FRAMES) {
            enqueueDecode(`${variant}:${anchorP}`);
          }
        }
      } else {
        // High velocity / fast fling: calculate stride and projected lookahead
        const stride = absVel >= 200 ? 8 : absVel >= 80 ? 4 : 2;
        const projectedVirtual = Math.min(
          TOTAL_FRAMES,
          Math.max(1, Math.round(centerVirtual + velocity * 0.08))
        );
        const projectedPhysical = getPhysicalFrameNumber(projectedVirtual);
        const maxDistAhead = Math.max(isMobile ? 32 : 48, Math.abs(projectedPhysical - targetPhysical) + 16);

        // Reverse safety anchors in case user stops or reverses
        for (const s of [2, 4]) {
          const revP = targetPhysical - s * dir;
          if (revP >= 1 && revP <= TOTAL_PHYSICAL_FRAMES) {
            enqueueDecode(`${variant}:${revP}`);
          }
        }

        // Stride corridor ahead in direction of travel
        for (let step = stride; step <= maxDistAhead; step += stride) {
          const fwdP = targetPhysical + step * dir;
          if (fwdP >= 1 && fwdP <= TOTAL_PHYSICAL_FRAMES) {
            enqueueDecode(`${variant}:${fwdP}`);
          }
        }

        // Also enqueue immediate adjacent frames [targetPhysical + dir, targetPhysical + 2*dir]
        for (const off of [1, 2]) {
          const adjP = targetPhysical + off * dir;
          if (adjP >= 1 && adjP <= TOTAL_PHYSICAL_FRAMES) {
            enqueueDecode(`${variant}:${adjP}`);
          }
        }
      }

      // 4) Coarse-first fetch order: stride anchors land first so cold jumps
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
      const fwdLook = isForward ? lookaheadForward : LOOKAHEAD_BACKWARD;
      for (let i = 1; i <= fwdLook; i++) pushVirtual(centerVirtual + i * dir); // dense fill ahead
      const backLook = isForward ? LOOKAHEAD_BACKWARD : lookaheadForward;
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
    [dispatchFetch, dispatchPackFetch, enqueueDecode, pruneBitmapCache, pruneBlobCache]
  );

  // =========================================================================
  // BACKGROUND IDLE STREAMER (bounded sliding window)
  // =========================================================================
  // Quietly warms packs within BLOB_WARM_PACK_RADIUS of the playhead when the
  // user is idle (urgent pipeline empty, no active fling). It no longer
  // accumulates all 840 compressed frames — pruneBlobCache keeps Tier 1
  // bounded, and evicted packs re-fetch from the browser disk cache
  // (immutable CDN headers + force-cache) when the playhead returns.
  const scheduleIdleStream = useCallback(() => {
    if (idleHandleRef.current !== null) return;
    if (urgentCountRef.current > 0 || urgentPackCountRef.current > 0) return;

    // Pre-warm the events and team packs quietly during idle periods
    loadEventsPack().catch(() => {});
    loadTeamPack().catch(() => {});

    idleHandleRef.current = requestIdle(() => {
      idleHandleRef.current = null;
      if (
        urgentCountRef.current > 0 ||
        urgentPackCountRef.current > 0 ||
        Math.abs(scrollVelocityRef.current) > 2
      ) {
        return;
      }

      const variant = assetVariantRef.current;
      const curPhys = getPhysicalFrameNumber(currentFrameRef.current);
      const warmRadiusFrames = BLOB_WARM_PACK_RADIUS * FRAMES_PER_PACK;
      let dispatched = 0;

      if (noPacksRef.current) {
        // Per-frame mode: warm the same sliding window frame by frame
        const warmFwd = Math.min(TOTAL_PHYSICAL_FRAMES, curPhys + warmRadiusFrames);
        for (let f = curPhys; f <= warmFwd && dispatched < MAX_IDLE_CONCURRENT; f++) {
          if (dispatchFetch(f, "idle")) dispatched++;
        }
        if (dispatched < MAX_IDLE_CONCURRENT) {
          const warmBack = Math.max(1, curPhys - warmRadiusFrames);
          for (let f = curPhys - 1; f >= warmBack && dispatched < MAX_IDLE_CONCURRENT; f--) {
            if (dispatchFetch(f, "idle")) dispatched++;
          }
        }
      } else {
        const curPack = getPackIndex(curPhys);
        const warmLo = Math.max(0, curPack - BLOB_WARM_PACK_RADIUS);
        const warmHi = Math.min(TOTAL_PACKS - 1, curPack + BLOB_WARM_PACK_RADIUS);
        const isPackNeeded = (pIdx: number) => {
          const { start, end } = getPackFrameRange(pIdx);
          for (let f = start; f <= end; f++) {
            if (!blobCacheRef.current.has(`${variant}:${f}`)) return true;
          }
          return false;
        };

        for (let p = curPack; p <= warmHi && dispatched < MAX_IDLE_PACK_CONCURRENT; p++) {
          if (isPackNeeded(p)) {
            if (dispatchPackFetch(p, "idle")) dispatched++;
          }
        }
        if (dispatched < MAX_IDLE_PACK_CONCURRENT) {
          for (let p = curPack - 1; p >= warmLo && dispatched < MAX_IDLE_PACK_CONCURRENT; p--) {
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
      // Ultimate safety fallback: keep showing the last drawn frame instead of dropping to blank
      if (!drawKey && lastDrawnKeyRef.current && bitmapCacheRef.current.has(lastDrawnKeyRef.current)) {
        drawKey = lastDrawnKeyRef.current;
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

      let ctx = ctxRef.current;
      if (canvas.width !== targetWidth || canvas.height !== targetHeight || !ctx) {
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        if (!ctx) {
          ctx = canvas.getContext("2d", {
            alpha: false,
            desynchronized: true, // low-latency direct compositor hint for 120Hz displays
          }) as CanvasRenderingContext2D | null;
          ctxRef.current = ctx;
        }
        if (ctx) {
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "medium";
        }
      }
      if (!ctx) return;

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
      try {
        ctx.drawImage(asset, offsetX, offsetY, drawW, drawH);

        stats.drawn++;
        lastDrawnKeyRef.current = drawKey;
        lastDrawnFrameRef.current = physOfKey(drawKey);
        lastDrawnWidthRef.current = width;
        lastDrawnHeightRef.current = height;
      } catch (err) {
        // If an asset was closed or detached, evict from cache to prevent crash and allow re-decode
        if (drawKey) {
          bitmapCacheRef.current.delete(drawKey);
        }
      }
    },
    [enqueueDecode, findNearestLoadedKey]
  );

  useEffect(() => {
    drawFrameToCanvasRef.current = drawFrameToCanvas;
  }, [drawFrameToCanvas]);

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
      lastBlobPrunePackRef.current = -1; // force a fresh prune pass for the new variant
      lastDrawnKeyRef.current = null;
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
      lastDrawnKeyRef.current = null;
      lastBlobPrunePackRef.current = -1;
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
  // SIMULATED SCROLLBACK DRIVER
  // =========================================================================
  const startSimulatedNavigation = useCallback(
    (targetFrame: number, onDone?: () => void) => {
      const target = Math.min(TOTAL_FRAMES, Math.max(1, targetFrame));
      const targetProgress = (target - 1) / (TOTAL_FRAMES - 1);
      const targetScrollY = targetProgress * maxScrollRef.current;

      if (!lenisRef.current) {
        pendingNavRef.current = target;
        return;
      }

      const currentScroll = lenisRef.current.scroll;

      // If already at or within snapping distance of destination
      if (Math.abs(targetScrollY - currentScroll) < 5) {
        navSimulationRef.current.active = false;
        isProgrammaticNavRef.current = false;
        targetNavigationFrameRef.current = null;
        lastReportedFrameRef.current = target;
        setCurrentFrame(target);
        if (onFrameUpdate) {
          onFrameUpdate(target);
        }
        if (onDone) {
          onDone();
        }
        return;
      }

      const prefersReduced =
        typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (prefersReduced) {
        lenisRef.current.scrollTo(targetScrollY, { immediate: true, programmatic: true });
        navSimulationRef.current.active = false;
        isProgrammaticNavRef.current = false;
        targetNavigationFrameRef.current = null;
        lastReportedFrameRef.current = target;
        setCurrentFrame(target);
        if (onFrameUpdate) {
          onFrameUpdate(target);
        }
        if (onDone) {
          onDone();
        }
        return;
      }

      isProgrammaticNavRef.current = true;
      targetNavigationFrameRef.current = target;
      navSimulationRef.current = {
        active: true,
        startY: currentScroll,
        targetY: targetScrollY,
        targetFrame: target,
        onComplete: onDone,
      };
    },
    [onFrameUpdate]
  );
  const startSimulatedNavigationRef = useRef(startSimulatedNavigation);
  useEffect(() => {
    startSimulatedNavigationRef.current = startSimulatedNavigation;
  }, [startSimulatedNavigation]);

  // =========================================================================
  // MAIN SCROLL ENGINE (single RAF loop, cached maxScroll, gated style writes)
  // =========================================================================
  useEffect(() => {
    if (!isReady) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isTouch = typeof window !== "undefined" && ("ontouchstart" in window || navigator.maxTouchPoints > 0);

    // Speed Limiter Configuration
    // Calibrated so fast flings cruise at a safe, smooth speed limit without skipping decodes or causing memory spikes
    const maxDeltaPerEvent = isTouch ? 55 : 85;
    const maxScrollLead = isTouch ? 200 : 300;
    const maxInputSpeed = isTouch ? 1500 : 2200; // px/sec

    let lastInputTime = performance.now();

    const handleVirtualScroll = (data: { deltaX: number; deltaY: number; event: WheelEvent | TouchEvent }): boolean => {
      // Horizontal or zero-delta events are unconstrained
      if (Math.abs(data.deltaY) < 0.001) return true;

      // Cancel simulated navigation if active so user manual gesture takes over immediately
      if (navSimulationRef.current.active) {
        navSimulationRef.current.active = false;
        isProgrammaticNavRef.current = false;
        targetNavigationFrameRef.current = null;
        if (onNavigationCompleteRef.current) {
          onNavigationCompleteRef.current();
        }
      }

      const now = performance.now();
      const dt = Math.max(0.001, (now - lastInputTime) / 1000);
      lastInputTime = now;

      // 1. Clamp single-event spike (prevents violent wheel/trackpad flick spikes)
      let dy = Math.sign(data.deltaY) * Math.min(Math.abs(data.deltaY), maxDeltaPerEvent);

      // 2. Velocity rate limiter based on gesture arrival rate
      const maxDeltaForDt = maxInputSpeed * dt;
      if (Math.abs(dy) > maxDeltaForDt) {
        dy = Math.sign(dy) * Math.max(8, maxDeltaForDt);
      }

      // 3. Scroll lead limiter: prevent queuing up runaway distance ahead of current playhead
      if (lenisRef.current) {
        const animated = lenisRef.current.animatedScroll;
        const target = lenisRef.current.targetScroll;
        const currentLead = target - animated;

        // If scrolling in same direction as current lead, enforce maximum lead buffer
        if (dy > 0 && currentLead >= 0) {
          const headroom = maxScrollLead - currentLead;
          if (headroom <= 0.5) {
            data.deltaY = 0;
            return false; // Saturated speed limit: drop excess wheel momentum
          }
          dy = Math.min(dy, headroom);
        } else if (dy < 0 && currentLead <= 0) {
          const headroom = -maxScrollLead - currentLead;
          if (headroom >= -0.5) {
            data.deltaY = 0;
            return false;
          }
          dy = Math.max(dy, headroom);
        }
        // If scrolling opposite direction (user reversed scroll), allow immediately!
      }

      data.deltaY = dy;
      return true;
    };

    const lenis = new Lenis({
      duration: prefersReducedMotion ? 0 : isTouch ? 0.75 : 0.9,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -7 * t)),
      orientation: "vertical",
      gestureOrientation: "vertical",
      smoothWheel: true,
      wheelMultiplier: 1.0,
      touchMultiplier: isTouch ? 1.0 : 1.2,
      syncTouch: isTouch,
      syncTouchLerp: 0.08,
      touchInertiaExponent: 1.1,
      infinite: false,
      virtualScroll: handleVirtualScroll,
    });

    // Guard non-programmatic scrollTo targets so touch-inertia or any internal source cannot exceed maxScrollLead
    const originalScrollTo = lenis.scrollTo.bind(lenis);
    lenis.scrollTo = (target: number | string | HTMLElement, options?: Parameters<typeof originalScrollTo>[1]) => {
      if (options?.programmatic === false && typeof target === "number") {
        const current = lenis.animatedScroll;
        const lead = target - current;
        if (Math.abs(lead) > maxScrollLead) {
          target = current + Math.sign(lead) * maxScrollLead;
        }
      }
      return originalScrollTo(target, options);
    };

    lenisRef.current = lenis;

    // Flush any pending navigation requested before Lenis was ready
    if (pendingNavRef.current !== null) {
      const pending = pendingNavRef.current;
      pendingNavRef.current = null;
      startSimulatedNavigationRef.current(pending, onNavigationCompleteRef.current);
    }

    const handleUserInterruption = () => {
      if (navSimulationRef.current.active) {
        navSimulationRef.current.active = false;
        isProgrammaticNavRef.current = false;
        targetNavigationFrameRef.current = null;
        if (onNavigationCompleteRef.current) {
          onNavigationCompleteRef.current();
        }
      }
    };

    window.addEventListener("wheel", handleUserInterruption, { passive: true });
    window.addEventListener("touchstart", handleUserInterruption, { passive: true });
    window.addEventListener("keydown", handleUserInterruption, { passive: true });

    let animFrameId: number;
    let debugInterval: ReturnType<typeof setInterval> | null = null;

    const debugParams = new URLSearchParams(window.location.search);
    if (debugParams.has("debug") || debugParams.has("mem")) {
      debugInterval = setInterval(() => {
        // Resident-memory estimates for the two frame caches (KPI for the
        // RAM budget work: blobs = compressed Tier 1, bitmaps = decoded Tier 2)
        let blobBytes = 0;
        for (const b of blobCacheRef.current.values()) blobBytes += b.size;
        let bitmapBytes = 0;
        for (const key of bitmapCacheRef.current.keys()) {
          const v = key.slice(0, key.indexOf(":"));
          bitmapBytes += v === "1080p" ? 1920 * 1080 * 4 : v === "720p" ? 1280 * 720 * 4 : 404 * 720 * 4;
        }
        const entry: Record<string, unknown> = {
          ...stats,
          urgent: urgentCountRef.current,
          idle: idleCountRef.current,
          urgentPacks: urgentPackCountRef.current,
          idlePacks: idlePackCountRef.current,
          blobs: blobCacheRef.current.size,
          bitmaps: bitmapCacheRef.current.size,
          blobMB: (blobBytes / 1048576).toFixed(1),
          bitmapMB: (bitmapBytes / 1048576).toFixed(1),
          blocked: blockedKeysRef.current.size,
          blockedPacks: blockedPacksRef.current.size,
          endpointPaused: Date.now() < endpointGuardRef.current.pausedUntil,
        };
        if (debugParams.has("mem")) {
          const mem = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
          if (mem) entry.jsHeapMB = (mem.usedJSHeapSize / 1048576).toFixed(1);
        }
        console.log("[frameStats]", entry);
      }, 5000);
    }

    const setVar = (container: HTMLElement, name: string, value: string) => {
      if (lastCssRef.current[name] !== value) {
        lastCssRef.current[name] = value;
        container.style.setProperty(name, value);
      }
    };

    const renderLoop = (time: number) => {
      const now = performance.now();
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTimeRef.current) / 1000));
      lastTimeRef.current = now;

      // Simulated scroll driver for button clicks / programmatic navigation
      if (navSimulationRef.current.active && lenisRef.current) {
        const sim = navSimulationRef.current;
        const currentScroll = lenis.scroll;
        const distRemaining = sim.targetY - currentScroll;
        const absDist = Math.abs(distRemaining);

        if (absDist < 4) {
          lenis.scrollTo(sim.targetY, { immediate: true, programmatic: true });
          const finalFrame = sim.targetFrame;
          const onCompleteCb = sim.onComplete;
          sim.active = false;
          isProgrammaticNavRef.current = false;
          targetNavigationFrameRef.current = null;
          lastReportedFrameRef.current = finalFrame;
          setCurrentFrame(finalFrame);
          if (onFrameUpdate) {
            onFrameUpdate(finalFrame);
          }
          if (onCompleteCb) {
            onCompleteCb();
          }
        } else {
          const isTouchDevice = typeof window !== "undefined" && ("ontouchstart" in window || navigator.maxTouchPoints > 0);
          const maxSpeed = isTouchDevice ? 1600 : 2600; // px/sec, conforms to playhead frame governor
          const distTraveled = Math.abs(currentScroll - sim.startY);

          // Smooth ramp-up from start (over first 350px)
          const easeIn = Math.max(0.2, Math.min(1, Math.sqrt(distTraveled / 350)));
          // Smooth deceleration into target (over final 500px)
          const easeOut = Math.max(0.15, Math.min(1, Math.sqrt(absDist / 500)));

          const currentSpeed = maxSpeed * Math.min(easeIn, easeOut);
          const step = Math.min(absDist, Math.max(2, currentSpeed * dt));
          const nextScroll = currentScroll + Math.sign(distRemaining) * step;

          lenis.scrollTo(nextScroll, { immediate: true, programmatic: true });
        }
      }

      lenis.raf(time);

      const scrollY = lenis.scroll;
      const maxScroll = maxScrollRef.current; // cached — no per-frame layout read
      const progress = maxScroll > 0 ? Math.min(1, Math.max(0, scrollY / maxScroll)) : 0;

      const targetFloat = 1 + progress * (TOTAL_FRAMES - 1);
      const prevFloat = currentFrameRef.current;

      // Playhead governor: ensure visual frame advancement never exceeds safe decoding rate
      let renderFloat: number;
      if (prefersReducedMotion) {
        renderFloat = targetFloat;
      } else {
        const deltaFloat = targetFloat - prevFloat;
        const maxFrameSpeed = isTouch ? 160 : 250; // max frames per second
        const maxDeltaFloat = maxFrameSpeed * dt;
        if (Math.abs(deltaFloat) > maxDeltaFloat) {
          renderFloat = prevFloat + Math.sign(deltaFloat) * maxDeltaFloat;
        } else {
          renderFloat = targetFloat;
        }
      }

      currentFrameRef.current = renderFloat;

      const rawVelocity = (renderFloat - prevFloat) / dt;
      // Exponential moving average for 120Hz velocity stabilization (filters 8ms RAF jitter)
      const velocity = Math.abs(rawVelocity) < 0.05
        ? 0
        : scrollVelocityRef.current * 0.6 + rawVelocity * 0.4;
      scrollVelocityRef.current = velocity;

      // Priority scheduler: execute immediately when the integer frame advances at normal speed,
      // but throttle during fast movement/rewinds (every 40ms or 6 frames)
      // to avoid allocating Sets/arrays and triggering redundant pack fetches 120 times/sec.
      const currentInt = Math.floor(renderFloat);
      const isIntegerAdvanced = currentInt !== lastScheduledIntegerRef.current;
      const timeSinceLastSchedule = now - lastScheduleTimeRef.current;
      const isFast = Math.abs(velocity) > 15;
      const shouldSchedule = isFast
        ? timeSinceLastSchedule >= 40 || Math.abs(currentInt - lastScheduledIntegerRef.current) >= 6
        : isIntegerAdvanced;

      if (shouldSchedule) {
        lastScheduledIntegerRef.current = currentInt;
        lastScheduleTimeRef.current = now;
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
      window.removeEventListener("wheel", handleUserInterruption);
      window.removeEventListener("touchstart", handleUserInterruption);
      window.removeEventListener("keydown", handleUserInterruption);
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

  // Respond to programmatic header navigation via simulated normal scrollback
  useEffect(() => {
    if (targetNavigationFrame !== null && targetNavigationFrame !== undefined) {
      startSimulatedNavigation(targetNavigationFrame, () => {
        if (onNavigationComplete) {
          onNavigationComplete();
        }
      });
    }
  }, [targetNavigationFrame, startSimulatedNavigation, onNavigationComplete]);

  const handleExploreEvents = useCallback(() => {
    startSimulatedNavigation(630);
  }, [startSimulatedNavigation]);

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
          className="absolute inset-0 w-full h-full object-cover z-0 transform-gpu will-change-transform"
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
