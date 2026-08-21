"use client";

import React from "react";

interface HeroOverlayProps {
  currentFrame: number;
  onExploreClick: () => void;
  onOpenJoinModal?: () => void;
}

export default function HeroOverlay({
  currentFrame,
  onExploreClick,
  onOpenJoinModal,
}: HeroOverlayProps) {
  // Smoothly fade out from frame 1 to frame 35
  const opacity = Math.max(0, 1 - (currentFrame - 1) / 32);
  const translateY = (currentFrame - 1) * 2;

  if (opacity <= 0.01) return null;

  return (
    <div
      className="fixed inset-0 z-20 flex flex-col justify-center items-center px-4 text-center pointer-events-none transition-opacity duration-300"
      style={{
        opacity,
        transform: `translateY(-${translateY}px)`,
      }}
    >
      <div className="max-w-2xl mx-auto flex flex-col items-center pointer-events-auto">
        {/* Eyebrow / Kicker in Space Mono */}
        <p className="font-mono text-[10px] sm:text-xs font-semibold tracking-[0.22em] text-white uppercase mb-2.5 sm:mb-3 select-none drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
          ENTREPRENEURSHIP CELL · WOXSEN UNIVERSITY
        </p>

        {/* Main Display Headline on a Single Baseline-Aligned Line */}
        <h1 className="font-display flex items-baseline justify-center whitespace-nowrap select-none mb-3 sm:mb-4 uppercase leading-none drop-shadow-[0_4px_16px_rgba(0,0,0,0.8)]">
          <span className="text-3xl sm:text-5xl md:text-6xl font-bold text-white tracking-wide">
            WHERE
          </span>
          <span className="text-4xl sm:text-6xl md:text-7xl font-bold text-[#22c55e] tracking-wide mx-1.5 sm:mx-2.5 inline-block">
            BUILDERS
          </span>
          <span className="text-3xl sm:text-5xl md:text-6xl font-bold text-white tracking-wide">
            START.
          </span>
        </h1>

        {/* Subtitle Description in DM Sans */}
        <p className="font-body max-w-lg text-xs sm:text-sm md:text-[15px] text-white font-medium leading-relaxed mb-6 sm:mb-7 px-4 drop-shadow-[0_2px_12px_rgba(0,0,0,0.95)]">
          The Entrepreneurship Cell of Woxsen University. We build founders, not just businesses — through hands-on programs, mentorship, and a network that ships.
        </p>

        {/* Action Buttons in Space Mono */}
        <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3 font-mono">
          <button
            onClick={onExploreClick}
            className="px-5 sm:px-6 py-2.5 rounded-full bg-[#16a34a] hover:bg-[#22c55e] text-white text-[11px] sm:text-xs font-bold tracking-wider uppercase shadow-lg shadow-emerald-950/40 transition-all hover:scale-105 active:scale-95 cursor-pointer"
          >
            EXPLORE EVENTS
          </button>

          <button
            onClick={onOpenJoinModal}
            className="px-5 sm:px-6 py-2.5 rounded-full bg-black/40 hover:bg-black/60 text-slate-200 hover:text-white text-[11px] sm:text-xs font-bold tracking-wider uppercase border border-white/20 hover:border-white/40 backdrop-blur-md transition-all hover:scale-105 active:scale-95 cursor-pointer"
          >
            SUBMIT YOUR IDEA
          </button>
        </div>
      </div>
    </div>
  );
}
