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
      className="fixed inset-0 z-20 flex flex-col justify-center items-center px-4 sm:px-8 text-center pointer-events-none transition-opacity duration-300"
      style={{
        opacity,
        transform: `translateY(-${translateY}px)`,
      }}
    >
      <div className="max-w-5xl mx-auto flex flex-col items-center pointer-events-auto">
        {/* Eyebrow / Kicker in Space Mono */}
        <p className="font-mono text-[11px] sm:text-xs md:text-sm font-medium tracking-[0.25em] text-slate-300 uppercase mb-3 sm:mb-4 select-none">
          ENTREPRENEURSHIP CELL · WOXSEN UNIVERSITY
        </p>

        {/* Main Display Headline on a Single Baseline-Aligned Line */}
        <h1 className="font-display flex items-baseline justify-center whitespace-nowrap select-none mb-4 sm:mb-6 uppercase leading-none">
          <span className="text-5xl sm:text-7xl md:text-8xl lg:text-[7rem] font-bold text-white tracking-wide">
            WHERE
          </span>
          <span className="text-6xl sm:text-8xl md:text-9xl lg:text-[8.8rem] font-bold text-[#22c55e] tracking-wide mx-2.5 sm:mx-4 inline-block">
            BUILDERS
          </span>
          <span className="text-5xl sm:text-7xl md:text-8xl lg:text-[7rem] font-bold text-white tracking-wide">
            START.
          </span>
        </h1>

        {/* Subtitle Description in DM Sans */}
        <p className="font-body max-w-2xl text-xs sm:text-sm md:text-base text-slate-300 font-normal leading-relaxed mb-8 px-4">
          The Entrepreneurship Cell of Woxsen University. We build founders, not just businesses — through hands-on programs, mentorship, and a network that ships.
        </p>

        {/* Action Buttons in Space Mono */}
        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 font-mono">
          <button
            onClick={onExploreClick}
            className="px-7 py-3 rounded-full bg-[#16a34a] hover:bg-[#22c55e] text-white text-xs sm:text-sm font-bold tracking-wider uppercase shadow-lg shadow-emerald-950/40 transition-all hover:scale-105 active:scale-95 cursor-pointer"
          >
            EXPLORE EVENTS
          </button>

          <button
            onClick={onOpenJoinModal}
            className="px-7 py-3 rounded-full bg-black/40 hover:bg-black/60 text-slate-200 hover:text-white text-xs sm:text-sm font-bold tracking-wider uppercase border border-white/20 hover:border-white/40 backdrop-blur-md transition-all hover:scale-105 active:scale-95 cursor-pointer"
          >
            SUBMIT YOUR IDEA
          </button>
        </div>
      </div>
    </div>
  );
}
