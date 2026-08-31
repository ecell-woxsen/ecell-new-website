"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import Lenis from "lenis";
import PreloadManager from "./PreloadManager";
import HeroOverlay from "./overlays/HeroOverlay";
import DoorAboutOverlay from "./overlays/DoorAboutOverlay";
import WallGalleryOverlay from "./overlays/WallGalleryOverlay";

interface ScrollytellingEngineProps {
  onFrameUpdate?: (frame: number) => void;
  onOpenJoinModal: () => void;
  targetNavigationFrame?: number | null;
  onNavigationComplete?: () => void;
  isJoinModalOpen?: boolean;
}

const TOTAL_FRAMES = 1262;
const CRITICAL_PRELOAD_COUNT = 18; // Fast boot: ~500 KB to launch in < 250ms
const SKELETON_STEP = 8; // Skeleton keyframe step: guarantees nearby fallback every 8 frames
const SCROLL_TRACK_HEIGHT = TOTAL_FRAMES * 12; // 15,144px scroll track for 1:1 frame pacing
const MAX_CONCURRENT_REQUESTS = 6; // Optimal concurrent HTTP/2 streams per domain

// Image asset type: prefers ImageBitmap for off-main-thread zero-jank GPU uploads
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

  // Frames cache & sorted indices tracking
  const framesCacheRef = useRef<Map<number, FrameAsset>>(new Map());
  const loadedFramesRef = useRef<number[]>([]);
  const isFrameLoadedRef = useRef<Uint8Array>(new Uint8Array(TOTAL_FRAMES + 1));
  const isFrameRequestedRef = useRef<Uint8Array>(new Uint8Array(TOTAL_FRAMES + 1));

  // Prioritized Request Queue System
  const pendingQueueRef = useRef<Map<number, number>>(new Map()); // frameIdx -> priority
  const inFlightCountRef = useRef(0);
  const isQueueProcessingRef = useRef(false);

  // React state for boot & overlays
  const [loadProgress, setLoadProgress] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [currentFrame, setCurrentFrame] = useState(1);

  // Rendering & window dimension refs
  const currentFrameRef = useRef(1);
  const smoothFrameRef = useRef(1);
  const lastTimeRef = useRef(performance.now());
  const lastDrawnFloatRef = useRef<number | null>(null);
  const lastReportedFrameRef = useRef<number>(1);
  const lastReactUpdateRef = useRef<number>(0);
  const maxGalleryWidthRef = useRef(3200);
  const windowWidthRef = useRef(0);
  const windowHeightRef = useRef(0);
  const lastScrollCenterRef = useRef(1);
  const scrollVelocityRef = useRef(0);

  // Helper to format frame number e.g. 1 -> "/ecell_shots/00001.webp"
  const getFramePath = useCallback((frameNum: number) => {
    const clamped = Math.min(TOTAL_FRAMES, Math.max(1, frameNum));
    const padded = String(clamped).padStart(5, "0");
    return `/ecell_shots/${padded}.webp`;
  }, []);

  // Binary search to find nearest loaded keyframes on left and right of any float position
  const findLoadedKeyframes = useCallback((target: number) => {
    const arr = loadedFramesRef.current;
    const len = arr.length;
    if (len === 0) return { left: -1, right: -1 };

    let low = 0;
    let high = len - 1;
    let left = -1;
    let right = -1;

    while (low <= high) {
      const mid = (low + high) >> 1;
      const val = arr[mid];
      if (val === target) {
        return { left: val, right: val };
      } else if (val < target) {
        left = val;
        low = mid + 1;
      } else {
        right = val;
        high = mid - 1;
      }
    }

    // Adjust right bounds
    if (low < len && right === -1) {
      right = arr[low];
    }
    if (high >= 0 && left === -1) {
      left = arr[high];
    }

    return { left, right };
  }, []);

  // Register loaded frame in sorted array
  const registerLoadedFrame = useCallback((frameIdx: number, asset: FrameAsset) => {
    if (isFrameLoadedRef.current[frameIdx]) {
      framesCacheRef.current.set(frameIdx, asset);
      return;
    }

    framesCacheRef.current.set(frameIdx, asset);
    isFrameLoadedRef.current[frameIdx] = 1;

    // Insert into sorted array using binary search insertion point
    const arr = loadedFramesRef.current;
    let low = 0;
    let high = arr.length;
    while (low < high) {
      const mid = (low + high) >> 1;
      if (arr[mid] < frameIdx) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }
    arr.splice(low, 0, frameIdx);

    // If active playhead needs this frame, trigger immediate redraw on next RAF
    const cur = currentFrameRef.current;
    if (Math.abs(cur - frameIdx) <= 2) {
      lastDrawnFloatRef.current = null;
    }
  }, []);

  // Priority Queue Processor
  const processQueue = useCallback(() => {
    if (isQueueProcessingRef.current) return;
    isQueueProcessingRef.current = true;

    while (inFlightCountRef.current < MAX_CONCURRENT_REQUESTS && pendingQueueRef.current.size > 0) {
      // Find highest priority item
      let bestFrame = -1;
      let highestPriority = -Infinity;

      for (const [frameIdx, priority] of pendingQueueRef.current.entries()) {
        if (priority > highestPriority) {
          highestPriority = priority;
          bestFrame = frameIdx;
        }
      }

      if (bestFrame === -1) break;

      pendingQueueRef.current.delete(bestFrame);

      if (isFrameLoadedRef.current[bestFrame]) {
        continue;
      }

      inFlightCountRef.current++;
      const frameToFetch = bestFrame;
      const url = getFramePath(frameToFetch);

      // High-performance image fetch with off-main-thread bitmap decoding
      if (typeof window !== "undefined" && "createImageBitmap" in window && typeof fetch === "function") {
        fetch(url)
          .then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.blob();
          })
          .then((blob) => createImageBitmap(blob))
          .then((bitmap) => {
            registerLoadedFrame(frameToFetch, bitmap);
          })
          .catch(() => {
            // Fallback to Image element on any fetch/bitmap error
            const img = new Image();
            img.src = url;
            img.onload = () => registerLoadedFrame(frameToFetch, img);
          })
          .finally(() => {
            inFlightCountRef.current = Math.max(0, inFlightCountRef.current - 1);
            isQueueProcessingRef.current = false;
            processQueue();
          });
      } else {
        const img = new Image();
        img.src = url;
        const onDone = () => {
          registerLoadedFrame(frameToFetch, img);
          inFlightCountRef.current = Math.max(0, inFlightCountRef.current - 1);
          isQueueProcessingRef.current = false;
          processQueue();
        };
        if ("decode" in img && typeof img.decode === "function") {
          img.decode().then(onDone).catch(onDone);
        } else {
          img.onload = onDone;
          img.onerror = onDone;
        }
      }
    }

    isQueueProcessingRef.current = false;
  }, [getFramePath, registerLoadedFrame]);

  // Schedule a frame with specified priority
  const requestFrameWithPriority = useCallback(
    (frameIdx: number, priority: number) => {
      const idx = Math.min(TOTAL_FRAMES, Math.max(1, frameIdx));
      if (isFrameLoadedRef.current[idx]) return;

      const currentPri = pendingQueueRef.current.get(idx) || 0;
      if (priority > currentPri) {
        pendingQueueRef.current.set(idx, priority);
        isFrameRequestedRef.current[idx] = 1;
        processQueue();
      }
    },
    [processQueue]
  );

  // Direction & Velocity-Aware Priority Window Loader
  const schedulePriorityWindow = useCallback(
    (centerFloat: number, velocity: number) => {
      const center = Math.round(centerFloat);
      const isForward = velocity >= -0.05;

      // 1. Critical Visible Anchor Frames (Highest Priority: 1000)
      const floorFrame = Math.floor(centerFloat);
      const ceilFrame = Math.min(TOTAL_FRAMES, floorFrame + 1);
      requestFrameWithPriority(floorFrame, 1000);
      requestFrameWithPriority(ceilFrame, 1000);
      requestFrameWithPriority(center, 950);

      // 2. High Priority Lookahead Corridor along trajectory (Priority: 800 -> 300)
      if (isForward) {
        for (let i = 1; i <= 16; i++) {
          const target = center + i;
          if (target <= TOTAL_FRAMES) {
            requestFrameWithPriority(target, 800 - i * 30);
          }
        }
        for (let i = 1; i <= 4; i++) {
          const target = center - i;
          if (target >= 1) {
            requestFrameWithPriority(target, 250 - i * 30);
          }
        }
      } else {
        for (let i = 1; i <= 16; i++) {
          const target = center - i;
          if (target >= 1) {
            requestFrameWithPriority(target, 800 - i * 30);
          }
        }
        for (let i = 1; i <= 4; i++) {
          const target = center + i;
          if (target <= TOTAL_FRAMES) {
            requestFrameWithPriority(target, 250 - i * 30);
          }
        }
      }

      // 3. Extended Proximity Envelope (Priority: 150 -> 50)
      const start = Math.max(1, center - 25);
      const end = Math.min(TOTAL_FRAMES, center + 45);
      for (let i = start; i <= end; i += 2) {
        requestFrameWithPriority(i, 80);
      }
    },
    [requestFrameWithPriority]
  );

  // Canvas drawing function with Universal Continuous Keyframe Temporal Blending
  const drawFrameToCanvas = useCallback(
    (frameFloat: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      // Initialize with hardware-accelerated 2D context options
      const ctx = canvas.getContext("2d", {
        alpha: false,
        desynchronized: true,
      }) as CanvasRenderingContext2D | null;
      if (!ctx) return;

      const clamped = Math.min(TOTAL_FRAMES, Math.max(1, frameFloat));

      // Universal Keyframe Search: Find closest loaded frames on left and right
      const { left, right } = findLoadedKeyframes(clamped);

      let assetA: FrameAsset | undefined;
      let assetB: FrameAsset | undefined;
      let blendAlpha = 0;

      if (left !== -1 && right !== -1) {
        if (left === right) {
          assetA = framesCacheRef.current.get(left);
        } else {
          assetA = framesCacheRef.current.get(left);
          assetB = framesCacheRef.current.get(right);

          // Sub-frame interpolation factor between the two available keyframes
          const rawT = (clamped - left) / (right - left);
          const clampedT = Math.min(1, Math.max(0, rawT));

          // Smoothstep Hermite curve (3t^2 - 2t^3) for zero-step, filmic crossfade
          blendAlpha = clampedT * clampedT * (3 - 2 * clampedT);
        }
      } else if (left !== -1) {
        assetA = framesCacheRef.current.get(left);
      } else if (right !== -1) {
        assetA = framesCacheRef.current.get(right);
      }

      if (!assetA) return;

      // Dimension & DPR scaling
      // Cap DPR to 1.5 to maximize fillrate and eliminate 4K GPU stalls on 60Hz displays
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const width = windowWidthRef.current || window.innerWidth;
      const height = windowHeightRef.current || window.innerHeight;

      const targetWidth = Math.floor(width * dpr);
      const targetHeight = Math.floor(height * dpr);

      if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
        canvas.width = targetWidth;
        canvas.height = targetHeight;
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "medium";

      const imgWidth = "naturalWidth" in assetA ? assetA.naturalWidth : assetA.width;
      const imgHeight = "naturalHeight" in assetA ? assetA.naturalHeight : assetA.height;
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

      // Step 1: Draw primary base anchor frame
      ctx.globalAlpha = 1.0;
      ctx.drawImage(assetA, offsetX, offsetY, drawW, drawH);

      // Step 2: Continuous temporal cross-dissolve next keyframe for 60fps/120fps motion
      if (blendAlpha > 0.002 && assetB) {
        ctx.globalAlpha = blendAlpha;
        ctx.drawImage(assetB, offsetX, offsetY, drawW, drawH);
        ctx.globalAlpha = 1.0;
      }

      lastDrawnFloatRef.current = clamped;
    },
    [findLoadedKeyframes]
  );

  // Resize handler caching window dimensions
  useEffect(() => {
    const updateDimensions = () => {
      windowWidthRef.current = window.innerWidth;
      windowHeightRef.current = window.innerHeight;
      drawFrameToCanvas(currentFrameRef.current);
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, [drawFrameToCanvas]);

  // Progressive Bootstrap & Background Streamer
  useEffect(() => {
    let isCancelled = false;
    let loaded = 0;

    const bootEngine = async () => {
      // Step 1: Critical Bootstrap (Frames 1 to CRITICAL_PRELOAD_COUNT)
      const initialPromises: Promise<void>[] = [];
      for (let i = 1; i <= CRITICAL_PRELOAD_COUNT; i++) {
        initialPromises.push(
          new Promise((resolve) => {
            const url = getFramePath(i);
            if (typeof window !== "undefined" && "createImageBitmap" in window && typeof fetch === "function") {
              fetch(url)
                .then((r) => r.blob())
                .then((b) => createImageBitmap(b))
                .then((bitmap) => {
                  if (!isCancelled) {
                    registerLoadedFrame(i, bitmap);
                    loaded++;
                    setLoadProgress(Math.round((loaded / CRITICAL_PRELOAD_COUNT) * 100));
                  }
                  resolve();
                })
                .catch(() => {
                  const img = new Image();
                  img.src = url;
                  img.onload = () => {
                    if (!isCancelled) {
                      registerLoadedFrame(i, img);
                      loaded++;
                      setLoadProgress(Math.round((loaded / CRITICAL_PRELOAD_COUNT) * 100));
                    }
                    resolve();
                  };
                  img.onerror = () => resolve();
                });
            } else {
              const img = new Image();
              img.src = url;
              img.onload = () => {
                if (!isCancelled) {
                  registerLoadedFrame(i, img);
                  loaded++;
                  setLoadProgress(Math.round((loaded / CRITICAL_PRELOAD_COUNT) * 100));
                }
                resolve();
              };
              img.onerror = () => resolve();
            }
          })
        );
      }

      await Promise.all(initialPromises);
      if (isCancelled) return;

      setIsReady(true);
      setLoadProgress(100);

      // Render initial frame immediately
      drawFrameToCanvas(1);

      // Step 2: Skeleton Keyframe Stream across the full timeline (Priority: 50)
      // Guarantees an immediate temporal fallback anchor every 8 frames across 1,262 frames
      for (let i = 1; i <= TOTAL_FRAMES; i += SKELETON_STEP) {
        if (isCancelled) break;
        requestFrameWithPriority(i, 50);
      }

      // Step 3: Progressive Infill Stream during idle cycles (Priority: 10)
      // Low priority so user scroll requests ALWAYS preempt infill requests
      for (let i = CRITICAL_PRELOAD_COUNT + 1; i <= TOTAL_FRAMES; i++) {
        if (isCancelled) break;
        if (i % SKELETON_STEP !== 1) {
          requestFrameWithPriority(i, 10);
        }
      }
    };

    bootEngine();

    return () => {
      isCancelled = true;
    };
  }, [getFramePath, registerLoadedFrame, requestFrameWithPriority, drawFrameToCanvas]);

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

      const smoothFactor = 1 - Math.exp(-48 * dt);
      const prevFloat = smoothFrameRef.current;
      smoothFrameRef.current += (targetFrameFloat - smoothFrameRef.current) * smoothFactor;
      const renderFloat = smoothFrameRef.current;
      currentFrameRef.current = renderFloat;

      // Track velocity for directional lookahead
      const velocity = (renderFloat - prevFloat) / dt;
      scrollVelocityRef.current = velocity;

      // Priority streaming around playhead
      schedulePriorityWindow(renderFloat, velocity);

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

      // Canvas Render Update: Draw sub-frame interpolated pixels
      const lastDrawn = lastDrawnFloatRef.current;
      const deltaSinceLastDraw = lastDrawn === null ? Infinity : Math.abs(renderFloat - lastDrawn);

      if (deltaSinceLastDraw > 0.0015) {
        drawFrameToCanvas(renderFloat);
      }

      // Decoupled React State Update: Throttle component re-renders to milestone boundaries
      // Prevents 60 Virtual DOM reconciliations per second while keeping overlays perfectly synchronized
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
        (isBoundaryCrossed || timeSinceLastReactUpdate > 60 || Math.abs(roundedFrame - lastReportedFrameRef.current) >= 4)
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
  }, [isReady, drawFrameToCanvas, onFrameUpdate, schedulePriorityWindow]);

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

      schedulePriorityWindow(target, 1.0);

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
  }, [targetNavigationFrame, schedulePriorityWindow, onNavigationComplete]);

  const handleExploreEvents = () => {
    if (lenisRef.current) {
      const targetProgress = (630 - 1) / (TOTAL_FRAMES - 1);
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      schedulePriorityWindow(630, 1.0);
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
            src="/still_shot.mp4"
            autoPlay
            loop
            muted
            playsInline
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
