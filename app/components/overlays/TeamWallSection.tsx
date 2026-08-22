"use client";

import React from "react";

interface TeamMember {
  name: string;
  role: string;
  department?: string;
  image?: string;
}

interface TeamColumn {
  id: string;
  label: string;
  type: "large" | "stacked";
  members: TeamMember[];
}

const TEAM_STRUCTURE: TeamColumn[] = [
  {
    id: "president",
    label: "LEADERSHIP",
    type: "large",
    members: [
      {
        name: "Mohnish Singh Patwal",
        role: "President",
        department: "School of Business",
      },
    ],
  },
  {
    id: "vice-president",
    label: "LEADERSHIP",
    type: "large",
    members: [
      {
        name: "Vice President",
        role: "Vice President & Operations",
        department: "School of Technology",
      },
    ],
  },
  {
    id: "advisors",
    label: "ADVISORS",
    type: "stacked",
    members: [
      {
        name: "HC",
        role: "Advisor",
        department: "E-Cell Advisory Board",
      },
      {
        name: "Nihak",
        role: "Advisor",
        department: "E-Cell Advisory Board",
      },
    ],
  },
  {
    id: "secretaries",
    label: "SECRETARIES",
    type: "stacked",
    members: [
      {
        name: "Shrinidhi",
        role: "Secretary & Head of Documentation",
        department: "Documentation & Governance",
      },
      {
        name: "Abhichandra Medipally",
        role: "Secretary",
        department: "General Secretariat",
      },
    ],
  },
  {
    id: "technology",
    label: "TECHNOLOGY",
    type: "stacked",
    members: [
      {
        name: "Imad",
        role: "Head of Technology",
        department: "School of Technology",
      },
      {
        name: "Aali",
        role: "Lead of Technology",
        department: "School of Technology",
      },
    ],
  },
  {
    id: "marketing",
    label: "MARKETING & CREATIVES",
    type: "stacked",
    members: [
      {
        name: "Mahek Malpani",
        role: "Head of Marketing & Creatives",
        department: "School of Arts & Design",
      },
      {
        name: "Shloka",
        role: "Team Lead Marketing & Creatives",
        department: "School of Arts & Design",
      },
    ],
  },
  {
    id: "events",
    label: "EVENTS & OPERATIONS",
    type: "stacked",
    members: [
      {
        name: "Mihir Kalway",
        role: "Head of Events & Operations",
        department: "School of Business",
      },
      {
        name: "Pooja",
        role: "Lead of Events & Operations",
        department: "School of Business",
      },
    ],
  },
  {
    id: "finance",
    label: "FINANCE & SPONSORSHIP",
    type: "stacked",
    members: [
      {
        name: "Pranav",
        role: "Head of Finance & Sponsorship",
        department: "School of Business",
      },
      {
        name: "Minal",
        role: "Team Lead Finance & Operations",
        department: "School of Business",
      },
    ],
  },
  {
    id: "outreach",
    label: "OUTREACH & PARTNERSHIPS",
    type: "stacked",
    members: [
      {
        name: "Reetika",
        role: "Head of Outreach & Partnerships",
        department: "Corporate Partnerships",
      },
    ],
  },
];

/**
 * Photographic Exhibition Print Surface
 * Features warm studio softbox illumination, subtle photographic grain,
 * and zero UI badges or card-like styling.
 */
function StudioPhotoSurface({
  name,
  className,
}: {
  name: string;
  className: string;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl sm:rounded-2xl border border-white/15 shadow-[0_18px_40px_rgba(0,0,0,0.85)] bg-gradient-to-b from-[#1c222c] via-[#11161f] to-[#0a0d13] flex items-center justify-center select-none group-hover:border-emerald-400/40 transition-all duration-500 ${className}`}
    >
      {/* Studio Keylight Exposure Lift from top-left */}
      <div className="absolute -top-12 -left-12 w-48 h-48 bg-white/[0.06] rounded-full blur-2xl pointer-events-none" />
      
      {/* Subtle Rim Light from bottom */}
      <div className="absolute -bottom-8 -right-8 w-40 h-40 bg-emerald-500/[0.04] rounded-full blur-xl pointer-events-none" />

      {/* Elegant Photographic Grain & Editorial Placeholder Framing */}
      <div className="relative z-10 flex flex-col items-center justify-center p-4 text-center">
        <span className="font-display text-2xl sm:text-3xl text-white/30 tracking-wider uppercase group-hover:text-emerald-400/50 transition-colors">
          {name.charAt(0)}
        </span>
      </div>

      {/* Atmospheric photographic vignette */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/10 pointer-events-none" />
    </div>
  );
}

export default function TeamWallSection() {
  return (
    <div className="relative flex items-center gap-14 sm:gap-18 md:gap-24 lg:gap-32 shrink-0 select-none">
      {/* ========================================================================= */}
      {/* INVISIBLE APPLE STUDIO SOFTBOX ILLUMINATION                               */}
      {/* Diffused, seamless exposure lift across the exhibition wall               */}
      {/* ========================================================================= */}
      <div
        className="absolute -top-36 left-0 right-0 h-[850px] pointer-events-none blur-3xl rounded-full"
        style={{
          background: `radial-gradient(ellipse at 50% 25%, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.015) 50%, transparent 80%)`,
        }}
        aria-hidden="true"
      />

      {/* ========================================================================= */}
      {/* CHAPTER OPENING: MUSEUM EXHIBITION TITLE WALL                              */}
      {/* Printed directly on the architectural wall; zero boxes or cards           */}
      {/* ========================================================================= */}
      <div className="relative shrink-0 flex flex-col justify-between w-[280px] sm:w-[320px] md:w-[360px] h-[460px] sm:h-[500px] pr-6 sm:pr-8">
        <div>
          {/* Level 1: Small Green Editorial Label */}
          <div className="flex items-center gap-2.5 h-5 mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]" />
            <span className="font-mono text-[10px] sm:text-[11px] font-semibold tracking-[0.25em] uppercase text-emerald-400 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
              GOVERNANCE
            </span>
            <span className="h-px w-8 bg-white/20" />
          </div>

          {/* Level 2: Monumental 2-Line Editorial Title */}
          <h2 className="font-display text-5xl sm:text-6xl md:text-7xl text-slate-50 tracking-[-0.01em] uppercase leading-[0.88] mb-5 drop-shadow-[0_4px_24px_rgba(0,0,0,0.98)]">
            CORE<br />TEAM
          </h2>

          {/* Level 3: Supporting Exhibition Narrative */}
          <p className="text-[14px] sm:text-[15px] text-slate-200/85 font-normal leading-[1.65] max-w-[300px] drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
            The strategic and operational leadership steering the venture ecosystem at Woxsen University.
          </p>
        </div>

        {/* Metadata Footer */}
        <div className="pt-4 border-t border-white/10">
          <span className="font-mono text-[10px] sm:text-[11px] tracking-[0.22em] uppercase text-slate-400 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
            2025 — 2026 COHORT
          </span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* CONTINUOUS HORIZONTAL EXHIBITION TRACK: BIG | BIG | SMALL/SMALL | ...      */}
      {/* ========================================================================= */}
      {TEAM_STRUCTURE.map((col) => {
        // -----------------------------------------------------------------------
        // LARGE PORTRAIT (President / Vice President)
        // -----------------------------------------------------------------------
        if (col.type === "large") {
          const leader = col.members[0];
          return (
            <div
              key={col.id}
              className="relative shrink-0 flex flex-col justify-between w-[250px] sm:w-[290px] lg:w-[320px] h-[460px] sm:h-[500px] group"
            >
              <div>
                {/* Column Label */}
                <div className="flex items-center gap-2 h-4 mb-2.5">
                  <span className="w-1 h-1 rounded-full bg-emerald-400/80" />
                  <span className="font-mono text-[9px] sm:text-[10px] font-semibold tracking-[0.2em] uppercase text-emerald-400 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
                    {col.label}
                  </span>
                </div>

                {/* Large Editorial Exhibition Print */}
                <StudioPhotoSurface
                  name={leader.name}
                  className="w-full h-[360px] sm:h-[395px] lg:h-[415px]"
                />
              </div>

              {/* Exhibition Caption Directly Below */}
              <div className="pt-2.5 text-left">
                <h3 className="font-display text-lg sm:text-xl text-slate-50 uppercase tracking-tight leading-tight group-hover:text-emerald-300 transition-colors drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)]">
                  {leader.name}
                </h3>
                <p className="font-mono text-[10px] sm:text-[11px] text-slate-400 font-medium tracking-wide mt-0.5 drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]">
                  {leader.role}
                </p>
              </div>
            </div>
          );
        }

        // -----------------------------------------------------------------------
        // STACKED 1x1 PORTRAIT COLUMNS (Two equal square prints per column)
        // -----------------------------------------------------------------------
        return (
          <div
            key={col.id}
            className="relative shrink-0 flex flex-col justify-between w-[165px] sm:w-[185px] lg:w-[205px] h-[460px] sm:h-[500px]"
          >
            {/* Column Label */}
            <div className="flex items-center gap-2 h-4 mb-2.5">
              <span className="w-1 h-1 rounded-full bg-emerald-400/80" />
              <span className="font-mono text-[9px] sm:text-[10px] font-semibold tracking-[0.2em] uppercase text-emerald-400 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] truncate">
                {col.label}
              </span>
            </div>

            {/* Stacked 1x1 Prints Container sharing identical vertical grid */}
            <div className="flex flex-col justify-between h-[425px] sm:h-[465px]">
              {col.members.map((member) => (
                <div key={member.name} className="group text-left flex flex-col justify-between">
                  {/* 1x1 Square Exhibition Print */}
                  <StudioPhotoSurface
                    name={member.name}
                    className="w-full aspect-square"
                  />

                  {/* Exhibition Caption Directly Below */}
                  <div className="pt-1.5">
                    <h4 className="font-display text-[14px] sm:text-[15px] text-slate-100 uppercase tracking-tight leading-snug group-hover:text-emerald-300 transition-colors drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)] truncate">
                      {member.name}
                    </h4>
                    <p className="font-mono text-[9px] sm:text-[10px] text-slate-400 tracking-tight mt-0.5 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] truncate">
                      {member.role}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
