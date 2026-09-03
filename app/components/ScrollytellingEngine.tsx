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
const LOOKAHEAD_FORWARD = 35; // Contiguous lookahead corridor ahead of playhead
const LOOKAHEAD_BACKWARD = 10; // Safety buffer behind the playhead (Total buffer: ~45 frames ≈ 370 MB)
const MAX_CACHE_SIZE = 58; // Hysteresis limit: only evicts when cache exceeds 58 frames
const CANCEL_DISTANCE = 50; // Distance threshold to abort out-of-range in-flight network requests

// Image asset type: ImageBitmap (decoded off-main-thread) or HTMLImageElement fallback
type FrameAsset = ImageBitmap | HTMLImageElement;

/**
 * Single-Pass Ahead-Of-Time (AOT) Frame Loader
 * Fetches 1080p WebP and decodes natively off-main-thread directly into GPU-ready ImageBitmaps.
 * Avoids software resampling overhead and eliminates all Just-In-Time decode delays during scroll.
 */
async function loadFrameAsset(
  url: string,
  signal?: AbortSignal
): Promise<FrameAsset> {
  const res = await fetch(url, { signal, cache: "force-cache" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();

  // Fast native GPU texture decoding (No slow CPU software downsampling)
  if (typeof window !== "undefined" && "createImageBitmap" in window) {
    try {
      return await createImageBitmap(blob);
    } catch {
      // Fallback below
    }
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    const objectUrl = URL.createObjectURL(blob);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(objectUrl);
      reject(e);
    };
    img.src = objectUrl;
  });
}

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

  // Streamlined Ahead-Of-Time Frames Cache (~370 MB RAM bound via hysteresis)
  const framesCacheRef = useRef<Map<number, FrameAsset>>(new Map());
  const isFrameLoadedRef = useRef<Uint8Array>(new Uint8Array(TOTAL_FRAMES + 1));
  const activeControllersRef = useRef<Map<number, AbortController>>(new Map());
  const inFlightCountRef = useRef(0);
  const lastScheduledIntegerRef = useRef<number>(-1);

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

  // Hysteresis Batch Cache Pruning: Prevents 120Hz texture allocation/deallocation thrashing
  const pruneCache = useCallback((center: number) => {
    if (framesCacheRef.current.size <= MAX_CACHE_SIZE) return;

    const minKeep = center - 18;
    const maxKeep = center + 45;

    for (const [idx, asset] of framesCacheRef.current.entries()) {
      if (idx < minKeep || idx > maxKeep) {
        if ("close" in asset && typeof asset.close === "function") {
          asset.close(); // Immediately reclaim GPU VRAM
        }
        framesCacheRef.current.delete(idx);
        isFrameLoadedRef.current[idx] = 0;
      }
    }
  }, []);

  // Find nearest preceding contiguous loaded frame without any Promise delays
  const findNearestLoadedFrame = useCallback((target: number): number => {
    const isLoaded = isFrameLoadedRef.current;
    if (isLoaded[target]) return target;

    // Search backward first (hold closest past frame along travel trajectory)
    const minBack = Math.max(1, target - 30);
    for (let f = target - 1; f >= minBack; f--) {
      if (isLoaded[f]) return f;
    }

    // Search forward if backward has none
    const maxForward = Math.min(TOTAL_FRAMES, target + 15);
    for (let f = target + 1; f <= maxForward; f++) {
      if (isLoaded[f]) return f;
    }

    // Fallback to last successfully drawn frame, or frame 1
    if (lastDrawnFrameRef.current !== -1 && isLoaded[lastDrawnFrameRef.current]) {
      return lastDrawnFrameRef.current;
    }

    return isLoaded[1] ? 1 : -1;
  }, []);

  // Directional Linear Preloader with Ahead-Of-Time (AOT) Native Decoding
  const scheduleLinearBuffer = useCallback(
    (centerFloat: number, velocity: number) => {
      const center = Math.round(centerFloat);
      const isForward = velocity >= -0.05;

      // 1. Hysteresis batch eviction (only prunes when cache exceeds 58 frames)
      pruneCache(center);

      // 2. Abort out-of-range in-flight network downloads
      for (const [frameIdx, controller] of activeControllersRef.current.entries()) {
        const dist = Math.abs(frameIdx - center);
        if (dist > CANCEL_DISTANCE) {
          controller.abort();
          activeControllersRef.current.delete(frameIdx);
          inFlightCountRef.current = Math.max(0, inFlightCountRef.current - 1);
        }
      }

      // 3. Build prioritized desired corridor along trajectory
      const desiredFrames: number[] = [];
      const floorFrame = Math.floor(centerFloat);
      if (!isFrameLoadedRef.current[floorFrame] && !activeControllersRef.current.has(floorFrame)) {
        desiredFrames.push(floorFrame);
      }

      if (isForward) {
        // Forward priority corridor: center + 1, center + 2, ...
        for (let i = 1; i <= LOOKAHEAD_FORWARD; i++) {
          const f = center + i;
          if (f <= TOTAL_FRAMES && !isFrameLoadedRef.current[f] && !activeControllersRef.current.has(f)) {
            desiredFrames.push(f);
          }
        }
        // Backward safety corridor: center - 1, ...
        for (let i = 1; i <= LOOKAHEAD_BACKWARD; i++) {
          const f = center - i;
          if (f >= 1 && !isFrameLoadedRef.current[f] && !activeControllersRef.current.has(f)) {
            desiredFrames.push(f);
          }
        }
      } else {
        // Reverse priority corridor: center - 1, center - 2, ...
        for (let i = 1; i <= LOOKAHEAD_FORWARD; i++) {
          const f = center - i;
          if (f >= 1 && !isFrameLoadedRef.current[f] && !activeControllersRef.current.has(f)) {
            desiredFrames.push(f);
          }
        }
        // Forward safety in reverse
        for (let i = 1; i <= LOOKAHEAD_BACKWARD; i++) {
          const f = center + i;
          if (f <= TOTAL_FRAMES && !isFrameLoadedRef.current[f] && !activeControllersRef.current.has(f)) {
            desiredFrames.push(f);
          }
        }
      }

      // 4. Dispatch requests up to MAX_CONCURRENT_REQUESTS
      for (const frameToFetch of desiredFrames) {
        if (inFlightCountRef.current >= MAX_CONCURRENT_REQUESTS) break;

        const controller = new AbortController();
        activeControllersRef.current.set(frameToFetch, controller);
        inFlightCountRef.current++;

        const url = getFramePath(frameToFetch);

        loadFrameAsset(url, controller.signal)
          .then((asset) => {
            activeControllersRef.current.delete(frameToFetch);
            inFlightCountRef.current = Math.max(0, inFlightCountRef.current - 1);

            framesCacheRef.current.set(frameToFetch, asset);
            isFrameLoadedRef.current[frameToFetch] = 1;

            // If active playhead is on or adjacent to this frame, immediately trigger repaint
            const cur = Math.floor(currentFrameRef.current);
            if (cur === frameToFetch || Math.abs(cur - frameToFetch) <= 1) {
              lastDrawnFrameRef.current = -1;
            }

            // Immediately trigger next queue tick
            scheduleLinearBuffer(currentFrameRef.current, scrollVelocityRef.current);
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
    [getFramePath, pruneCache]
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
      if (!isFrameLoadedRef.current[frameToDraw]) {
        frameToDraw = findNearestLoadedFrame(targetInt);
      }

      if (frameToDraw === -1) return;

      const asset = framesCacheRef.current.get(frameToDraw);
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
        const p = loadFrameAsset(url)
          .then((asset) => {
            if (!isCancelled) {
              framesCacheRef.current.set(i, asset);
              isFrameLoadedRef.current[i] = 1;
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

      // Start AOT linear buffer streaming
      scheduleLinearBuffer(1, 1.0);
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
      for (const asset of framesCacheRef.current.values()) {
        if ("close" in asset && typeof asset.close === "function") {
          asset.close();
        }
      }
      framesCacheRef.current.clear();
    };
  }, [getFramePath, drawFrameToCanvas, scheduleLinearBuffer]);

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

      // High-performance direct exponential filter (tau = 72)
      // Eliminates compound input lag so trackpad and wheel movements feel instantaneous
      const now = performance.now();
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTimeRef.current) / 1000));
      lastTimeRef.current = now;

      const smoothFactor = 1 - Math.exp(-72 * dt);
      const prevFloat = smoothFrameRef.current;
      smoothFrameRef.current += (targetFrameFloat - smoothFrameRef.current) * smoothFactor;
      const renderFloat = smoothFrameRef.current;
      currentFrameRef.current = renderFloat;

      // Track velocity for directional lookahead
      const velocity = (renderFloat - prevFloat) / dt;
      scrollVelocityRef.current = velocity;

      // Throttle linear preloader: only run when integer frame advances or velocity changes sign
      const currentInt = Math.floor(renderFloat);
      if (currentInt !== lastScheduledIntegerRef.current || Math.abs(velocity) > 5) {
        lastScheduledIntegerRef.current = currentInt;
        scheduleLinearBuffer(renderFloat, velocity);
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
  }, [isReady, drawFrameToCanvas, onFrameUpdate, scheduleLinearBuffer]);

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

      scheduleLinearBuffer(target, 1.0);

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
  }, [targetNavigationFrame, scheduleLinearBuffer, onNavigationComplete]);

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
      scheduleLinearBuffer(630, 1.0);
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
