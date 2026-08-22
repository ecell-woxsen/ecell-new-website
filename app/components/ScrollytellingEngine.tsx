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

const TOTAL_FRAMES = 1078;
const CRITICAL_PRELOAD_COUNT = 60;

// Dynamic Sensitivity Curve calibrated for 1078 total frames
const getDynamicSensitivity = (frame: number): number => {
  // Hero Landing (Frames 1 - 15) -> Slow, calm drift
  if (frame <= 15) {
    return 0.10;
  }
  // Act 1 Transit: Campus approach (Frames 15 - 345) -> Gentle, steady glide
  if (frame < 345) {
    return 0.22;
  }
  // Deceleration into Door Threshold (Frames 345 - 368)
  if (frame >= 345 && frame < 368) {
    const t = (frame - 345) / 23;
    return 0.22 - t * 0.14;
  }
  // Milestone 1: About E-Cell Door Scene (Frames 368 - 395) -> Slow reading drift
  if (frame >= 368 && frame <= 395) {
    return 0.08;
  }
  // Acceleration out of Door into Boardroom (Frames 395 - 420)
  if (frame > 395 && frame <= 420) {
    const t = (frame - 395) / 25;
    return 0.08 + t * 0.14;
  }
  // Act 2 Transit: Boardroom Traversal (Frames 420 - 600) -> Gentle, steady glide
  if (frame > 420 && frame < 600) {
    return 0.22;
  }
  // Deceleration into Wall Gallery (Frames 600 - 635)
  if (frame >= 600 && frame < 635) {
    const t = (frame - 600) / 35;
    return 0.22 - t * 0.12;
  }
  // Milestone 2A: Flagship Events (Frames 635 - 730) -> Slow reading pace
  if (frame >= 635 && frame <= 730) {
    return 0.10;
  }
  // Transit between Events and Team (Frames 730 - 810) -> Gentle glide
  if (frame > 730 && frame < 810) {
    return 0.20;
  }
  // Milestone 2B: Core Team Leadership (Frames 810 - 930) -> Slow reading pace
  if (frame >= 810 && frame <= 930) {
    return 0.10;
  }
  // Transit between Team and Contact (Frames 930 - 1000) -> Gentle glide
  if (frame > 930 && frame < 1000) {
    return 0.20;
  }
  // Milestone 2C: Contact & Application (Frames 1000 - 1078) -> Slow reading pace
  return 0.10;
};

// Very Low Friction (Near-Frictionless, Ultra-Buttery Momentum Drift)
const getDynamicFriction = (frame: number): number => {
  const isReadingZone =
    frame <= 15 ||
    (frame >= 368 && frame <= 395) ||
    (frame >= 635 && frame <= 730) ||
    (frame >= 810 && frame <= 930) ||
    frame >= 1000;

  if (isReadingZone) {
    return 0.92; // Low friction inside reading zones for smooth, unhurried drifting
  }
  return 0.95; // Ultra-low friction in transits for frictionless cinematic glide
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

  // Physics Velocity & Position tracking
  const currentFrameRef = useRef(1);
  const velocityRef = useRef(0);
  const targetNavFrameRef = useRef<number | null>(null);
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
      const start = Math.max(1, centerFrame - 35);
      const end = Math.min(TOTAL_FRAMES, centerFrame + 75);
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

  // Respond to programmatic header navigation
  useEffect(() => {
    if (targetNavigationFrame !== null && targetNavigationFrame !== undefined) {
      targetNavFrameRef.current = Math.min(TOTAL_FRAMES, Math.max(1, targetNavigationFrame));
      velocityRef.current = 0;
      preloadPriorityWindow(targetNavigationFrame);
    }
  }, [targetNavigationFrame, preloadPriorityWindow]);

  // Physics Acceleration Wheel & Touch Interaction Listeners
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();

      // Clear any programmatic jump when user actively scrolls
      targetNavFrameRef.current = null;

      const current = currentFrameRef.current;
      const sensitivity = getDynamicSensitivity(current);

      // Gentle, slow impulse with low friction for long-lasting buttery drift
      const impulse = e.deltaY * sensitivity * 0.028;
      velocityRef.current += impulse;

      // Controlled max velocity for steady, cinematic speed
      const maxVelocity = 4.2;
      velocityRef.current = Math.max(-maxVelocity, Math.min(maxVelocity, velocityRef.current));

      preloadPriorityWindow(Math.round(current + velocityRef.current * 20));
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        touchStartYRef.current = e.touches[0].clientY;
        velocityRef.current = 0;
        targetNavFrameRef.current = null;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        e.preventDefault();
        const currentY = e.touches[0].clientY;
        const deltaY = touchStartYRef.current - currentY;
        touchStartYRef.current = currentY;

        const current = currentFrameRef.current;
        const sensitivity = getDynamicSensitivity(current);
        const impulse = deltaY * sensitivity * 0.035;
        velocityRef.current += impulse;

        const maxVelocity = 4.2;
        velocityRef.current = Math.max(-maxVelocity, Math.min(maxVelocity, velocityRef.current));

        preloadPriorityWindow(Math.round(current + velocityRef.current * 20));
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      let impulse = 0;
      const current = currentFrameRef.current;
      const sensitivity = getDynamicSensitivity(current);

      if (e.key === "ArrowDown" || e.key === "PageDown" || e.key === " ") {
        impulse = 2.0 * sensitivity;
      } else if (e.key === "ArrowUp" || e.key === "PageUp") {
        impulse = -2.0 * sensitivity;
      }

      if (impulse !== 0) {
        e.preventDefault();
        targetNavFrameRef.current = null;
        velocityRef.current += impulse;
        preloadPriorityWindow(Math.round(current + velocityRef.current * 20));
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

  // 60/120 FPS Ultra-Low Friction Physics Simulation Loop
  useEffect(() => {
    const renderLoop = () => {
      let current = currentFrameRef.current;

      // 1. Programmatic Navigation Target Animation (Navbar jumps)
      if (targetNavFrameRef.current !== null) {
        const target = targetNavFrameRef.current;
        const diff = target - current;

        if (Math.abs(diff) > 0.08) {
          current += diff * 0.10;
        } else {
          current = target;
          targetNavFrameRef.current = null;
          if (onNavigationComplete) {
            onNavigationComplete();
          }
        }
      }

      // 2. Physics-based Velocity Integration with Ultra-Low Friction
      if (Math.abs(velocityRef.current) > 0.001) {
        current += velocityRef.current;

        const friction = getDynamicFriction(current);
        velocityRef.current *= friction;

        // Clean seamless cutoff
        if (Math.abs(velocityRef.current) < 0.015) {
          velocityRef.current = 0;
        }
      }

      // 3. Strict Boundary Clamping [1, TOTAL_FRAMES]
      if (current < 1) {
        current = 1;
        velocityRef.current = 0;
      } else if (current > TOTAL_FRAMES) {
        current = TOTAL_FRAMES;
        velocityRef.current = 0;
      }

      currentFrameRef.current = current;

      // 4. Hero Video Crossfade calculation
      const vOpacity = Math.max(0, 1 - (current - 1) / 14);
      setVideoOpacity(vOpacity);

      // 5. Canvas Render Update
      const roundedFrame = Math.round(current);
      if (roundedFrame !== lastDrawnFrameRef.current) {
        drawFrameToCanvas(roundedFrame);
      }

      setCurrentFrame(roundedFrame);
      if (onFrameUpdate) {
        onFrameUpdate(roundedFrame);
      }

      animFrameIdRef.current = requestAnimationFrame(renderLoop);
    };

    animFrameIdRef.current = requestAnimationFrame(renderLoop);

    return () => {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, [drawFrameToCanvas, onFrameUpdate, onNavigationComplete]);

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
    targetNavFrameRef.current = 675;
    preloadPriorityWindow(675);
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

        {/* Overlay 2: Door About Us (Frames 368 - 395) */}
        <DoorAboutOverlay
          currentFrame={currentFrame}
          onOpenJoinModal={onOpenJoinModal}
        />

        {/* Overlay 3: Wall Gallery (Frames 605 - 1078) */}
        <WallGalleryOverlay
          currentFrame={currentFrame}
          onOpenJoinModal={onOpenJoinModal}
        />
      </div>
    </>
  );
}
