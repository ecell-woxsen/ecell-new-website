"use client";

import React from "react";
import { ChevronDown, Sparkles, Rocket, ShieldCheck, Layers } from "lucide-react";

interface HeroOverlayProps {
  currentFrame: number;
  onExploreClick: () => void;
}

export default function HeroOverlay({
  currentFrame,
  onExploreClick,
}: HeroOverlayProps) {
  // Smoothly fade out from frame 1 to frame 40
  const opacity = Math.max(0, 1 - (currentFrame - 1) / 35);
  const translateY = (currentFrame - 1) * 2.5;

  if (opacity <= 0.01) return null;

  return (
    <div
      className="fixed inset-0 z-20 flex flex-col justify-between items-center p-6 sm:p-12 pointer-events-none transition-opacity duration-300"
      style={{
        opacity,
        transform: `translateY(-${translateY}px)`,
      }}
    >
      {/* Top spacer for navbar */}
      <div className="h-16" />

      {/* Center Hero Content */}
      <div className="max-w-4xl mx-auto text-center flex flex-col items-center gap-6 pointer-events-auto">
        {/* Glowing Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900/80 border border-emerald-500/30 backdrop-blur-xl shadow-lg shadow-emerald-950/30 animate-in fade-in slide-in-from-bottom-3 duration-700">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <span className="text-xs sm:text-sm font-mono tracking-wider font-semibold text-emerald-300">
            OFFICIAL ENTREPRENEURSHIP CELL · WOXSEN UNIVERSITY
          </span>
        </div>

        {/* Main Headings */}
        <div className="space-y-3">
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold font-heading tracking-tight leading-[1.08] text-white">
            Where Innovation Meets{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-sky-400">
              Initiative.
            </span>
          </h1>
          <p className="max-w-2xl mx-auto text-base sm:text-lg md:text-xl text-slate-200/90 font-normal leading-relaxed">
            A dynamic student-led movement dedicated to transforming campus ambition into scalable ventures, breakthrough ideas, and impactful leadership.
          </p>
        </div>

        {/* Value Chips */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-950/60 border border-white/10 backdrop-blur-md text-xs font-medium text-slate-300">
            <Rocket className="w-3.5 h-3.5 text-emerald-400" />
            <span>Grassroots Innovation</span>
          </div>
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-950/60 border border-white/10 backdrop-blur-md text-xs font-medium text-slate-300">
            <Layers className="w-3.5 h-3.5 text-teal-400" />
            <span>6+ Interdisciplinary Schools</span>
          </div>
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-950/60 border border-white/10 backdrop-blur-md text-xs font-medium text-slate-300">
            <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
            <span>Founded July 2025</span>
          </div>
        </div>

        {/* Explore Button */}
        <button
          onClick={onExploreClick}
          className="mt-2 px-8 py-3.5 rounded-full bg-white text-slate-950 font-bold text-sm tracking-wide shadow-2xl hover:bg-slate-100 hover:scale-105 active:scale-95 transition-all duration-300 cursor-pointer pointer-events-auto flex items-center gap-2"
        >
          <span>Begin Journey</span>
          <ChevronDown className="w-4 h-4 text-slate-950 animate-bounce" />
        </button>
      </div>

      {/* Bottom Scroll Prompt */}
      <div className="flex flex-col items-center gap-2 pointer-events-auto">
        <span className="text-[11px] font-mono tracking-widest uppercase text-slate-400">
          Scroll down to enter the hub
        </span>
        <div className="w-5 h-9 rounded-full border-2 border-white/20 flex justify-center p-1 backdrop-blur-sm">
          <div className="w-1 h-2 bg-emerald-400 rounded-full animate-bounce" />
        </div>
      </div>
    </div>
  );
}
