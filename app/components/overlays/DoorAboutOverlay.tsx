"use client";

import React from "react";

interface DoorAboutOverlayProps {
  currentFrame: number;
  onOpenJoinModal?: () => void;
}

function DoorAboutOverlay({
  currentFrame,
}: DoorAboutOverlayProps) {
  // Master active frame window: 355 to 415
  if (currentFrame < 355 || currentFrame > 415) return null;

  // Master opacity envelope
  let masterOpacity = 0;
  let translateY = 0;

  if (currentFrame >= 355 && currentFrame < 368) {
    const t = (currentFrame - 355) / 13;
    masterOpacity = t;
    translateY = (1 - t) * 12;
  } else if (currentFrame >= 368 && currentFrame <= 398) {
    masterOpacity = 1;
    translateY = 0;
  } else if (currentFrame > 398 && currentFrame <= 415) {
    const t = (currentFrame - 398) / 17;
    masterOpacity = 1 - t;
    translateY = t * -12;
  }

  // Progressive staggered opacity for inner elements
  // 1. Labels & Headlines: frame 356 -> 366
  const headProgress = Math.min(1, Math.max(0, (currentFrame - 356) / 10));
  // 2. Body Descriptions: frame 364 -> 374
  const bodyProgress = Math.min(1, Math.max(0, (currentFrame - 364) / 10));
  // 3. Bottom Specs & Pillars: frame 370 -> 382
  const bottomProgress = Math.min(1, Math.max(0, (currentFrame - 370) / 12));

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center p-6 sm:p-10 lg:p-14 pointer-events-none transition-opacity duration-300 select-none"
      style={{ opacity: masterOpacity }}
    >
      {/* 3-COLUMN ARCHITECTURAL GRID: [LEFT STORY] | [CENTER DOOR VOID] | [RIGHT STORY] */}
      <div
        className="w-full max-w-[1480px] mx-auto grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-start gap-8 lg:gap-12 will-change-transform"
        style={{
          transform: `translate3d(0, ${translateY}px, 0)`,
        }}
      >
        {/* ========================================================================= */}
        {/* COLUMN 1: LEFT SIDE — WHO WE ARE                                          */}
        {/* ========================================================================= */}
        <div className="w-full max-w-[420px] lg:max-w-[460px] text-left flex flex-col justify-start">
          {/* Row 1: Section Label (Sits on identical horizontal line as right side) */}
          <div
            className="flex items-center gap-2.5 h-6 mb-3 sm:mb-4 will-change-transform"
            style={{ opacity: headProgress }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="font-mono text-[10px] sm:text-[11px] font-semibold tracking-[0.25em] uppercase text-emerald-400 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
              WHO WE ARE
            </span>
            <span className="h-px w-6 bg-white/20" />
          </div>

          {/* Row 2: Monumental Main Headline (Identical vertical scale as right side) */}
          <h2
            className="font-display text-4xl sm:text-5xl lg:text-6xl text-slate-100 tracking-tight uppercase leading-[0.92] mb-5 sm:mb-6 drop-shadow-[0_4px_20px_rgba(0,0,0,0.98)] will-change-transform"
            style={{ opacity: headProgress }}
          >
            A VISION.
            <br />
            <span className="text-slate-300">A MOVEMENT.</span>
          </h2>

          {/* Row 3: Short Description Paragraph (Fixed vertical rhythm) */}
          <p
            className="text-xs sm:text-[13px] text-slate-200/85 font-light leading-[1.8] min-h-[72px] mb-6 drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)] max-w-[400px] will-change-transform"
            style={{ opacity: bodyProgress }}
          >
            Founded on 25th July 2025 at Woxsen University, E-Cell is a student-driven catalyst transforming ambition into action, innovation into opportunity, and ideas into ventures.
          </p>

          {/* Row 4: Secondary Information Row (Aligned with Right Pillars) */}
          <div
            className="pt-5 border-t border-white/15 max-w-[400px] will-change-transform"
            style={{ opacity: bottomProgress }}
          >
            <div className="grid grid-cols-2 gap-6">
              <div>
                <span className="block font-mono text-[9px] sm:text-[10px] tracking-[0.25em] text-slate-400 uppercase mb-1 drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]">
                  COMMUNITY
                </span>
                <span className="font-mono text-xs sm:text-[13px] text-white font-medium tracking-wide drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)]">
                  6+ Schools Unified
                </span>
              </div>
              <div>
                <span className="block font-mono text-[9px] sm:text-[10px] tracking-[0.25em] text-slate-400 uppercase mb-1 drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]">
                  ECOSYSTEM
                </span>
                <span className="font-mono text-xs sm:text-[13px] text-white font-medium tracking-wide drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)]">
                  Academia × Industry
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* COLUMN 2: CENTER CORRIDOR (Unobstructed Negative Space for Physical Door) */}
        {/* ========================================================================= */}
        <div
          className="hidden md:block w-[300px] lg:w-[360px] xl:w-[400px] shrink-0 pointer-events-none"
          aria-hidden="true"
        />

        {/* ========================================================================= */}
        {/* COLUMN 3: RIGHT SIDE — MISSION & PILLARS                                  */}
        {/* ========================================================================= */}
        <div className="w-full max-w-[420px] lg:max-w-[460px] text-left flex flex-col justify-start">
          {/* Row 1: Section Label (Sits on identical horizontal line as left side) */}
          <div
            className="flex items-center gap-2.5 h-6 mb-3 sm:mb-4 will-change-transform"
            style={{ opacity: headProgress }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="font-mono text-[10px] sm:text-[11px] font-semibold tracking-[0.25em] uppercase text-emerald-400 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
              MISSION & PILLARS
            </span>
            <span className="h-px w-6 bg-white/20" />
          </div>

          {/* Row 2: Monumental Main Headline (Identical vertical scale as left side) */}
          <h2
            className="font-display text-4xl sm:text-5xl lg:text-6xl text-slate-100 tracking-tight uppercase leading-[0.92] mb-5 sm:mb-6 drop-shadow-[0_4px_20px_rgba(0,0,0,0.98)] will-change-transform"
            style={{ opacity: headProgress }}
          >
            IGNITING
            <br />
            <span className="text-slate-300">INNOVATION.</span>
          </h2>

          {/* Row 3: Short Mission Statement (Fixed vertical rhythm) */}
          <p
            className="text-xs sm:text-[13px] text-slate-200/85 font-light leading-[1.8] min-h-[72px] mb-6 drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)] max-w-[400px] will-change-transform"
            style={{ opacity: bodyProgress }}
          >
            A thriving entrepreneurial culture built through skills, mentorship, and platforms for students to create.
          </p>

          {/* Row 4: Four Pillars Editorial List (Aligned with Left Info Row) */}
          <div
            className="pt-5 border-t border-white/15 max-w-[400px] will-change-transform"
            style={{ opacity: bottomProgress }}
          >
            <div className="grid grid-cols-2 gap-x-6 gap-y-3.5">
              <div>
                <div className="flex items-baseline gap-2 mb-0.5">
                  <span className="font-mono text-[10px] font-bold text-emerald-400">01</span>
                  <span className="font-mono text-[11px] font-bold text-white uppercase tracking-wider drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]">
                    INSPIRE
                  </span>
                </div>
                <p className="text-[11px] text-slate-400/90 leading-tight drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
                  Ignite the founder spark.
                </p>
              </div>

              <div>
                <div className="flex items-baseline gap-2 mb-0.5">
                  <span className="font-mono text-[10px] font-bold text-emerald-400">02</span>
                  <span className="font-mono text-[11px] font-bold text-white uppercase tracking-wider drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]">
                    BUILD
                  </span>
                </div>
                <p className="text-[11px] text-slate-400/90 leading-tight drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
                  Provide venture tools.
                </p>
              </div>

              <div>
                <div className="flex items-baseline gap-2 mb-0.5">
                  <span className="font-mono text-[10px] font-bold text-emerald-400">03</span>
                  <span className="font-mono text-[11px] font-bold text-white uppercase tracking-wider drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]">
                    CONNECT
                  </span>
                </div>
                <p className="text-[11px] text-slate-400/90 leading-tight drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
                  Bridge with mentors.
                </p>
              </div>

              <div>
                <div className="flex items-baseline gap-2 mb-0.5">
                  <span className="font-mono text-[10px] font-bold text-emerald-400">04</span>
                  <span className="font-mono text-[11px] font-bold text-white uppercase tracking-wider drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]">
                    CATALYSE
                  </span>
                </div>
                <p className="text-[11px] text-slate-400/90 leading-tight drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
                  Turn ideas to impact.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default React.memo(DoorAboutOverlay, (prevProps, nextProps) => {
  const prevOut = prevProps.currentFrame < 355 || prevProps.currentFrame > 415;
  const nextOut = nextProps.currentFrame < 355 || nextProps.currentFrame > 415;
  if (prevOut && nextOut) return true;
  return prevProps.currentFrame === nextProps.currentFrame;
});
