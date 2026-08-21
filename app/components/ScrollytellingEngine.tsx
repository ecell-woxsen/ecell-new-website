"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import PreloadManager from "./PreloadManager";
import HeroOverlay from "./overlays/HeroOverlay";
import DoorAboutOverlay from "./overlays/DoorAboutOverlay";
import WallGalleryOverlay from "./overlays/WallGalleryOverlay";

interface ScrollytellingEngineProps {
  onFrameUpdate?: (frame: number) => void;
  onOpenJoinModal: () => void;
  targetNavigationFrame?: number | null;
  onNavigationComplete?: () => void;
}

const TOTAL_FRAMES = 840;
const CRITICAL_PRELOAD_COUNT = 60;

// Dynamic Non-Linear Scroll Sensitivity Curve with Sticky Section Resistance
const getDynamicSensitivity = (frame: number): number => {
  // Section 0 Sticky Pocket: Hero Landing (Frames 1 - 12)
  if (frame <= 12) {
    return 0.040;
  }
  // Act 1 Transit: Campus approach (Frames 13 - 345) -> Smooth, swift glide
  if (frame < 345) {
    return 0.28;
  }
  // Deceleration into Door Threshold (Frames 345 - 368)
  if (frame >= 345 && frame < 368) {
    const t = (frame - 345) / 23;
    return 0.28 - t * 0.25; // smoothly drops to 0.030
  }
  // Section 1 Sticky Pocket: About E-Cell Door Scene (Frames 368 - 395)
  if (frame >= 368 && frame <= 395) {
    return 0.030;
  }
  // Acceleration out of Door into Boardroom (Frames 395 - 415)
  if (frame > 395 && frame <= 415) {
    const t = (frame - 395) / 20;
    return 0.030 + t * 0.25; // smoothly rises back to 0.28
  }
  // Act 2 Transit: Boardroom Traversal (Frames 415 - 600) -> Smooth, swift glide
  if (frame > 415 && frame < 600) {
    return 0.28;
  }
  // Deceleration into Events Section (Frames 600 - 620)
  if (frame >= 600 && frame < 620) {
    const t = (frame - 600) / 20;
    return 0.28 - t * 0.245; // smoothly drops to 0.035
  }
  // Section 2 Sticky Pocket: Flagship Events (Frames 620 - 660)
  if (frame >= 620 && frame <= 660) {
    return 0.035;
  }
  // Transit between Events and Team (Frames 660 - 705) -> Swift glide
  if (frame > 660 && frame < 705) {
    return 0.22;
  }
  // Section 3 Sticky Pocket: Core Team Leadership (Frames 705 - 750)
  if (frame >= 705 && frame <= 750) {
    return 0.035;
  }
  // Transit between Team and Contact (Frames 750 - 790) -> Swift glide
  if (frame > 750 && frame < 790) {
    return 0.22;
  }
  // Section 4 Sticky Pocket: Contact & Community (Frames 790 - 840)
  return 0.035;
};

// Dynamic Lerp Damping factor (Cushions firmly in reading pockets, snappy in transits)
const getDynamicLerpFactor = (frame: number): number => {
  const isStickyPocket =
    frame <= 12 ||
    (frame >= 368 && frame <= 395) ||
    (frame >= 620 && frame <= 660) ||
    (frame >= 705 && frame <= 750) ||
    frame >= 790;

  if (isStickyPocket) {
    return 0.10; // Cushioned, sticky resistance inside sections
  }
  return 0.18; // Crisp, responsive glide in transit zones
};

export default function ScrollytellingEngine({
  onFrameUpdate,
  onOpenJoinModal,
  targetNavigationFrame,
  onNavigationComplete,
}: ScrollytellingEngineProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Frames cache & loading tracking
  const framesCacheRef = useRef<Map<number, HTMLImageElement>>(new Map());
  const loadingSetRef = useRef<Set<number>>(new Set());
  const [loadProgress, setLoadProgress] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [currentFrame, setCurrentFrame] = useState(1);
  const [videoOpacity, setVideoOpacity] = useState(1);

  // Animation and virtual scroll refs
  const targetFrameRef = useRef(1);
  const currentFrameRef = useRef(1);
  const animFrameIdRef = useRef<number | null>(null);
  const lastDrawnFrameRef = useRef<number | null>(null);
  const touchStartYRef = useRef(0);

  // Helper to format frame number e.g. 1 -> "/ecell_shots/00001.webp"
  const getFramePath = useCallback((frameNum: number) => {
    const clamped = Math.min(TOTAL_FRAMES, Math.max(1, frameNum));
    const padded = String(clamped).padStart(5, "0");
    return `/ecell_shots/${padded}.webp`;
  }, []);

  // Request a single frame into memory
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
        const cur = Math.round(currentFrameRef.current);
        if (Math.abs(cur - idx) <= 2) {
          drawFrameToCanvas(cur);
        }
      };
      img.onerror = () => {
        loadingSetRef.current.delete(idx);
      };
    },
    [getFramePath]
  );

  // Priority window loader ahead of scroll trajectory
  const preloadPriorityWindow = useCallback(
    (centerFrame: number) => {
      const start = Math.max(1, centerFrame - 20);
      const end = Math.min(TOTAL_FRAMES, centerFrame + 40);
      for (let i = start; i <= end; i++) {
        requestFrame(i);
      }
    },
    [requestFrame]
  );

  // Canvas drawing function with DPI scaling and nearest loaded frame fallback
  const drawFrameToCanvas = useCallback((frameIdx: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let img = framesCacheRef.current.get(frameIdx);

    // If exact frame is still loading, request it and fallback to nearest cached frame
    if (!img) {
      requestFrame(frameIdx);

      let closestFrame = -1;
      let minDistance = Infinity;

      for (const cachedIdx of framesCacheRef.current.keys()) {
        const dist = Math.abs(cachedIdx - frameIdx);
        if (dist < minDistance) {
          minDistance = dist;
          closestFrame = cachedIdx;
        }
      }

      if (closestFrame !== -1) {
        img = framesCacheRef.current.get(closestFrame);
      }
    }

    if (!img || !img.complete || img.naturalWidth === 0) {
      return;
    }

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = window.innerWidth;
    const height = window.innerHeight;

    const targetWidth = Math.floor(width * dpr);
    const targetHeight = Math.floor(height * dpr);

    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
      canvas.width = targetWidth;
      canvas.height = targetHeight;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const imgWidth = img.naturalWidth || img.width;
    const imgHeight = img.naturalHeight || img.height;
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

    ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
    lastDrawnFrameRef.current = frameIdx;
  }, [requestFrame]);

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
        for (let i = CRITICAL_PRELOAD_COUNT + 1; i <= TOTAL_FRAMES; i += 20) {
          if (isCancelled) break;
          for (let j = i; j < i + 20 && j <= TOTAL_FRAMES; j++) {
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

  // Respond to programmatic header navigation
  useEffect(() => {
    if (targetNavigationFrame !== null && targetNavigationFrame !== undefined) {
      targetFrameRef.current = Math.min(TOTAL_FRAMES, Math.max(1, targetNavigationFrame));
      preloadPriorityWindow(targetNavigationFrame);
      if (onNavigationComplete) {
        onNavigationComplete();
      }
    }
  }, [targetNavigationFrame, onNavigationComplete, preloadPriorityWindow]);

  // Non-Linear Virtual Scroll Engine
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();

      const currentTarget = targetFrameRef.current;
      const sensitivity = getDynamicSensitivity(currentTarget);
      const delta = e.deltaY * sensitivity;

      const newTarget = Math.max(
        1,
        Math.min(TOTAL_FRAMES, currentTarget + delta)
      );

      targetFrameRef.current = newTarget;
      preloadPriorityWindow(Math.round(newTarget));

      // Video crossfade at top
      const vOpacity = Math.max(0, 1 - (newTarget - 1) / 12);
      setVideoOpacity(vOpacity);
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        touchStartYRef.current = e.touches[0].clientY;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        e.preventDefault();
        const currentY = e.touches[0].clientY;
        const deltaY = touchStartYRef.current - currentY;
        touchStartYRef.current = currentY;

        const currentTarget = targetFrameRef.current;
        const sensitivity = getDynamicSensitivity(currentTarget);
        const delta = deltaY * sensitivity;

        const newTarget = Math.max(
          1,
          Math.min(TOTAL_FRAMES, currentTarget + delta)
        );

        targetFrameRef.current = newTarget;
        preloadPriorityWindow(Math.round(newTarget));

        const vOpacity = Math.max(0, 1 - (newTarget - 1) / 12);
        setVideoOpacity(vOpacity);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      let step = 0;
      const currentTarget = targetFrameRef.current;
      const isSlowZone = (currentTarget >= 365 && currentTarget <= 395) || currentTarget >= 595;
      const deltaMagnitude = isSlowZone ? 5 : 14;

      if (e.key === "ArrowDown" || e.key === "PageDown" || e.key === " ") {
        step = deltaMagnitude;
      } else if (e.key === "ArrowUp" || e.key === "PageUp") {
        step = -deltaMagnitude;
      }

      if (step !== 0) {
        e.preventDefault();
        const newTarget = Math.max(
          1,
          Math.min(TOTAL_FRAMES, currentTarget + step)
        );
        targetFrameRef.current = newTarget;
        preloadPriorityWindow(Math.round(newTarget));

        const vOpacity = Math.max(0, 1 - (newTarget - 1) / 12);
        setVideoOpacity(vOpacity);
      }
    };

    window.addEventListener("wheel", handleWheel, { passive: false });
    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("keydown", handleKeyDown, { passive: false });

    return () => {
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [preloadPriorityWindow]);

  // 60 FPS Adaptive Linear Interpolation (Lerp) Animation Loop
  useEffect(() => {
    const renderLoop = () => {
      const target = targetFrameRef.current;
      const current = currentFrameRef.current;
      const diff = target - current;

      const lerpFactor = getDynamicLerpFactor(current);

      if (Math.abs(diff) > 0.001) {
        currentFrameRef.current += diff * lerpFactor;
      } else {
        currentFrameRef.current = target;
      }

      const roundedFrame = Math.round(currentFrameRef.current);
      const clampedFrame = Math.min(TOTAL_FRAMES, Math.max(1, roundedFrame));

      if (clampedFrame !== lastDrawnFrameRef.current) {
        drawFrameToCanvas(clampedFrame);
      }

      setCurrentFrame(clampedFrame);
      if (onFrameUpdate) {
        onFrameUpdate(clampedFrame);
      }

      animFrameIdRef.current = requestAnimationFrame(renderLoop);
    };

    animFrameIdRef.current = requestAnimationFrame(renderLoop);

    return () => {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, [drawFrameToCanvas, onFrameUpdate]);

  // Resize handler
  useEffect(() => {
    const handleResize = () => {
      const rounded = Math.round(currentFrameRef.current);
      drawFrameToCanvas(rounded);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [drawFrameToCanvas]);

  const handleExploreEvents = () => {
    targetFrameRef.current = 630;
    preloadPriorityWindow(630);
  };

  return (
    <>
      {/* Frame Loading Screen */}
      <PreloadManager progress={loadProgress} isReady={isReady} />

      {/* Fixed Viewport Container with Scroll Lock */}
      <div
        ref={containerRef}
        className="fixed inset-0 w-screen h-screen overflow-hidden select-none bg-[#040608]"
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

        {/* Overlay 2: Door About Us (Frames 370 - 390) */}
        <DoorAboutOverlay
          currentFrame={currentFrame}
          onOpenJoinModal={onOpenJoinModal}
        />

        {/* Overlay 3: Wall Gallery (Frames 600 - 840) */}
        <WallGalleryOverlay
          currentFrame={currentFrame}
          onOpenJoinModal={onOpenJoinModal}
        />
      </div>
    </>
  );
}
