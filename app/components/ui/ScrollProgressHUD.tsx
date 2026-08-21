"use client";

import React from "react";
import { Compass } from "lucide-react";

interface ScrollProgressHUDProps {
  currentFrame: number;
  totalFrames: number;
}

export default function ScrollProgressHUD({
  currentFrame,
  totalFrames,
}: ScrollProgressHUDProps) {
  const progressPercent = Math.min(
    100,
    Math.max(0, Math.round((currentFrame / totalFrames) * 100))
  );

  let chapterName = "CAMPUS APPROACH";
  let chapterIndex = "01";

  if (currentFrame >= 370 && currentFrame < 390) {
    chapterName = "ABOUT E-CELL";
    chapterIndex = "02";
  } else if (currentFrame >= 390 && currentFrame < 600) {
    chapterName = "INSIDE HEADQUARTERS";
    chapterIndex = "03";
  } else if (currentFrame >= 600 && currentFrame < 740) {
    chapterName = "FLAGSHIP INITIATIVES";
    chapterIndex = "04";
  } else if (currentFrame >= 740 && currentFrame < 920) {
    chapterName = "CORE LEADERSHIP";
    chapterIndex = "05";
  } else if (currentFrame >= 920) {
    chapterName = "CONNECT & COLLABORATE";
    chapterIndex = "06";
  }

  return (
    <div className="fixed bottom-6 right-6 z-40 flex items-center gap-3 px-4 py-2 rounded-full bg-slate-950/75 border border-white/10 backdrop-blur-xl shadow-2xl pointer-events-none transition-opacity duration-300">
      <div className="flex items-center gap-2">
        <Compass className="w-3.5 h-3.5 text-emerald-400 animate-spin-slow" />
        <span className="text-[10px] font-mono text-emerald-400 font-semibold tracking-wider">
          CH {chapterIndex}
        </span>
        <span className="text-slate-500 text-xs">/</span>
        <span className="text-xs font-mono font-medium text-slate-300 tracking-wide">
          {chapterName}
        </span>
      </div>

      <div className="h-3 w-px bg-white/15" />

      {/* Progress Metric */}
      <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-400">
        <span className="text-white font-semibold">{progressPercent}%</span>
      </div>

      {/* Mini Progress Bar */}
      <div className="w-12 h-1 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-150 rounded-full"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  );
}
