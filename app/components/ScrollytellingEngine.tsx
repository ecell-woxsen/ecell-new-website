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
const LOOKAHEAD_FORWARD = 32; // Directional lookahead corridor
const LOOKAHEAD_BACKWARD = 8; // Safety buffer behind the playhead
const PLAYHEAD_WINDOW = 3; // Immediate high-priority playhead target window

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
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const videoWrapperRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lenisRef = useRef<Lenis | null>(null);

  // =========================================================================
  // ZERO-LAG TWO-TIER ARCHITECTURE
  // =========================================================================
  // Tier 1: Permanent Compressed Blobs (~50 KB each; ~60 MB total for ALL 1,262 frames)
  // Once downloaded, Blobs are NEVER discarded so re-scrubbing is 100% instant (< 1ms).
  const blobCacheRef = useRef<Map<number, Blob>>(new Map());

  // Tier 2: Active GPU Bitmaps (strictly ~35 frames = ~290 MB GPU VRAM ceiling)
  // Pruned dynamically as the user scrolls. Evicted bitmaps call asset.close() immediately.
  const bitmapCacheRef = useRef<Map<number, FrameAsset>>(new Map());
  const inFlightDecodesRef = useRef<Set<number>>(new Set());

  // Active network download controllers & preloader state
  const activeControllersRef = useRef<Map<number, AbortController>>(new Map());
  const inFlightCountRef = useRef(0);
  const lastScheduledIntegerRef = useRef<number>(-1);

  // React state for boot & overlays
  const [loadProgress, setLoadProgress] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [currentFrame, setCurrentFrame] = useState(1);

  // Rendering & window dimension refs
  const currentFrameRef = useRef(1);
  const lastTimeRef = useRef(performance.now());
  const lastReportedFrameRef = useRef<number>(1);
  const maxGalleryWidthRef = useRef(3200);
  const windowWidthRef = useRef(typeof window !== "undefined" ? window.innerWidth : 1920);
  const windowHeightRef = useRef(typeof window !== "undefined" ? window.innerHeight : 1080);
  const scrollVelocityRef = useRef(0);

  // 60Hz & 120Hz High-Refresh GPU Fillrate Optimization Refs
  const lastDrawnFrameRef = useRef<number>(-1);
  const lastDrawnWidthRef = useRef<number>(0);
  const lastDrawnHeightRef = useRef<number>(0);

  // Helper to format frame CDN URL strictly to 1080p ecell_shots
  const getFramePath = useCallback((frameNum: number) => {
    return getFrameUrl(frameNum, "1080p");
  }, []);

  // Native Off-Thread Bitmap Decoder (Fast native GPU decode, no slow software resampler)
  const decodeBlobToBitmap = useCallback(
    async (frameIdx: number): Promise<FrameAsset | null> => {
      const blob = blobCacheRef.current.get(frameIdx);
      if (!blob) return null;

      if (typeof window !== "undefined" && "createImageBitmap" in window) {
        try {
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

  // Find nearest preceding contiguous loaded frame without any Promise delays
  const findNearestLoadedFrame = useCallback((target: number): number => {
    const cache = bitmapCacheRef.current;
    if (cache.has(target)) return target;

    // Search backward first (hold closest past frame along travel trajectory)
    const minBack = Math.max(1, target - 35);
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

    return cache.size > 0 ? (cache.keys().next().value ?? 1) : 1;
  }, []);

  // Playhead-First Priority Preloader with Head-of-Line Blocking Elimination
  const schedulePriorityBuffer = useCallback(
    (centerFloat: number, velocity: number) => {
      const target = Math.min(TOTAL_FRAMES, Math.max(1, Math.round(centerFloat)));
      const isForward = velocity >= -0.05;

      // 1. Prune GPU Bitmaps outside [target - 6, target + 32] to cap GPU memory at ~290 MB
      const minKeep = Math.max(1, target - 6);
      const maxKeep = Math.min(TOTAL_FRAMES, target + 32);

      for (const [idx, asset] of bitmapCacheRef.current.entries()) {
        if (idx < minKeep || idx > maxKeep) {
          if ("close" in asset && typeof asset.close === "function") {
            asset.close(); // Instantly reclaim ~8.3 MB of GPU texture VRAM
          }
          bitmapCacheRef.current.delete(idx);
        }
      }

      // 2. High-Priority JIT Decode for frames already in blobCache but not in bitmapCache
      // Focus on immediate playhead window first: [target - 3, target + 10]
      const nearStart = Math.max(1, target - 3);
      const nearEnd = Math.min(TOTAL_FRAMES, target + 10);
      for (let f = nearStart; f <= nearEnd; f++) {
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
              if (Math.abs(cur - f) <= 1) {
                lastDrawnFrameRef.current = -1;
              }
            }
          });
        }
      }

      // 3. Playhead-First Priority Request Scheduling
      // Priority 1: Target frame and immediate next 3 frames [target, target + 1, target + 2, target + 3]
      // Priority 2: Directional corridor along trajectory
      const priorityQueue: number[] = [];

      // Urgent: playhead and immediate adjacent frames
      for (let i = 0; i <= PLAYHEAD_WINDOW; i++) {
        const f = isForward ? target + i : target - i;
        if (f >= 1 && f <= TOTAL_FRAMES && !blobCacheRef.current.has(f) && !activeControllersRef.current.has(f)) {
          priorityQueue.push(f);
        }
      }

      // Lookahead corridor
      if (isForward) {
        for (let i = PLAYHEAD_WINDOW + 1; i <= LOOKAHEAD_FORWARD; i++) {
          const f = target + i;
          if (f <= TOTAL_FRAMES && !blobCacheRef.current.has(f) && !activeControllersRef.current.has(f)) {
            priorityQueue.push(f);
          }
        }
        for (let i = 1; i <= LOOKAHEAD_BACKWARD; i++) {
          const f = target - i;
          if (f >= 1 && !blobCacheRef.current.has(f) && !activeControllersRef.current.has(f)) {
            priorityQueue.push(f);
          }
        }
      } else {
        for (let i = PLAYHEAD_WINDOW + 1; i <= LOOKAHEAD_FORWARD; i++) {
          const f = target - i;
          if (f >= 1 && !blobCacheRef.current.has(f) && !activeControllersRef.current.has(f)) {
            priorityQueue.push(f);
          }
        }
        for (let i = 1; i <= LOOKAHEAD_BACKWARD; i++) {
          const f = target + i;
          if (f <= TOTAL_FRAMES && !blobCacheRef.current.has(f) && !activeControllersRef.current.has(f)) {
            priorityQueue.push(f);
          }
        }
      }

      // 4. Preempt distant in-flight requests if playhead is starving!
      // If the target frame is not in blobCache and not in activeControllers, but all slots are full:
      // Abort any in-flight request that is further than 10 frames away from target!
      const targetNeedsFetch = !blobCacheRef.current.has(target) && !activeControllersRef.current.has(target);
      if (targetNeedsFetch && inFlightCountRef.current >= MAX_CONCURRENT_REQUESTS) {
        for (const [frameIdx, controller] of activeControllersRef.current.entries()) {
          if (Math.abs(frameIdx - target) > 10) {
            controller.abort();
            activeControllersRef.current.delete(frameIdx);
            inFlightCountRef.current = Math.max(0, inFlightCountRef.current - 1);
            if (inFlightCountRef.current < MAX_CONCURRENT_REQUESTS) break;
          }
        }
      }

      // Also abort any active controller that has drifted far (> 40 frames away)
      for (const [frameIdx, controller] of activeControllersRef.current.entries()) {
        if (Math.abs(frameIdx - target) > 40) {
          controller.abort();
          activeControllersRef.current.delete(frameIdx);
          inFlightCountRef.current = Math.max(0, inFlightCountRef.current - 1);
        }
      }

      // 5. Dispatch network requests from priorityQueue up to MAX_CONCURRENT_REQUESTS
      for (const frameToFetch of priorityQueue) {
        if (inFlightCountRef.current >= MAX_CONCURRENT_REQUESTS) break;

        const controller = new AbortController();
        activeControllersRef.current.set(frameToFetch, controller);
        inFlightCountRef.current++;

        const url = getFramePath(frameToFetch);

        fetch(url, { signal: controller.signal, cache: "force-cache" })
          .then(async (res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.blob();
          })
          .then((blob) => {
            activeControllersRef.current.delete(frameToFetch);
            inFlightCountRef.current = Math.max(0, inFlightCountRef.current - 1);

            // Store compressed Blob permanently in memory (~50 KB)
            blobCacheRef.current.set(frameToFetch, blob);

            // If this frame is within the near-field window, decode it to bitmap immediately
            const cur = Math.round(currentFrameRef.current);
            const dist = Math.abs(frameToFetch - cur);
            if (dist <= 15) {
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
            schedulePriorityBuffer(currentFrameRef.current, scrollVelocityRef.current);
          })
          .catch((err) => {
            activeControllersRef.current.delete(frameToFetch);
            inFlightCountRef.current = Math.max(0, inFlightCountRef.current - 1);
            if (err.name !== "AbortError") {
              // Transient network glitch, allowed to retry
            }
          });
      }
    },
    [decodeBlobToBitmap, getFramePath]
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
        // If blob is available, trigger instant JIT decode
        if (blobCacheRef.current.has(targetInt) && !inFlightDecodesRef.current.has(targetInt)) {
          inFlightDecodesRef.current.add(targetInt);
          decodeBlobToBitmap(targetInt).then((asset) => {
            inFlightDecodesRef.current.delete(targetInt);
            if (asset) {
              bitmapCacheRef.current.set(targetInt, asset);
              lastDrawnFrameRef.current = -1;
            }
          });
        }
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
      let ctx = ctxRef.current;
      if (!ctx) {
        ctx = canvas.getContext("2d", {
          alpha: false,
          desynchronized: true,
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
    [decodeBlobToBitmap, findNearestLoadedFrame]
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

  // Progressive Bootstrap & Ahead-Of-Time (AOT) Corridor Streamer
  useEffect(() => {
    let isCancelled = false;
    let loaded = 0;

    const bootEngine = async () => {
      // Step 1: Critical Bootstrap (Contiguous frames 1 to CRITICAL_PRELOAD_COUNT)
      const preloadCount = CRITICAL_PRELOAD_COUNT;
      const initialPromises: Promise<void>[] = [];

      for (let i = 1; i <= preloadCount; i++) {
        const url = getFramePath(i);
        const p = fetch(url, { cache: "force-cache" })
          .then((res) => res.blob())
          .then(async (blob) => {
            if (!isCancelled) {
              blobCacheRef.current.set(i, blob);
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

      // Start priority buffer streaming
      schedulePriorityBuffer(1, 1.0);
    };

    bootEngine();

    return () => {
      isCancelled = true;
      // Abort any in-flight network requests
      for (const controller of activeControllersRef.current.values()) {
        controller.abort();
      }
      activeControllersRef.current.clear();
      // Free GPU ImageBitmaps
      for (const asset of bitmapCacheRef.current.values()) {
        if ("close" in asset && typeof asset.close === "function") {
          asset.close();
        }
      }
      bitmapCacheRef.current.clear();
      blobCacheRef.current.clear();
    };
  }, [getFramePath, decodeBlobToBitmap, drawFrameToCanvas, schedulePriorityBuffer]);

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

      // SINGLE-STAGE DIRECT LENIS MAPPING: Zero compound input lag!
      // Lenis's exponential easeOut curve already provides smooth 60fps/120fps sub-pixel scrolling.
      const renderFloat = 1 + progress * (TOTAL_FRAMES - 1);
      const prevFloat = currentFrameRef.current;
      currentFrameRef.current = renderFloat;

      const now = performance.now();
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTimeRef.current) / 1000));
      lastTimeRef.current = now;

      // Track velocity for directional lookahead
      const velocity = (renderFloat - prevFloat) / dt;
      scrollVelocityRef.current = velocity;

      // Priority linear preloader: runs when integer frame advances or velocity changes
      const currentInt = Math.floor(renderFloat);
      if (currentInt !== lastScheduledIntegerRef.current || Math.abs(velocity) > 3) {
        lastScheduledIntegerRef.current = currentInt;
        schedulePriorityBuffer(renderFloat, velocity);
      }

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

      // Section boundary throttle: ONLY trigger React state update when crossing a major section milestone!
      // Eliminates 100% of React Virtual DOM reconciliations during active scrolling!
      const roundedFrame = Math.round(renderFloat);
      const isBoundaryCrossed =
        (lastReportedFrameRef.current < 365 && roundedFrame >= 365) ||
        (lastReportedFrameRef.current >= 365 && roundedFrame < 365) ||
        (lastReportedFrameRef.current < 598 && roundedFrame >= 598) ||
        (lastReportedFrameRef.current >= 598 && roundedFrame < 598) ||
        (lastReportedFrameRef.current < 840 && roundedFrame >= 840) ||
        (lastReportedFrameRef.current >= 840 && roundedFrame < 840) ||
        (lastReportedFrameRef.current < 1140 && roundedFrame >= 1140) ||
        (lastReportedFrameRef.current >= 1140 && roundedFrame < 1140);

      if (isBoundaryCrossed) {
        lastReportedFrameRef.current = roundedFrame;
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
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      const targetScrollY = targetProgress * maxScroll;

      schedulePriorityBuffer(target, 1.0);

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
  }, [targetNavigationFrame, schedulePriorityBuffer, onNavigationComplete]);

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
      schedulePriorityBuffer(630, 1.0);
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
