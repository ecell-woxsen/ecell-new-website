"use client";

import React from "react";
import Image from "next/image";
import { getAssetUrl } from "../../lib/assets";

interface DoorAboutOverlayProps {
  currentFrame?: number;
  onOpenJoinModal?: () => void;
}

function DoorAboutOverlay({}: DoorAboutOverlayProps) {
  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center p-6 sm:p-10 lg:p-14 pointer-events-none select-none"
      style={{
        opacity: "var(--door-opacity, 0)",
        visibility: "var(--door-vis, hidden)" as React.CSSProperties["visibility"],
      }}
    >
      {/* ========================================================================= */}
      {/* CINEMATIC LOCALIZED CONTRAST GRADING                                      */}
      {/* Seamless radial illumination mask behind text: no cards, no visible edges */}
      {/* ========================================================================= */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(circle at 18% 50%, rgba(5, 8, 12, 0.62) 0%, rgba(5, 8, 12, 0.35) 45%, rgba(5, 8, 12, 0) 75%),
            radial-gradient(circle at 82% 50%, rgba(5, 8, 12, 0.62) 0%, rgba(5, 8, 12, 0.35) 45%, rgba(5, 8, 12, 0) 75%)
          `,
          opacity: "var(--door-opacity, 0)",
        }}
        aria-hidden="true"
      />

      {/* ========================================================================= */}
      {/* 3-COLUMN ARCHITECTURAL GRID: [LEFT STORY] | [CENTER LOGO] | [RIGHT STORY] */}
      {/* ========================================================================= */}
      <div
        className="relative z-10 w-full max-w-[1540px] mx-auto grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-start gap-8 lg:gap-14 xl:gap-20 will-change-transform"
        style={{
          transform: "translate3d(0, var(--door-ty, 0px), 0)",
        }}
      >
        {/* ========================================================================= */}
        {/* COLUMN 1: LEFT SIDE — WHO WE ARE                                          */}
        {/* ========================================================================= */}
        <div className="w-full max-w-[450px] lg:max-w-[480px] text-left flex flex-col justify-start">
          {/* Level 1: Section Label (Aligned horizontally with right side) */}
          <div className="flex items-center gap-3 h-6 mb-4 sm:mb-5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
            <span className="font-mono text-[11px] sm:text-xs font-semibold tracking-[0.22em] uppercase text-emerald-400 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
              WHO WE ARE
            </span>
            <span className="h-px w-8 bg-white/25" />
          </div>

          {/* Level 2: Monumental Editorial Headline */}
          <h2 className="font-display text-5xl sm:text-6xl lg:text-7xl xl:text-[80px] text-slate-50 tracking-[-0.01em] uppercase leading-[0.90] mb-6 sm:mb-7 drop-shadow-[0_4px_24px_rgba(0,0,0,0.98)]">
            A VISION.
            <br />
            <span className="text-emerald-400">A MOVEMENT.</span>
          </h2>

          {/* Level 3: Short Supporting Editorial Paragraph (High Readability) */}
          <p className="text-[14px] sm:text-[15px] lg:text-[16px] text-slate-100/90 font-normal leading-[1.75] min-h-[110px] sm:min-h-[115px] mb-8 drop-shadow-[0_2px_10px_rgba(0,0,0,0.95)] max-w-[440px]">
            Founded on 25th July 2025 at Woxsen University, E-Cell is a student-driven catalyst transforming ambition into action, innovation into opportunity, and ideas into ventures.
          </p>

          {/* Level 4: Secondary Metadata (Aligned with Right Pillars) */}
          <div className="pt-6 border-t border-white/20 max-w-[440px]">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <span className="block font-mono text-[10px] sm:text-[11px] font-medium tracking-[0.2em] text-slate-400 uppercase mb-1.5 drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]">
                  COMMUNITY
                </span>
                <span className="font-mono text-[13px] sm:text-[14px] text-white font-semibold tracking-wide drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)]">
                  6+ Schools Unified
                </span>
              </div>
              <div>
                <span className="block font-mono text-[10px] sm:text-[11px] font-medium tracking-[0.2em] text-slate-400 uppercase mb-1.5 drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]">
                  ECOSYSTEM
                </span>
                <span className="font-mono text-[13px] sm:text-[14px] text-white font-semibold tracking-wide drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)]">
                  Academia × Industry
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* COLUMN 2: CENTER IMAGE                                                    */}
        {/* ========================================================================= */}
        <div className="flex items-center justify-center w-full md:w-[280px] lg:w-[340px] xl:w-[400px] self-center shrink-0 order-first md:order-none mb-6 md:mb-0">
          <div className="relative w-44 h-44 sm:w-56 sm:h-56 md:w-64 md:h-64 lg:w-72 lg:h-72 xl:w-80 xl:h-80 flex items-center justify-center">
            <Image
              src={getAssetUrl("/ecell-logo.png")}
              alt="E-Cell Woxsen Logo"
              width={320}
              height={320}
              className="w-full h-full object-contain drop-shadow-[0_8px_32px_rgba(0,0,0,0.95)]"
            />
          </div>
        </div>

        {/* ========================================================================= */}
        {/* COLUMN 3: RIGHT SIDE — MISSION & PILLARS                                  */}
        {/* ========================================================================= */}
        <div className="w-full max-w-[450px] lg:max-w-[480px] text-left flex flex-col justify-start">
          {/* Level 1: Section Label (Aligned horizontally with left side) */}
          <div className="flex items-center gap-3 h-6 mb-4 sm:mb-5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
            <span className="font-mono text-[11px] sm:text-xs font-semibold tracking-[0.22em] uppercase text-emerald-400 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
              MISSION & PILLARS
            </span>
            <span className="h-px w-8 bg-white/25" />
          </div>

          {/* Level 2: Monumental Editorial Headline */}
          <h2 className="font-display text-5xl sm:text-6xl lg:text-7xl xl:text-[80px] text-slate-50 tracking-[-0.01em] uppercase leading-[0.90] mb-6 sm:mb-7 drop-shadow-[0_4px_24px_rgba(0,0,0,0.98)]">
            IGNITING
            <br />
            <span className="text-emerald-400">INNOVATION.</span>
          </h2>

          {/* Level 3: Short Supporting Mission Statement (High Readability) */}
          <p className="text-[14px] sm:text-[15px] lg:text-[16px] text-slate-100/90 font-normal leading-[1.75] min-h-[110px] sm:min-h-[115px] mb-8 drop-shadow-[0_2px_10px_rgba(0,0,0,0.95)] max-w-[440px]">
            A thriving entrepreneurial culture built through skills, mentorship, and platforms for students to create.
          </p>

          {/* Level 4: Four Pillars Editorial List (Aligned with Left Specs) */}
          <div className="pt-6 border-t border-white/20 max-w-[440px]">
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <div>
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="font-mono text-xs font-bold text-emerald-400">01</span>
                  <span className="font-mono text-[12px] sm:text-[13px] font-bold text-white uppercase tracking-wider drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]">
                    INSPIRE
                  </span>
                </div>
                <p className="text-xs text-slate-300/90 leading-normal drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
                  Ignite the founder spark.
                </p>
              </div>

              <div>
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="font-mono text-xs font-bold text-emerald-400">02</span>
                  <span className="font-mono text-[12px] sm:text-[13px] font-bold text-white uppercase tracking-wider drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]">
                    BUILD
                  </span>
                </div>
                <p className="text-xs text-slate-300/90 leading-normal drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
                  Provide venture tools.
                </p>
              </div>

              <div>
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="font-mono text-xs font-bold text-emerald-400">03</span>
                  <span className="font-mono text-[12px] sm:text-[13px] font-bold text-white uppercase tracking-wider drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]">
                    CONNECT
                  </span>
                </div>
                <p className="text-xs text-slate-300/90 leading-normal drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
                  Bridge with mentors.
                </p>
              </div>

              <div>
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="font-mono text-xs font-bold text-emerald-400">04</span>
                  <span className="font-mono text-[12px] sm:text-[13px] font-bold text-white uppercase tracking-wider drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]">
                    CATALYSE
                  </span>
                </div>
                <p className="text-xs text-slate-300/90 leading-normal drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
                  Turn ideas into impact.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default React.memo(DoorAboutOverlay);
