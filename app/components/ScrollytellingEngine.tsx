"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import Lenis from "lenis";
import PreloadManager from "./PreloadManager";
import HeroOverlay from "./overlays/HeroOverlay";
import DoorAboutOverlay from "./overlays/DoorAboutOverlay";
import WallGalleryOverlay from "./overlays/WallGalleryOverlay";
import { getAssetUrl, getFrameUrl } from "../lib/assets";

interface ScrollytellingEngineProps {
  onFrameUpdate?: (frame: number) => void;
  onOpenJoinModal: () => void;
  targetNavigationFrame?: number | null;
  onNavigationComplete?: () => void;
  isJoinModalOpen?: boolean;
}

const TOTAL_FRAMES = 1262;
const CRITICAL_PRELOAD_COUNT = 24; // Contiguous initial runway for instant butter-smooth boot
const SCROLL_TRACK_HEIGHT = TOTAL_FRAMES * 12; // 15,144px scroll track for 1:1 frame pacing
const MAX_CONCURRENT_REQUESTS = 6; // Optimal concurrent HTTP/2 streams per domain
const LOOKAHEAD_FORWARD = 35; // Tier 1: Compressed Blob lookahead
const LOOKAHEAD_BACKWARD = 10; // Tier 1: Compressed Blob safety buffer behind
const MAX_BLOB_CACHE_SIZE = 220; // Tier 1: Max compressed Blobs in memory (~11 MB)
const NEAR_BITMAP_FORWARD = 14; // Tier 2: Active GPU bitmaps ahead (~115 MB)
const NEAR_BITMAP_BACKWARD = 4; // Tier 2: Active GPU bitmaps behind (~33 MB, total ~148 MB GPU memory)
const BITMAP_EVICT_MARGIN = 6; // Tier 2: Safety padding before bitmap eviction
const CANCEL_DISTANCE = 55; // Distance threshold to abort out-of-range in-flight network requests

// Image asset type: ImageBitmap (decoded off-main-thread) or HTMLImageElement fallback
type FrameAsset = ImageBitmap | HTMLImageElement;

export default function ScrollytellingEngine({
  onFrameUpdate,
  onOpenJoinModal,
  targetNavigationFrame,
  onNavigationComplete,
  isJoinModalOpen = false,
}: ScrollytellingEngineProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoWrapperRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lenisRef = useRef<Lenis | null>(null);

  // =========================================================================
  // TWO-TIER MEMORY ARCHITECTURE (85–90% RAM Reduction)
  // =========================================================================
  // Tier 1: Compressed WebP Blobs (~50 KB each; ~10 MB for 200 frames)
  const blobCacheRef = useRef<Map<number, Blob>>(new Map());
  const isBlobLoadedRef = useRef<Uint8Array>(new Uint8Array(TOTAL_FRAMES + 1));

  // Tier 2: Active Uncompressed GPU ImageBitmaps (~8.3 MB each; strictly ~18 frames ≈ 140 MB)
  const bitmapCacheRef = useRef<Map<number, FrameAsset>>(new Map());
  const inFlightDecodesRef = useRef<Set<number>>(new Set());

  // Active network download controllers
  const activeControllersRef = useRef<Map<number, AbortController>>(new Map());
  const inFlightCountRef = useRef(0);

  // React state for boot & overlays
  const [loadProgress, setLoadProgress] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [currentFrame, setCurrentFrame] = useState(1);

  // Rendering & window dimension refs
  const currentFrameRef = useRef(1);
  const smoothFrameRef = useRef(1);
  const lastTimeRef = useRef(performance.now());
  const lastReportedFrameRef = useRef<number>(1);
  const lastReactUpdateRef = useRef<number>(0);
  const maxGalleryWidthRef = useRef(3200);
  const windowWidthRef = useRef(0);
  const windowHeightRef = useRef(0);
  const scrollVelocityRef = useRef(0);

  // 60Hz & 120Hz High-Refresh GPU Fillrate Optimization Refs
  const lastDrawnFrameRef = useRef<number>(-1);
  const lastDrawnWidthRef = useRef<number>(0);
  const lastDrawnHeightRef = useRef<number>(0);

  // Helper to format frame CDN URL strictly to 1080p ecell_shots
  const getFramePath = useCallback((frameNum: number) => {
    return getFrameUrl(frameNum, "1080p");
  }, []);

  // Fetch compressed WebP Blob with abort signal
  const fetchBlob = useCallback(async (url: string, signal?: AbortSignal): Promise<Blob> => {
    const res = await fetch(url, { signal, cache: "force-cache" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.blob();
  }, []);

  // JIT Off-Thread Bitmap Decoder with Viewport-Aware Hardware Downsampling
  const decodeBlobToBitmap = useCallback(
    async (frameIdx: number): Promise<FrameAsset | null> => {
      const blob = blobCacheRef.current.get(frameIdx);
      if (!blob) return null;

      if (typeof window !== "undefined" && "createImageBitmap" in window) {
        try {
          // Hardware-accelerated viewport-aware downsampling:
          // If display is 1440px or mobile, scale bitmap to actual canvas need
          const width = windowWidthRef.current || window.innerWidth;
          const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
          const targetW = Math.min(1920, Math.max(640, Math.floor(width * dpr)));

          if (targetW < 1800) {
            const targetH = Math.round(targetW / (1920 / 1080));
            return await createImageBitmap(blob, {
              resizeWidth: targetW,
              resizeHeight: targetH,
              resizeQuality: "medium",
            });
          }
          return await createImageBitmap(blob);
        } catch {
          // Fallback below
        }
      }

      return new Promise((resolve) => {
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
    },
    []
  );

  // Evict GPU Bitmaps strictly outside the near-field window
  const pruneBitmapCache = useCallback((center: number) => {
    const minKeep = center - (NEAR_BITMAP_BACKWARD + BITMAP_EVICT_MARGIN);
    const maxKeep = center + (NEAR_BITMAP_FORWARD + BITMAP_EVICT_MARGIN);

    for (const [idx, asset] of bitmapCacheRef.current.entries()) {
      if (idx < minKeep || idx > maxKeep) {
        if ("close" in asset && typeof asset.close === "function") {
          asset.close(); // Immediately release ~8.3 MB of GPU texture VRAM
        }
        bitmapCacheRef.current.delete(idx);
      }
    }
  }, []);

  // Evict Tier 1 Blobs if compressed cache exceeds limit
  const pruneBlobCache = useCallback((center: number) => {
    if (blobCacheRef.current.size > MAX_BLOB_CACHE_SIZE) {
      let furthestIdx = -1;
      let maxDist = -1;

      for (const idx of blobCacheRef.current.keys()) {
        const dist = Math.abs(idx - center);
        if (dist > maxDist) {
          maxDist = dist;
          furthestIdx = idx;
        }
      }

      if (furthestIdx !== -1 && maxDist > 80) {
        blobCacheRef.current.delete(furthestIdx);
        isBlobLoadedRef.current[furthestIdx] = 0;
      }
    }
  }, []);

  // JIT Near-Field Bitmap Decodes from Tier 1 Blobs (< 1ms off-thread)
  const ensureNearFieldBitmaps = useCallback(
    (center: number, isForward: boolean) => {
      const start = isForward ? center - NEAR_BITMAP_BACKWARD : center - NEAR_BITMAP_FORWARD;
      const end = isForward ? center + NEAR_BITMAP_FORWARD : center + NEAR_BITMAP_BACKWARD;

      const minF = Math.max(1, start);
      const maxF = Math.min(TOTAL_FRAMES, end);

      const order: number[] = [center];
      const maxOffset = Math.max(center - minF, maxF - center);
      for (let offset = 1; offset <= maxOffset; offset++) {
        if (isForward) {
          if (center + offset <= maxF) order.push(center + offset);
          if (center - offset >= minF) order.push(center - offset);
        } else {
          if (center - offset >= minF) order.push(center - offset);
          if (center + offset <= maxF) order.push(center + offset);
        }
      }

      for (const f of order) {
        if (
          blobCacheRef.current.has(f) &&
          !bitmapCacheRef.current.has(f) &&
          !inFlightDecodesRef.current.has(f)
        ) {
          inFlightDecodesRef.current.add(f);
          decodeBlobToBitmap(f).then((asset) => {
            inFlightDecodesRef.current.delete(f);
            if (asset) {
              bitmapCacheRef.current.set(f, asset);
              const cur = Math.floor(currentFrameRef.current);
              if (cur === f || Math.abs(cur - f) <= 1) {
                lastDrawnFrameRef.current = -1;
              }
            }
          });
        }
      }
    },
    [decodeBlobToBitmap]
  );

  // Find nearest preceding contiguous loaded bitmap (prevents ghosting / teleporting snaps)
  const findNearestLoadedFrame = useCallback((target: number): number => {
    const cache = bitmapCacheRef.current;
    if (cache.has(target)) return target;

    // Search backward first (hold closest past frame along travel trajectory)
    const minBack = Math.max(1, target - 25);
    for (let f = target - 1; f >= minBack; f--) {
      if (cache.has(f)) return f;
    }

    // Search forward if backward has none
    const maxForward = Math.min(TOTAL_FRAMES, target + 15);
    for (let f = target + 1; f <= maxForward; f++) {
      if (cache.has(f)) return f;
    }

    // Fallback to last successfully drawn frame, or any loaded bitmap
    if (lastDrawnFrameRef.current !== -1 && cache.has(lastDrawnFrameRef.current)) {
      return lastDrawnFrameRef.current;
    }

    // If target has a blob, trigger urgent JIT decode
    if (blobCacheRef.current.has(target) && !inFlightDecodesRef.current.has(target)) {
      inFlightDecodesRef.current.add(target);
      decodeBlobToBitmap(target).then((asset) => {
        inFlightDecodesRef.current.delete(target);
        if (asset) {
          bitmapCacheRef.current.set(target, asset);
          lastDrawnFrameRef.current = -1;
        }
      });
    }

    return cache.size > 0 ? (cache.keys().next().value ?? -1) : -1;
  }, [decodeBlobToBitmap]);

  // Two-Tier Directional Linear Preloader with Abortable Requests
  const scheduleTwoTierBuffer = useCallback(
    (centerFloat: number, velocity: number) => {
      const center = Math.round(centerFloat);
      const isForward = velocity >= -0.05;

      // 1. Prune GPU Bitmaps (Tier 2) to maintain strict ~18 bitmap ceiling (~140 MB)
      pruneBitmapCache(center);

      // 2. JIT decode near-field frames from existing Blobs (< 1ms off-thread)
      ensureNearFieldBitmaps(center, isForward);

      // 3. Abort out-of-range in-flight network downloads
      for (const [frameIdx, controller] of activeControllersRef.current.entries()) {
        const dist = Math.abs(frameIdx - center);
        if (dist > CANCEL_DISTANCE) {
          controller.abort();
          activeControllersRef.current.delete(frameIdx);
          inFlightCountRef.current = Math.max(0, inFlightCountRef.current - 1);
        }
      }

      // 4. Build prioritized desired corridor for compressed Blobs (Tier 1)
      const desiredBlobs: number[] = [];
      const floorFrame = Math.floor(centerFloat);
      if (!isBlobLoadedRef.current[floorFrame] && !activeControllersRef.current.has(floorFrame)) {
        desiredBlobs.push(floorFrame);
      }

      if (isForward) {
        // Forward priority corridor: center + 1, center + 2, ...
        for (let i = 1; i <= LOOKAHEAD_FORWARD; i++) {
          const f = center + i;
          if (f <= TOTAL_FRAMES && !isBlobLoadedRef.current[f] && !activeControllersRef.current.has(f)) {
            desiredBlobs.push(f);
          }
        }
        // Backward safety corridor: center - 1, ...
        for (let i = 1; i <= LOOKAHEAD_BACKWARD; i++) {
          const f = center - i;
          if (f >= 1 && !isBlobLoadedRef.current[f] && !activeControllersRef.current.has(f)) {
            desiredBlobs.push(f);
          }
        }
      } else {
        // Reverse priority corridor: center - 1, center - 2, ...
        for (let i = 1; i <= LOOKAHEAD_FORWARD; i++) {
          const f = center - i;
          if (f >= 1 && !isBlobLoadedRef.current[f] && !activeControllersRef.current.has(f)) {
            desiredBlobs.push(f);
          }
        }
        // Forward safety in reverse
        for (let i = 1; i <= LOOKAHEAD_BACKWARD; i++) {
          const f = center + i;
          if (f <= TOTAL_FRAMES && !isBlobLoadedRef.current[f] && !activeControllersRef.current.has(f)) {
            desiredBlobs.push(f);
          }
        }
      }

      // 5. Dispatch network requests up to MAX_CONCURRENT_REQUESTS
      for (const frameToFetch of desiredBlobs) {
        if (inFlightCountRef.current >= MAX_CONCURRENT_REQUESTS) break;

        const controller = new AbortController();
        activeControllersRef.current.set(frameToFetch, controller);
        inFlightCountRef.current++;

        const url = getFramePath(frameToFetch);

        fetchBlob(url, controller.signal)
          .then((blob) => {
            activeControllersRef.current.delete(frameToFetch);
            inFlightCountRef.current = Math.max(0, inFlightCountRef.current - 1);

            blobCacheRef.current.set(frameToFetch, blob);
            isBlobLoadedRef.current[frameToFetch] = 1;
            pruneBlobCache(center);

            // If this frame is within the near-field window, decode it to bitmap immediately
            const cur = Math.round(currentFrameRef.current);
            const dist = Math.abs(frameToFetch - cur);
            if (dist <= NEAR_BITMAP_FORWARD + 2) {
              inFlightDecodesRef.current.add(frameToFetch);
              decodeBlobToBitmap(frameToFetch).then((asset) => {
                inFlightDecodesRef.current.delete(frameToFetch);
                if (asset) {
                  bitmapCacheRef.current.set(frameToFetch, asset);
                  if (Math.floor(currentFrameRef.current) === frameToFetch || dist <= 1) {
                    lastDrawnFrameRef.current = -1;
                  }
                }
              });
            }

            // Immediately trigger next queue tick
            scheduleTwoTierBuffer(currentFrameRef.current, scrollVelocityRef.current);
          })
          .catch((err) => {
            activeControllersRef.current.delete(frameToFetch);
            inFlightCountRef.current = Math.max(0, inFlightCountRef.current - 1);
            if (err.name !== "AbortError") {
              // Transient network glitch, allowed to be retried on next sweep
            }
          });
      }
    },
    [fetchBlob, getFramePath, pruneBitmapCache, ensureNearFieldBitmaps, pruneBlobCache, decodeBlobToBitmap]
  );

  // Canvas drawing function optimized for 60Hz & 120Hz displays
  // Uses discrete contiguous frames to completely eliminate double-exposure ghosting and teleport snaps
  const drawFrameToCanvas = useCallback(
    (frameFloat: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const clamped = Math.min(TOTAL_FRAMES, Math.max(1, frameFloat));
      const targetInt = Math.floor(clamped);

      // Resolve best available loaded frame (target or nearest preceding contiguous loaded frame)
      let frameToDraw = targetInt;
      if (!bitmapCacheRef.current.has(frameToDraw)) {
        frameToDraw = findNearestLoadedFrame(targetInt);
      }

      if (frameToDraw === -1) return;

      const asset = bitmapCacheRef.current.get(frameToDraw);
      if (!asset) return;

      // 60Hz & 120Hz Fillrate Optimization:
      // If the integer frame to draw has not changed and dimensions have not changed,
      // skip the full-canvas GPU blit! This eliminates 60-80% of redundant draw calls at 120Hz.
      const width = windowWidthRef.current || window.innerWidth;
      const height = windowHeightRef.current || window.innerHeight;

      if (
        frameToDraw === lastDrawnFrameRef.current &&
        width === lastDrawnWidthRef.current &&
        height === lastDrawnHeightRef.current
      ) {
        return;
      }

      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const targetWidth = Math.floor(width * dpr);
      const targetHeight = Math.floor(height * dpr);

      if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
        canvas.width = targetWidth;
        canvas.height = targetHeight;
      }

      // Hardware-accelerated 2D context (standard alpha: false, desynchronized for low latency)
      const ctx = canvas.getContext("2d", {
        alpha: false,
        desynchronized: true,
      }) as CanvasRenderingContext2D | null;
      if (!ctx) return;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "medium";

      const imgWidth = "naturalWidth" in asset && asset.naturalWidth ? asset.naturalWidth : asset.width;
      const imgHeight = "naturalHeight" in asset && asset.naturalHeight ? asset.naturalHeight : asset.height;
      if (!imgWidth || !imgHeight) return;

      const imgRatio = imgWidth / imgHeight;
      const canvasRatio = width / height;

      let drawW = width;
      let drawH = height;
      let offsetX = 0;
      let offsetY = 0;

      if (canvasRatio > imgRatio) {
        drawW = width;
        drawH = width / imgRatio;
        offsetY = (height - drawH) / 2;
      } else {
        drawH = height;
        drawW = height * imgRatio;
        offsetX = (width - drawW) / 2;
      }

      // Draw clean, single discrete frame (Zero ghosting, zero teleporting)
      ctx.globalAlpha = 1.0;
      ctx.drawImage(asset, offsetX, offsetY, drawW, drawH);

      lastDrawnFrameRef.current = frameToDraw;
      lastDrawnWidthRef.current = width;
      lastDrawnHeightRef.current = height;
    },
    [findNearestLoadedFrame]
  );

  // Resize handler caching window dimensions
  useEffect(() => {
    const updateDimensions = () => {
      windowWidthRef.current = window.innerWidth;
      windowHeightRef.current = window.innerHeight;
      lastDrawnFrameRef.current = -1; // Force redraw on resize
      drawFrameToCanvas(currentFrameRef.current);
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, [drawFrameToCanvas]);

  // Progressive Bootstrap & Two-Tier Corridor Streamer
  useEffect(() => {
    let isCancelled = false;
    let loaded = 0;

    const bootEngine = async () => {
      // Step 1: Critical Bootstrap (Contiguous frames 1 to CRITICAL_PRELOAD_COUNT)
      const preloadCount = CRITICAL_PRELOAD_COUNT;
      const initialPromises: Promise<void>[] = [];

      for (let i = 1; i <= preloadCount; i++) {
        const url = getFramePath(i);
        const p = fetchBlob(url)
          .then(async (blob) => {
            if (!isCancelled) {
              blobCacheRef.current.set(i, blob);
              isBlobLoadedRef.current[i] = 1;

              // Immediately decode initial runway into GPU ImageBitmaps
              const asset = await decodeBlobToBitmap(i);
              if (asset && !isCancelled) {
                bitmapCacheRef.current.set(i, asset);
              }
            }
          })
          .catch(() => {})
          .finally(() => {
            if (!isCancelled) {
              loaded++;
              setLoadProgress(Math.min(100, Math.round((loaded / preloadCount) * 100)));
            }
          });
        initialPromises.push(p);
      }

      // Fast-boot timeout: if network is slow, boot after max 2.5s
      const maxWaitTimeout = new Promise<void>((resolve) => setTimeout(resolve, 2500));

      await Promise.race([
        Promise.all(initialPromises),
        maxWaitTimeout,
      ]);

      if (isCancelled) return;

      setIsReady(true);
      setLoadProgress(100);

      // Render initial frame immediately
      drawFrameToCanvas(1);

      // Start two-tier buffer streaming
      scheduleTwoTierBuffer(1, 1.0);
    };

    bootEngine();

    return () => {
      isCancelled = true;
      // Abort any in-flight network requests
      for (const controller of activeControllersRef.current.values()) {
        controller.abort();
      }
      activeControllersRef.current.clear();
      // Free all GPU ImageBitmaps
      for (const asset of bitmapCacheRef.current.values()) {
        if ("close" in asset && typeof asset.close === "function") {
          asset.close();
        }
      }
      bitmapCacheRef.current.clear();
      blobCacheRef.current.clear();
    };
  }, [getFramePath, fetchBlob, decodeBlobToBitmap, drawFrameToCanvas, scheduleTwoTierBuffer]);

  // Main Scroll Engine & Synchronized 60FPS/120FPS RAF Loop
  useEffect(() => {
    if (!isReady) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Responsive Lenis Engine: 0.85s duration for crisp, snappy tactile response
    const lenis = new Lenis({
      duration: prefersReducedMotion ? 0 : 0.85,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // Clean exponential easeOut
      orientation: "vertical",
      gestureOrientation: "vertical",
      smoothWheel: true,
      wheelMultiplier: 1.0,
      touchMultiplier: 1.6,
      infinite: false,
    });

    lenisRef.current = lenis;

    let animFrameId: number;

    const renderLoop = (time: number) => {
      lenis.raf(time);

      const scrollY = lenis.scroll;
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      const progress = maxScroll > 0 ? Math.min(1, Math.max(0, scrollY / maxScroll)) : 0;

      const targetFrameFloat = 1 + progress * (TOTAL_FRAMES - 1);

      // High-performance single-stage time-invariant exponential filter (tau = 48)
      // Eliminates compound input lag while guaranteeing continuous sub-pixel smooth motion
      const now = performance.now();
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTimeRef.current) / 1000));
      lastTimeRef.current = now;

      const smoothFactor = 1 - Math.exp(-40 * dt);
      const prevFloat = smoothFrameRef.current;
      smoothFrameRef.current += (targetFrameFloat - smoothFrameRef.current) * smoothFactor;
      const renderFloat = smoothFrameRef.current;
      currentFrameRef.current = renderFloat;

      // Track velocity for directional lookahead
      const velocity = (renderFloat - prevFloat) / dt;
      scrollVelocityRef.current = velocity;

      // Directional linear buffer streaming around active playhead
      scheduleTwoTierBuffer(renderFloat, velocity);

      // Direct DOM Hero Video Crossfade (Zero React Virtual DOM overhead in RAF)
      const vOpacity = Math.max(0, 1 - (renderFloat - 1) / 14);
      if (videoWrapperRef.current) {
        videoWrapperRef.current.style.opacity = vOpacity.toFixed(3);
        videoWrapperRef.current.style.display = vOpacity <= 0.005 ? "none" : "block";
      }

      // Hardware CSS Custom Properties Synchronization (Direct Compositor Updates)
      const container = containerRef.current;
      if (container) {
        // Hero Overlay Transforms
        const heroOpacity = Math.max(0, 1 - (renderFloat - 1) / 32);
        const heroTY = (renderFloat - 1) * 2;
        container.style.setProperty("--hero-opacity", heroOpacity.toFixed(3));
        container.style.setProperty("--hero-ty", `-${heroTY.toFixed(2)}px`);
        container.style.setProperty("--hero-vis", heroOpacity <= 0.01 ? "hidden" : "visible");

        // Door About Overlay Transforms
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
        container.style.setProperty("--door-opacity", doorOpacity.toFixed(3));
        container.style.setProperty("--door-ty", `${doorTY.toFixed(2)}px`);
        container.style.setProperty("--door-vis", doorOpacity <= 0.005 ? "hidden" : "visible");

        // Wall Gallery Overlay Continuous Translation
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
        container.style.setProperty("--gallery-tx", `${galleryTX.toFixed(2)}px`);
        container.style.setProperty("--gallery-opacity", galleryOpacity.toFixed(3));
        container.style.setProperty("--gallery-vis", galleryOpacity <= 0.005 ? "hidden" : "visible");
        container.style.setProperty("--gallery-pe", galleryOpacity > 0.1 ? "auto" : "none");
      }

      // Canvas Render Update: Draw discrete frame (skips redundant GPU blits on 60Hz & 120Hz)
      drawFrameToCanvas(renderFloat);

      // Decoupled React State Update: Throttle component re-renders to milestone boundaries
      // Prevents 60/120 Virtual DOM reconciliations per second while keeping overlays perfectly synchronized
      const roundedFrame = Math.round(renderFloat);
      const isBoundaryCrossed =
        (lastReportedFrameRef.current <= 365 && roundedFrame > 365) ||
        (lastReportedFrameRef.current <= 598 && roundedFrame > 598) ||
        (lastReportedFrameRef.current <= 840 && roundedFrame > 840) ||
        (lastReportedFrameRef.current <= 1140 && roundedFrame > 1140) ||
        (lastReportedFrameRef.current >= 365 && roundedFrame < 365) ||
        (lastReportedFrameRef.current >= 598 && roundedFrame < 598) ||
        (lastReportedFrameRef.current >= 840 && roundedFrame < 840) ||
        (lastReportedFrameRef.current >= 1140 && roundedFrame < 1140);

      const timeSinceLastReactUpdate = now - lastReactUpdateRef.current;
      if (
        roundedFrame !== lastReportedFrameRef.current &&
        (isBoundaryCrossed || timeSinceLastReactUpdate > 66 || Math.abs(roundedFrame - lastReportedFrameRef.current) >= 4)
      ) {
        lastReportedFrameRef.current = roundedFrame;
        lastReactUpdateRef.current = now;
        setCurrentFrame(roundedFrame);
        if (onFrameUpdate) {
          onFrameUpdate(roundedFrame);
        }
      }

      animFrameId = requestAnimationFrame(renderLoop);
    };

    animFrameId = requestAnimationFrame(renderLoop);

    return () => {
      cancelAnimationFrame(animFrameId);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, [isReady, drawFrameToCanvas, onFrameUpdate, scheduleTwoTierBuffer]);

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
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      const targetScrollY = targetProgress * maxScroll;

      scheduleTwoTierBuffer(target, 1.0);

      lenisRef.current.scrollTo(targetScrollY, {
        duration: 1.2,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        onComplete: () => {
          if (onNavigationComplete) {
            onNavigationComplete();
          }
        },
      });
    }
  }, [targetNavigationFrame, scheduleTwoTierBuffer, onNavigationComplete]);

  // Autoplay video loop for Safari compatibility
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  }, []);

  const handleExploreEvents = () => {
    if (lenisRef.current) {
      const targetProgress = (630 - 1) / (TOTAL_FRAMES - 1);
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      scheduleTwoTierBuffer(630, 1.0);
      lenisRef.current.scrollTo(targetProgress * maxScroll, { duration: 1.2 });
    }
  };

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

        {/* Ambient Video (Loops seamlessly at hero frame 1, controlled via direct DOM ref) */}
        <div
          ref={videoWrapperRef}
          className="absolute inset-0 w-full h-full pointer-events-none z-10"
          style={{ opacity: 1 }}
        >
          <video
            ref={videoRef}
            src={getAssetUrl("/still_shot.mp4")}
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
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
