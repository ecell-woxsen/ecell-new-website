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
const CRITICAL_PRELOAD_COUNT = 60;
const SCROLL_TRACK_HEIGHT = TOTAL_FRAMES * 12; // 15,144px scroll track for 1:1 frame pacing

export default function ScrollytellingEngine({
  onFrameUpdate,
  onOpenJoinModal,
  targetNavigationFrame,
  onNavigationComplete,
  isJoinModalOpen = false,
}: ScrollytellingEngineProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lenisRef = useRef<Lenis | null>(null);

  // Frames cache & loading tracking
  const framesCacheRef = useRef<Map<number, HTMLImageElement>>(new Map());
  const loadingSetRef = useRef<Set<number>>(new Set());
  const [loadProgress, setLoadProgress] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [currentFrame, setCurrentFrame] = useState(1);
  const [videoOpacity, setVideoOpacity] = useState(1);

  // Rendering & window dimension refs
  const currentFrameRef = useRef(1);
  const lastDrawnFloatRef = useRef<number | null>(null);
  const lastReportedFrameRef = useRef<number>(1);
  const windowWidthRef = useRef(0);
  const windowHeightRef = useRef(0);

  // Helper to format frame number e.g. 1 -> "/ecell_shots/00001.webp"
  const getFramePath = useCallback((frameNum: number) => {
    const clamped = Math.min(TOTAL_FRAMES, Math.max(1, frameNum));
    const padded = String(clamped).padStart(5, "0");
    return `/ecell_shots/${padded}.webp`;
  }, []);

  // Request a single frame into memory with off-main-thread image decoding
  const requestFrame = useCallback(
    (frameIdx: number) => {
      const idx = Math.min(TOTAL_FRAMES, Math.max(1, frameIdx));
      if (framesCacheRef.current.has(idx) || loadingSetRef.current.has(idx)) {
        return;
      }
      loadingSetRef.current.add(idx);
      const img = new Image();
      img.src = getFramePath(idx);
      img.onload = () => {
        framesCacheRef.current.set(idx, img);
        loadingSetRef.current.delete(idx);
      };
      img.onerror = () => {
        loadingSetRef.current.delete(idx);
      };
      if ("decode" in img && typeof img.decode === "function") {
        img.decode().catch(() => {});
      }
    },
    [getFramePath]
  );

  // Priority window loader ahead of scroll trajectory
  const preloadPriorityWindow = useCallback(
    (centerFrame: number) => {
      const center = Math.round(centerFrame);
      const start = Math.max(1, center - 35);
      const end = Math.min(TOTAL_FRAMES, center + 75);
      for (let i = start; i <= end; i++) {
        requestFrame(i);
      }
    },
    [requestFrame]
  );

  // Canvas drawing function with Sub-Frame Alpha Cross-Fading
  const drawFrameToCanvas = useCallback(
    (frameFloat: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const clamped = Math.min(TOTAL_FRAMES, Math.max(1, frameFloat));
      const frameA = Math.floor(clamped);
      const frameB = Math.min(TOTAL_FRAMES, frameA + 1);
      const blendAlpha = clamped - frameA;

      let imgA = framesCacheRef.current.get(frameA);

      // Fallback to nearest cached frame if target frame is still fetching
      if (!imgA) {
        requestFrame(frameA);

        let closestFrame = -1;
        let minDistance = Infinity;

        for (const cachedIdx of framesCacheRef.current.keys()) {
          const dist = Math.abs(cachedIdx - frameA);
          if (dist < minDistance) {
            minDistance = dist;
            closestFrame = cachedIdx;
          }
        }

        if (closestFrame !== -1) {
          imgA = framesCacheRef.current.get(closestFrame);
        }
      }

      if (!imgA || !imgA.complete || imgA.naturalWidth === 0) {
        return;
      }

      // Pre-request frameB if blend is significant
      let imgB: HTMLImageElement | undefined;
      if (blendAlpha > 0.005 && frameB !== frameA) {
        imgB = framesCacheRef.current.get(frameB);
        if (!imgB) {
          requestFrame(frameB);
        }
      }

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
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

      const imgWidth = imgA.naturalWidth || imgA.width;
      const imgHeight = imgA.naturalHeight || imgA.height;
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

      // 1. Draw base frame
      ctx.globalAlpha = 1.0;
      ctx.drawImage(imgA, offsetX, offsetY, drawW, drawH);

      // 2. Cross-dissolve next frame for 120 FPS sub-frame smoothness
      if (blendAlpha > 0.005 && imgB && imgB.complete && imgB.naturalWidth > 0) {
        ctx.globalAlpha = blendAlpha;
        ctx.drawImage(imgB, offsetX, offsetY, drawW, drawH);
        ctx.globalAlpha = 1.0;
      }

      lastDrawnFloatRef.current = clamped;
    },
    [requestFrame]
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

  // Initial critical preload on mount
  useEffect(() => {
    let isCancelled = false;
    let loaded = 0;

    const initialLoad = async () => {
      const promises: Promise<void>[] = [];
      for (let i = 1; i <= CRITICAL_PRELOAD_COUNT; i++) {
        promises.push(
          new Promise((resolve) => {
            const img = new Image();
            img.src = getFramePath(i);
            img.onload = () => {
              if (!isCancelled) {
                framesCacheRef.current.set(i, img);
                loaded++;
                setLoadProgress(Math.round((loaded / CRITICAL_PRELOAD_COUNT) * 100));
              }
              resolve();
            };
            img.onerror = () => {
              resolve();
            };
          })
        );
      }

      await Promise.all(promises);
      if (isCancelled) return;

      setIsReady(true);
      setLoadProgress(100);

      // Render first frame immediately
      drawFrameToCanvas(1);

      // Background stream remaining frames progressively
      const streamRemaining = async () => {
        for (let i = CRITICAL_PRELOAD_COUNT + 1; i <= TOTAL_FRAMES; i += 25) {
          if (isCancelled) break;
          for (let j = i; j < i + 25 && j <= TOTAL_FRAMES; j++) {
            requestFrame(j);
          }
          await new Promise((r) => setTimeout(r, 16));
        }
      };

      streamRemaining();
    };

    initialLoad();

    return () => {
      isCancelled = true;
    };
  }, [getFramePath, requestFrame, drawFrameToCanvas]);

  // Single Global Lenis Smooth Scroll Engine Instance & Synchronized RAF Loop
  useEffect(() => {
    if (!isReady) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const lenis = new Lenis({
      duration: prefersReducedMotion ? 0 : 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // Apple-style cubic easeOutExponential
      orientation: "vertical",
      gestureOrientation: "vertical",
      smoothWheel: true,
      wheelMultiplier: 1.0,
      touchMultiplier: 1.5,
      infinite: false,
    });

    lenisRef.current = lenis;

    let animFrameId: number;

    const renderLoop = (time: number) => {
      lenis.raf(time);

      const scrollY = lenis.scroll;
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      const progress = maxScroll > 0 ? Math.min(1, Math.max(0, scrollY / maxScroll)) : 0;

      const frameFloat = 1 + progress * (TOTAL_FRAMES - 1);
      currentFrameRef.current = frameFloat;

      // Priority stream loader around current position
      preloadPriorityWindow(frameFloat);

      // Hero Video Crossfade calculation
      const vOpacity = Math.max(0, 1 - (frameFloat - 1) / 14);
      setVideoOpacity(vOpacity);

      // Canvas Render Update
      const lastDrawn = lastDrawnFloatRef.current;
      const deltaSinceLastDraw = lastDrawn === null ? Infinity : Math.abs(frameFloat - lastDrawn);

      if (deltaSinceLastDraw > 0.005) {
        drawFrameToCanvas(frameFloat);
      }

      // Notify React overlays only on integer boundary transitions
      const roundedFrame = Math.round(frameFloat);
      if (roundedFrame !== lastReportedFrameRef.current) {
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
  }, [isReady, drawFrameToCanvas, onFrameUpdate, preloadPriorityWindow]);

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

      preloadPriorityWindow(target);

      lenisRef.current.scrollTo(targetScrollY, {
        duration: 1.4,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        onComplete: () => {
          if (onNavigationComplete) {
            onNavigationComplete();
          }
        },
      });
    }
  }, [targetNavigationFrame, preloadPriorityWindow, onNavigationComplete]);

  const handleExploreEvents = () => {
    if (lenisRef.current) {
      const targetProgress = (638 - 1) / (TOTAL_FRAMES - 1);
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      lenisRef.current.scrollTo(targetProgress * maxScroll, { duration: 1.4 });
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
        {/* HTML5 Scrollytelling Canvas */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full object-cover z-0"
        />

        {/* Ambient Video (Loops seamlessly at hero frame 1, fades on scroll) */}
        {videoOpacity > 0.01 && (
          <div
            className="absolute inset-0 w-full h-full pointer-events-none transition-opacity duration-200 z-10"
            style={{ opacity: videoOpacity }}
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
        )}

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

        {/* Overlay 3: Wall Gallery (Frames 603 - 840) */}
        <WallGalleryOverlay
          currentFrame={currentFrame}
          onOpenJoinModal={onOpenJoinModal}
        />
      </div>
    </>
  );
}

