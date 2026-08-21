"use client";

import React from "react";
import { Calendar, Trophy, Zap, Flame, Award, ArrowUpRight } from "lucide-react";

interface EventsWallCardProps {
  onOpenJoinModal: () => void;
}

export default function EventsWallCard({ onOpenJoinModal }: EventsWallCardProps) {
  const events = [
    {
      title: "Hult Prize On-Campus Round",
      tag: "FLAGSHIP SOCIAL IMPACT",
      desc: "Hosted the prestigious on-campus round for student changemakers pitching sustainable, globally-focused social startup ideas.",
      icon: Trophy,
      color: "from-amber-500/20 to-orange-500/20 text-amber-300 border-amber-500/30",
    },
    {
      title: "Entrepreneurship Workshops & Bootcamps",
      tag: "SKILL ACCELERATION",
      desc: "Hands-on sessions covering ideation frameworks, market validation, business model canvas, and startup fundamentals.",
      icon: Zap,
      color: "from-emerald-500/20 to-teal-500/20 text-emerald-300 border-emerald-500/30",
    },
    {
      title: "Campus Hackathons & Innovation Challenges",
      tag: "RAPID PROTOTYPING",
      desc: "High-intensity hackathons bringing together developers, designers, and business students to solve real-world problems in 36 hours.",
      icon: Flame,
      color: "from-rose-500/20 to-pink-500/20 text-rose-300 border-rose-500/30",
    },
    {
      title: "Upcoming: E-Summit Woxsen 2026",
      tag: "ANNUAL FLAGSHIP",
      desc: "The premier university entrepreneurship summit featuring keynote founder talks, pitch competitions, and angel investor connects.",
      icon: Award,
      color: "from-sky-500/20 to-indigo-500/20 text-sky-300 border-sky-500/30",
    },
  ];

  return (
    <div className="w-[88vw] sm:w-[560px] md:w-[620px] lg:w-[680px] shrink-0 glass-wall-card rounded-3xl p-6 sm:p-8 text-slate-100 shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 mb-5 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2 text-emerald-400 text-xs font-mono font-semibold tracking-wider mb-1">
            <Calendar className="w-3.5 h-3.5" />
            <span>INITIATIVES & EXPERIENCES</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold font-heading text-white">
            Flagship Events
          </h2>
        </div>
        <span className="text-[11px] font-mono px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
          CAMPUS IMPACT
        </span>
      </div>

      {/* Events Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-6">
        {events.map((evt) => {
          const Icon = evt.icon;
          return (
            <div
              key={evt.title}
              className="p-4 rounded-2xl bg-slate-950/60 border border-white/10 hover:border-white/20 transition-all flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div
                    className={`w-8 h-8 rounded-xl bg-gradient-to-br ${evt.color} border flex items-center justify-center`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-[9px] font-mono font-semibold px-2 py-0.5 rounded bg-white/5 text-slate-400">
                    {evt.tag}
                  </span>
                </div>
                <h3 className="font-heading font-bold text-sm text-white group-hover:text-emerald-300 transition-colors mb-1.5">
                  {evt.title}
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {evt.desc}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom CTA */}
      <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-emerald-300">
            Have an event or competition idea?
          </p>
          <p className="text-[11px] text-slate-400">
            Collaborate with E-Cell to host it on campus.
          </p>
        </div>
        <button
          onClick={onOpenJoinModal}
          className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shrink-0 transition-all cursor-pointer"
        >
          <span>Pitch Event</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
