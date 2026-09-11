"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { getAssetUrl } from "../lib/assets";

interface PreloadManagerProps {
  progress: number;
  isReady: boolean;
  onEnter?: () => void;
}

// Hard maximum threshold: Screen is mathematically guaranteed to dismiss well under 10 seconds.
const HARD_WATCHDOG_MS = 10000;
const SKIP_ENABLE_MS = 1500;

export default function PreloadManager({ progress, isReady, onEnter }: PreloadManagerProps) {
  const [visible, setVisible] = useState(true);
  const [canSkip, setCanSkip] = useState(false);
  const [displayProgress, setDisplayProgress] = useState(0);
  const hasExitedRef = useRef(false);

  // Smooth progress interpolation to ensure 60fps counter glide without infinite loop
  useEffect(() => {
    let animId: number;
    const step = () => {
      setDisplayProgress((prev) => {
        if (prev < progress) {
          const delta = Math.max(1, Math.ceil((progress - prev) * 0.25));
          const next = Math.min(progress, prev + delta);
          if (next < progress) {
            animId = requestAnimationFrame(step);
          }
          return next;
        }
        return prev;
      });
    };
    if (displayProgress < progress) {
      animId = requestAnimationFrame(step);
    }
    return () => cancelAnimationFrame(animId);
  }, [progress, displayProgress]);

  // Enable minimal skip button early so user is never trapped
  useEffect(() => {
    const skipTimer = setTimeout(() => {
      setCanSkip(true);
    }, SKIP_ENABLE_MS);
    return () => clearTimeout(skipTimer);
  }, []);

  const handleTriggerEnter = () => {
    if (hasExitedRef.current) return;
    hasExitedRef.current = true;
    if (onEnter) onEnter();
  };

  // Hard watchdog timer: GUARANTEE the screen dismisses under 10 seconds
  useEffect(() => {
    const watchdog = setTimeout(() => {
      if (!isReady && !hasExitedRef.current) {
        handleTriggerEnter();
      }
    }, HARD_WATCHDOG_MS);

    return () => clearTimeout(watchdog);
  }, [isReady]);

  // Handle dismissal animation when ready
  useEffect(() => {
    if (isReady) {
      const timer = setTimeout(() => {
        setVisible(false);
      }, 450);
      return () => clearTimeout(timer);
    }
  }, [isReady]);

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#040608] text-white p-6 transition-all duration-500 ease-out select-none font-sans ${
        isReady ? "opacity-0 pointer-events-none scale-[1.02]" : "opacity-100 pointer-events-auto scale-100"
      }`}
      aria-label="Loading Experience"
    >
      {/* Subtle ambient lighting */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 sm:w-96 h-72 sm:h-96 bg-[#ee495c]/15 rounded-full blur-3xl pointer-events-none" />

      <div className="relative flex flex-col items-center max-w-sm w-full text-center">
        {/* Clean Logo without glass card */}
        <div className="relative w-32 h-32 sm:w-40 sm:h-40 mb-6 flex items-center justify-center">
          <Image
            src={getAssetUrl("/ecell-logo-v2.webp")}
            alt="E-Cell Woxsen"
            width={160}
            height={160}
            className="w-full h-full object-contain animate-pulse drop-shadow-[0_0_28px_rgba(238,73,92,0.35)]"
            priority
          />
        </div>

        {/* Brand Title */}
        <div className="text-white text-lg sm:text-xl tracking-widest uppercase mb-4">
          E-Cell Woxsen
        </div>

        {/* Precision Progress Track */}
        <div className="w-64 sm:w-72 h-[3px] bg-white/10 rounded-full overflow-hidden mb-3 relative">
          <div
            className="h-full bg-gradient-to-r from-[#cc2b3e] via-[#ee495c] to-[#ff7686] transition-all duration-150 rounded-full relative"
            style={{ width: `${Math.max(displayProgress, 8)}%` }}
          >
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white shadow-[0_0_8px_#ee495c]" />
          </div>
        </div>

        {/* Progress Percentage */}
        <div className="flex justify-center w-64 sm:w-72 text-sm text-[#ee495c] tracking-widest mb-8">
          <span>{displayProgress}%</span>
        </div>

        {/* Enter / Skip Button */}
        <div className="h-10 flex items-center justify-center">
          {(canSkip || isReady) && (
            <button
              onClick={handleTriggerEnter}
              className="group inline-flex items-center gap-2 px-5 py-2 rounded-full border border-[#ee495c]/40 bg-[#ee495c]/10 hover:bg-[#ee495c]/25 hover:border-[#ee495c]/70 text-white text-xs font-medium tracking-widest uppercase transition-all duration-200 cursor-pointer shadow-lg shadow-[#ee495c]/20 hover:shadow-[0_0_20px_rgba(238,73,92,0.35)] active:scale-95 animate-fade-in"
            >
              <span>{isReady ? "ENTER" : "SKIP INTRO"}</span>
              <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 text-[#ee495c] group-hover:text-white" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
