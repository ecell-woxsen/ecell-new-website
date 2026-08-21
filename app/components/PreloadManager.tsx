"use client";

import React from "react";
import Image from "next/image";
import { Sparkles } from "lucide-react";

interface PreloadManagerProps {
  progress: number;
  isReady: boolean;
}

export default function PreloadManager({ progress, isReady }: PreloadManagerProps) {
  if (isReady) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#040608] text-white p-6 transition-opacity duration-500">
      <div className="relative flex flex-col items-center max-w-sm text-center">
        {/* Glow behind logo */}
        <div className="absolute -top-12 w-48 h-48 bg-emerald-500/20 rounded-full blur-3xl animate-pulse-glow" />

        {/* E-Cell Logo */}
        <div className="relative w-20 h-20 mb-6 rounded-2xl bg-slate-900/90 border border-white/20 p-3 shadow-2xl flex items-center justify-center overflow-hidden">
          <Image
            src="/ecell-logo.png"
            alt="E-Cell Woxsen Logo"
            width={70}
            height={70}
            className="object-contain animate-pulse"
            priority
          />
        </div>

        {/* Title */}
        <div className="flex items-center gap-2 text-emerald-400 text-xs font-mono font-semibold tracking-wider uppercase mb-1">
          <Sparkles className="w-3.5 h-3.5" />
          <span>ENTREPRENEURSHIP CELL</span>
        </div>
        <h2 className="text-xl font-bold font-heading text-white tracking-wide mb-1">
          WOXSEN UNIVERSITY
        </h2>
        <p className="text-xs text-slate-400 mb-6">
          Initializing Interactive Scrollytelling Experience...
        </p>

        {/* Progress Bar */}
        <div className="w-64 h-1.5 bg-white/10 rounded-full overflow-hidden mb-3 relative">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-sky-400 transition-all duration-200 rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex justify-between w-64 text-[11px] font-mono text-slate-400">
          <span>Loading Frames</span>
          <span className="text-emerald-300 font-semibold">{progress}%</span>
        </div>
      </div>
    </div>
  );
}
