"use client";

import React from "react";
import Image from "next/image";

interface TeamMember {
  name: string;
  role: string;
  department?: string;
  image?: string;
  initials: string;
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
        name: "President",
        role: "President & Head of Initiative",
        department: "School of Business",
        initials: "PR",
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
        initials: "VP",
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
        initials: "HC",
      },
      {
        name: "Nihak",
        role: "Advisor",
        department: "E-Cell Advisory Board",
        initials: "NK",
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
        initials: "SN",
      },
      {
        name: "Abhichandra Medipally",
        role: "Secretary",
        department: "General Secretariat",
        initials: "AM",
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
        initials: "IM",
      },
      {
        name: "Aali",
        role: "Lead of Technology",
        department: "School of Technology",
        initials: "AL",
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
        initials: "MM",
      },
      {
        name: "Shloka",
        role: "Team Lead Marketing & Creatives",
        department: "School of Arts & Design",
        initials: "SK",
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
        initials: "MK",
      },
      {
        name: "Pooja",
        role: "Lead of Events & Operations",
        department: "School of Business",
        initials: "PJ",
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
        initials: "PN",
      },
      {
        name: "Minal",
        role: "Team Lead Finance & Operations",
        department: "School of Business",
        initials: "ML",
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
        initials: "RT",
      },
    ],
  },
];

function StudioPortraitPlaceholder({
  initials,
  aspectClass,
}: {
  initials: string;
  aspectClass: string;
}) {
  return (
    <div
      className={`relative w-full ${aspectClass} rounded-xl sm:rounded-2xl overflow-hidden border border-white/15 shadow-[0_16px_40px_rgba(0,0,0,0.85)] bg-gradient-to-b from-[#161a22] via-[#0d1117] to-[#080b10] flex flex-col items-center justify-center group-hover:border-emerald-400/40 transition-all duration-500`}
    >
      {/* Subtle Studio Keylight & Fill Glow */}
      <div className="absolute top-0 right-0 w-36 h-36 bg-white/[0.04] rounded-full blur-2xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-28 h-28 bg-emerald-500/[0.04] rounded-full blur-xl pointer-events-none" />

      {/* Architectural Studio Silhouette Graphic */}
      <div className="relative z-10 flex flex-col items-center justify-center opacity-85 group-hover:opacity-100 transition-opacity">
        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full border border-white/20 bg-white/[0.05] backdrop-blur-md flex items-center justify-center mb-2 shadow-inner">
          <span className="font-mono text-sm sm:text-base font-semibold tracking-wider text-slate-200">
            {initials}
          </span>
        </div>
      </div>

      {/* Subtle bottom vignette */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/10 pointer-events-none" />
    </div>
  );
}

export default function TeamWallSection() {
  return (
    <div className="relative flex items-end gap-10 sm:gap-14 md:gap-18 lg:gap-22 shrink-0 select-none">
      {/* ========================================================================= */}
      {/* APPLE STUDIO SOFTBOX AMBIENT LIGHTING                                     */}
      {/* Diffused, invisible as a shape, soft exposure lift across the wall        */}
      {/* ========================================================================= */}
      <div
        className="absolute -top-32 left-0 right-0 h-[800px] pointer-events-none blur-3xl rounded-full"
        style={{
          background: `radial-gradient(ellipse at 50% 25%, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.015) 50%, transparent 80%)`,
        }}
        aria-hidden="true"
      />

      {/* ========================================================================= */}
      {/* SECTION HEADER MARKER (Architectural Wayfinding)                           */}
      {/* ========================================================================= */}
      <div className="shrink-0 flex flex-col justify-between h-[420px] lg:h-[460px] pr-4 sm:pr-8 border-r border-white/10">
        <div>
          <div className="flex items-center gap-2.5 h-5 mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]" />
            <span className="font-mono text-[10px] sm:text-[11px] font-semibold tracking-[0.25em] uppercase text-emerald-400 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
              GOVERNANCE
            </span>
          </div>
          <h2 className="font-display text-4xl sm:text-5xl lg:text-6xl text-slate-50 tracking-[-0.01em] uppercase leading-[0.92] drop-shadow-[0_4px_20px_rgba(0,0,0,0.98)] max-w-[200px]">
            CORE TEAM
          </h2>
        </div>
        <p className="font-mono text-[10px] tracking-[0.2em] text-slate-400 uppercase drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
          2025 – 2026 COHORT
        </p>
      </div>

      {/* ========================================================================= */}
      {/* CONTINUOUS HORIZONTAL TEAM COLUMNS: BIG | BIG | SMALL/SMALL | ...         */}
      {/* ========================================================================= */}
      {TEAM_STRUCTURE.map((col) => {
        if (col.type === "large") {
          const leader = col.members[0];
          return (
            <div
              key={col.id}
              className="relative shrink-0 flex flex-col justify-end w-[240px] sm:w-[280px] lg:w-[320px] group"
            >
              {/* Column Label */}
              <div className="flex items-center gap-2 h-4 mb-2.5">
                <span className="w-1 h-1 rounded-full bg-emerald-400/80" />
                <span className="font-mono text-[9px] sm:text-[10px] font-semibold tracking-[0.2em] uppercase text-emerald-400 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
                  {col.label}
                </span>
              </div>

              {/* Large Portrait (President / VP) */}
              <StudioPortraitPlaceholder
                initials={leader.initials}
                aspectClass="aspect-[3/3.8] h-[340px] sm:h-[380px] lg:h-[420px]"
              />

              {/* Exhibition Caption */}
              <div className="mt-3 text-left">
                <h3 className="font-display text-xl sm:text-2xl text-slate-50 uppercase tracking-tight leading-tight group-hover:text-emerald-300 transition-colors drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)]">
                  {leader.name}
                </h3>
                <p className="font-mono text-[11px] sm:text-xs text-emerald-400/90 font-medium tracking-wide mt-0.5 drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]">
                  {leader.role}
                </p>
              </div>
            </div>
          );
        }

        // Standard Stacked Columns (Two 1x1 Portraits)
        return (
          <div
            key={col.id}
            className="relative shrink-0 flex flex-col justify-end w-[170px] sm:w-[190px] lg:w-[210px]"
          >
            {/* Column Label */}
            <div className="flex items-center gap-2 h-4 mb-2.5">
              <span className="w-1 h-1 rounded-full bg-emerald-400/80" />
              <span className="font-mono text-[9px] sm:text-[10px] font-semibold tracking-[0.2em] uppercase text-emerald-400 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] truncate">
                {col.label}
              </span>
            </div>

            {/* Stacked 1x1 Portraits Container */}
            <div className="flex flex-col gap-5 sm:gap-6 justify-between">
              {col.members.map((member) => (
                <div key={member.name} className="group text-left">
                  {/* 1x1 Square Portrait */}
                  <StudioPortraitPlaceholder
                    initials={member.initials}
                    aspectClass="aspect-square w-full"
                  />

                  {/* Exhibition Caption */}
                  <div className="mt-2">
                    <h4 className="font-display text-base sm:text-lg text-slate-100 uppercase tracking-tight leading-snug group-hover:text-emerald-300 transition-colors drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)] truncate">
                      {member.name}
                    </h4>
                    <p className="font-mono text-[10px] sm:text-[11px] text-slate-300/85 tracking-tight mt-0.5 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] truncate">
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
