"use client";

import React from "react";
import { Users, Sparkles, Building2 } from "lucide-react";

export default function TeamWallCards() {
  const teamMembers = [
    {
      name: "Core Committee Lead",
      role: "President & Head of Innovation",
      department: "School of Business",
      accent: "from-[#ee495c]/30 to-[#cc2b3e]/20",
      avatarColor: "bg-[#ee495c]/15 border-[#ee495c]/35 text-white",
      initials: "CL",
    },
    {
      name: "Vice President",
      role: "Operations & Strategy Lead",
      department: "School of Technology",
      accent: "from-[#ee495c]/30 to-[#cc2b3e]/20",
      avatarColor: "bg-[#ee495c]/15 border-[#ee495c]/35 text-white",
      initials: "VP",
    },
    {
      name: "Technical Lead",
      role: "Head of Tech & AI Development",
      department: "School of Technology",
      accent: "from-[#ee495c]/30 to-[#cc2b3e]/20",
      avatarColor: "bg-[#ee495c]/15 border-[#ee495c]/35 text-white",
      initials: "TL",
    },
    {
      name: "Design & Brand Lead",
      role: "Head of Creatives & Media",
      department: "School of Arts & Design",
      accent: "from-[#ee495c]/30 to-[#cc2b3e]/20",
      avatarColor: "bg-[#ee495c]/15 border-[#ee495c]/35 text-white",
      initials: "DL",
    },
    {
      name: "Corporate Relations Lead",
      role: "Industry & Sponsorships",
      department: "School of Business",
      accent: "from-[#ee495c]/30 to-[#cc2b3e]/20",
      avatarColor: "bg-[#ee495c]/15 border-[#ee495c]/35 text-white",
      initials: "CR",
    },
    {
      name: "Legal & Policy Lead",
      role: "Incubation & Compliance",
      department: "School of Law",
      accent: "from-[#ee495c]/30 to-[#cc2b3e]/20",
      avatarColor: "bg-[#ee495c]/15 border-[#ee495c]/35 text-white",
      initials: "LL",
    },
  ];

  return (
    <div className="w-[88vw] sm:w-[700px] md:w-[840px] lg:w-[940px] shrink-0 glass-wall-card rounded-3xl p-6 sm:p-8 text-slate-100 shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 mb-6 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2 text-[#ee495c] text-xs font-mono font-semibold tracking-wider mb-1">
            <Users className="w-3.5 h-3.5" />
            <span>LEADERSHIP & COMMITTEE</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold font-heading text-white">
            Meet The Core Team
          </h2>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] font-mono text-slate-300">
          <Sparkles className="w-3 h-3 text-[#ee495c]" />
          <span>50+ STUDENT CONTRIBUTORS</span>
        </div>
      </div>

      {/* Team Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 sm:gap-4">
        {teamMembers.map((member) => (
          <div
            key={member.role}
            className="group relative p-4 rounded-2xl bg-slate-950/60 border border-white/10 hover:border-[#ee495c]/50 hover:bg-[#ee495c]/5 transition-all duration-300 flex flex-col items-center text-center overflow-hidden hover:scale-[1.02]"
          >
            {/* Ambient Card Glow on hover */}
            <div className="absolute -top-10 -right-10 w-24 h-24 bg-[#ee495c]/10 rounded-full blur-xl group-hover:bg-[#ee495c]/20 transition-all" />

            {/* Avatar Container with stylish SVG filler */}
            <div className="relative mb-3">
              <div
                className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl border-2 flex items-center justify-center font-heading font-bold text-lg sm:text-xl shadow-xl ${member.avatarColor} backdrop-blur-md relative overflow-hidden`}
              >
                {/* SVG Geometric Mesh Background Pattern */}
                <svg
                  className="absolute inset-0 w-full h-full opacity-30 pointer-events-none"
                  viewBox="0 0 100 100"
                  fill="none"
                >
                  <circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" />
                  <path d="M10 50 Q 50 10 90 50 Q 50 90 10 50" stroke="currentColor" strokeWidth="1" />
                </svg>
                {/* SVG User Silhouette / Initials */}
                <span className="relative z-10 font-mono tracking-wider">{member.initials}</span>
              </div>
            </div>

            {/* Member Details */}
            <h3 className="font-heading font-bold text-sm sm:text-base text-white group-hover:text-[#ff7686] transition-colors">
              {member.name}
            </h3>
            <p className="text-[11px] sm:text-xs font-semibold text-[#ee495c] mt-0.5 mb-2 line-clamp-1">
              {member.role}
            </p>

            {/* Department Badge */}
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 border border-white/5 text-[10px] text-slate-300 mt-auto">
              <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
              <span className="truncate">{member.department}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
