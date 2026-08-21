"use client";

import React from "react";
import { Sparkles, Target, Compass, Users2, Rocket, ArrowRight } from "lucide-react";

interface DoorAboutOverlayProps {
  currentFrame: number;
  onOpenJoinModal: () => void;
}

export default function DoorAboutOverlay({
  currentFrame,
  onOpenJoinModal,
}: DoorAboutOverlayProps) {
  // Active window: frames 360 to 402, fully visible from 368 to 395
  let opacity = 0;
  if (currentFrame >= 360 && currentFrame < 368) {
    opacity = (currentFrame - 360) / 8;
  } else if (currentFrame >= 368 && currentFrame <= 395) {
    opacity = 1;
  } else if (currentFrame > 395 && currentFrame <= 402) {
    opacity = 1 - (currentFrame - 395) / 7;
  }

  if (opacity <= 0.01) return null;

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-between p-4 sm:p-8 md:p-12 pointer-events-none transition-all duration-300"
      style={{ opacity }}
    >
      <div className="w-full max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 md:gap-16">
        {/* Left Card: Who We Are & Our Story */}
        <div
          className="w-full md:w-[420px] lg:w-[450px] glass-panel-door rounded-3xl p-6 sm:p-7 pointer-events-auto text-slate-100 shadow-2xl transition-transform duration-500"
          style={{
            transform: `perspective(1000px) rotateY(${Math.min(6, (currentFrame - 365) * 1.2)}deg)`,
          }}
        >
          <div className="flex items-center gap-2 text-emerald-400 text-xs font-mono font-semibold mb-2 tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            <span>WHO WE ARE</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-bold font-heading text-white leading-tight mb-3">
            A Vision. A Movement.
          </h2>

          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-4">
            Founded on <span className="text-emerald-300 font-semibold">25th July 2025</span> at Woxsen University, the Entrepreneurship Cell (E-Cell) is a dynamic student-driven catalyst transforming campus ambition into action, innovation into opportunity, and ideas into ventures.
          </p>

          <div className="space-y-2.5 pt-1 border-t border-white/10 text-xs">
            <div className="flex items-start gap-2.5">
              <Users2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-white">Our Community:</span>{" "}
                <span className="text-slate-300">
                  A vibrant network of student founders and innovators united across 6+ academic schools.
                </span>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <Rocket className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-white">Our Ecosystem:</span>{" "}
                <span className="text-slate-300">
                  Bridging academia and industry to nurture ideas from initial spark to execution.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Center Space: Retains visibility of the physical E-Cell door in the video */}
        <div className="hidden md:flex flex-col items-center justify-center pointer-events-none px-4">
          <div className="px-3 py-1 rounded-full bg-black/60 border border-emerald-500/30 backdrop-blur-md text-[10px] font-mono text-emerald-300 uppercase tracking-widest animate-pulse">
            E-Cell Headquarters
          </div>
        </div>

        {/* Right Card: Mission, Vision & Core Pillars */}
        <div
          className="w-full md:w-[420px] lg:w-[450px] glass-panel-door rounded-3xl p-6 sm:p-7 pointer-events-auto text-slate-100 shadow-2xl transition-transform duration-500"
          style={{
            transform: `perspective(1000px) rotateY(-${Math.min(6, (currentFrame - 365) * 1.2)}deg)`,
          }}
        >
          <div className="flex items-center gap-2 text-teal-400 text-xs font-mono font-semibold mb-2 tracking-wider">
            <Target className="w-3.5 h-3.5" />
            <span>MISSION & PILLARS</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-bold font-heading text-white leading-tight mb-3">
            Igniting Innovation.
          </h2>

          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-4">
            To cultivate a thriving entrepreneurial culture by equipping students with high-impact skills, mentorship, and platforms to build sustainable solutions.
          </p>

          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/10 text-xs mb-4">
            <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/5">
              <span className="block font-bold text-emerald-300 text-[11px] font-mono uppercase">
                01 · INSPIRE
              </span>
              <p className="text-[11px] text-slate-300 mt-0.5">
                Ignite the founder spark in every student.
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/5">
              <span className="block font-bold text-teal-300 text-[11px] font-mono uppercase">
                02 · BUILD
              </span>
              <p className="text-[11px] text-slate-300 mt-0.5">
                Provide tools for rapid venture creation.
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/5">
              <span className="block font-bold text-sky-300 text-[11px] font-mono uppercase">
                03 · CONNECT
              </span>
              <p className="text-[11px] text-slate-300 mt-0.5">
                Bridge with seasoned mentors & leaders.
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/5">
              <span className="block font-bold text-indigo-300 text-[11px] font-mono uppercase">
                04 · CATALYSE
              </span>
              <p className="text-[11px] text-slate-300 mt-0.5">
                Drive initiatives from campus to real impact.
              </p>
            </div>
          </div>

          <button
            onClick={onOpenJoinModal}
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer hover:scale-[1.01]"
          >
            <span>Get Involved with E-Cell</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
