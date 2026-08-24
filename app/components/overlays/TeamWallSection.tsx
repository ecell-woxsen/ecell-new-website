"use client";

import React from "react";

interface TeamMember {
  name: string;
  role: string;
  department?: string;
  image?: string;
}

interface TeamGroup {
  id: string;
  label: string;
  category: "hero" | "contact-sheet";
  targetFrame: number;
  members: TeamMember[];
}

const TEAM_DATA: TeamGroup[] = [
  {
    id: "leadership",
    label: "EXECUTIVE LEADERSHIP",
    category: "hero",
    targetFrame: 880,
    members: [
      {
        name: "Mohnish Singh Patwal",
        role: "President",
        department: "Executive Committee",
      },
      {
        name: "Shreyas Kandi",
        role: "Vice President",
        department: "Executive Committee",
      },
    ],
  },
  {
    id: "advisors",
    label: "ADVISORS",
    category: "contact-sheet",
    targetFrame: 940,
    members: [
      {
        name: "HC",
        role: "Advisor",
        department: "Advisory Board",
      },
      {
        name: "Nihak",
        role: "Advisor",
        department: "Advisory Board",
      },
    ],
  },
  {
    id: "secretaries",
    label: "SECRETARIES",
    category: "contact-sheet",
    targetFrame: 980,
    members: [
      {
        name: "Shrinidhi",
        role: "Secretary & Head of Documentation",
        department: "Governance & Secretariat",
      },
      {
        name: "Abhichandra Medipally",
        role: "Secretary",
        department: "Governance & Secretariat",
      },
    ],
  },
  {
    id: "technology",
    label: "TECHNOLOGY",
    category: "contact-sheet",
    targetFrame: 1020,
    members: [
      {
        name: "Imad",
        role: "Head of Technology",
        department: "Engineering & Digital",
      },
      {
        name: "Aali",
        role: "Lead of Technology",
        department: "Engineering & Digital",
      },
    ],
  },
  {
    id: "marketing",
    label: "MARKETING & CREATIVES",
    category: "contact-sheet",
    targetFrame: 1060,
    members: [
      {
        name: "Mahek Malpani",
        role: "Head of Marketing & Creatives",
        department: "Brand & Communications",
      },
      {
        name: "Shloka",
        role: "Team Lead Marketing & Creatives",
        department: "Brand & Communications",
      },
    ],
  },
  {
    id: "events",
    label: "EVENTS & OPERATIONS",
    category: "contact-sheet",
    targetFrame: 1100,
    members: [
      {
        name: "Mihir Kalway",
        role: "Head of Events & Operations",
        department: "Experience & Logistics",
      },
      {
        name: "Pooja",
        role: "Lead of Events & Operations",
        department: "Experience & Logistics",
      },
    ],
  },
  {
    id: "finance",
    label: "FINANCE & SPONSORSHIP",
    category: "contact-sheet",
    targetFrame: 1140,
    members: [
      {
        name: "Pranav",
        role: "Head of Finance & Sponsorship",
        department: "Treasury & Capital",
      },
      {
        name: "Minal",
        role: "Team Lead Finance & Operations",
        department: "Treasury & Capital",
      },
    ],
  },
  {
    id: "outreach",
    label: "OUTREACH & PARTNERSHIPS",
    category: "contact-sheet",
    targetFrame: 1180,
    members: [
      {
        name: "Reetika",
        role: "Head of Outreach & Partnerships",
        department: "Ecosystem & Relations",
      },
    ],
  },
];

/**
 * Editorial Museum Portrait Surface
 * Features warm studio softbox illumination, fine photographic tonal depth,
 * subtle directional keylight, and zero UI badges or card borders.
 */
function EditorialPortraitSurface({
  name,
  className,
}: {
  name: string;
  className: string;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-white/15 shadow-[0_25px_60px_rgba(0,0,0,0.9)] bg-gradient-to-b from-[#181d26] via-[#0f131a] to-[#080b10] flex items-center justify-center select-none group-hover:border-emerald-400/40 transition-all duration-700 ${className}`}
    >
      {/* Studio Softbox Keylight from Top-Left */}
      <div className="absolute -top-16 -left-16 w-56 h-56 bg-white/[0.07] rounded-full blur-3xl pointer-events-none" />

      {/* Subtle Warm Fill Light from Bottom */}
      <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-emerald-500/[0.04] rounded-full blur-2xl pointer-events-none" />

      {/* Minimalist Editorial Monogram Silhouette (Placeholder awaiting final photograph) */}
      <div className="relative z-10 flex flex-col items-center justify-center p-6 text-center opacity-75 group-hover:opacity-95 transition-opacity">
        <span className="font-display text-3xl sm:text-4xl text-slate-100/40 tracking-wider uppercase group-hover:text-emerald-300/60 transition-colors drop-shadow-md">
          {name.charAt(0)}
        </span>
      </div>

      {/* Atmospheric photographic shadow falloff */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/10 pointer-events-none" />
    </div>
  );
}

export default function TeamWallSection({
  currentFrame = 940,
}: {
  currentFrame?: number;
}) {
  // Hero Leadership proximity calculation (Always at least 68% visible)
  const heroDist = Math.abs((currentFrame || 880) - 880);
  const heroIsActive = heroDist < 60;
  const heroOpacity = heroIsActive ? 1 : Math.max(0.70, 1 - (heroDist - 60) / 300);

  return (
    <div className="relative flex items-center gap-16 sm:gap-24 md:gap-32 lg:gap-40 shrink-0 select-none">
      {/* ========================================================================= */}
      {/* INVISIBLE APPLE STUDIO SOFTBOX ILLUMINATION                               */}
      {/* Expansive, seamless ambient exposure lift with zero visible circles/bubbles*/}
      {/* ========================================================================= */}
      <div
        className="absolute -top-40 left-0 right-0 h-[900px] pointer-events-none blur-3xl rounded-full"
        style={{
          background: `radial-gradient(ellipse at 45% 25%, rgba(255, 255, 255, 0.055) 0%, rgba(255, 255, 255, 0.015) 55%, transparent 80%)`,
        }}
        aria-hidden="true"
      />

      {/* ========================================================================= */}
      {/* CHAPTER OPENING: DRAMATIC EXHIBITION TITLE WALL                            */}
      {/* ========================================================================= */}
      <div className="relative shrink-0 flex flex-col justify-between w-[300px] sm:w-[360px] md:w-[420px] h-[520px] sm:h-[580px] lg:h-[620px] pr-8 sm:pr-12">
        <div>
          {/* Level 1: Monospace Indexing */}
          <div className="flex items-center gap-3 h-6 mb-5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]" />
            <span className="font-mono text-[11px] sm:text-xs font-semibold tracking-[0.25em] uppercase text-emerald-400 drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)]">
              02 — LEADERSHIP
            </span>
            <span className="h-px w-10 bg-white/20" />
          </div>

          {/* Level 2: Monumental 3-Line Title */}
          <h2 className="font-display text-5xl sm:text-6xl lg:text-7xl text-slate-50 tracking-[-0.01em] uppercase leading-[0.88] mb-6 drop-shadow-[0_4px_28px_rgba(0,0,0,0.98)]">
            THE PEOPLE<br />
            BEHIND THE<br />
            MOVEMENT.
          </h2>

          {/* Level 3: Exhibition Subtitle Narrative */}
          <p className="text-[15px] sm:text-[16px] text-slate-200/90 font-normal leading-[1.7] max-w-[340px] drop-shadow-[0_2px_10px_rgba(0,0,0,0.95)]">
            The strategists, operators, and creators steering the venture ecosystem at Woxsen University.
          </p>
        </div>

        {/* Footer Metadata */}
        <div className="pt-5 border-t border-white/10 flex items-center justify-between">
          <span className="font-mono text-[10px] sm:text-[11px] tracking-[0.25em] uppercase text-slate-400">
            2025 — 2026 COHORT
          </span>
          <span className="font-mono text-[10px] text-emerald-400/80 uppercase">
            WOXSEN E-CELL
          </span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* HERO DUO: PRESIDENT & VICE PRESIDENT (Asymmetric Editorial Spread)         */}
      {/* ========================================================================= */}
      <div
        className="relative shrink-0 flex items-end gap-10 sm:gap-14 lg:gap-18 transition-all duration-300 ease-out"
        style={{ opacity: heroOpacity }}
      >
        {/* President: Dominant Hero Portrait */}
        <div className="relative shrink-0 flex flex-col justify-end w-[280px] sm:w-[340px] lg:w-[400px] group">
          {/* Monospace Role Marker */}
          <div className="flex items-center gap-2 h-5 mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="font-mono text-[10px] sm:text-[11px] font-semibold tracking-[0.2em] uppercase text-emerald-400 drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]">
              EXECUTIVE // PRESIDENT
            </span>
          </div>

          {/* Monumental Hero Portrait */}
          <EditorialPortraitSurface
            name="Mohnish Singh Patwal"
            className="w-full h-[400px] sm:h-[460px] lg:h-[520px]"
          />

          {/* Museum Exhibition Caption (+10-15% Text Scale & High Contrast) */}
          <div className="mt-4 text-left">
            <h3 className="font-display text-2xl sm:text-3xl lg:text-[32px] text-slate-50 uppercase tracking-tight leading-tight group-hover:text-emerald-300 transition-colors drop-shadow-[0_3px_12px_rgba(0,0,0,0.98)]">
              Mohnish Singh Patwal
            </h3>
            <p className="font-mono text-[13px] sm:text-[14px] lg:text-[15px] text-slate-300/90 font-normal tracking-wide mt-1.5 drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)]">
              President & Strategic Lead
            </p>
          </div>
        </div>

        {/* Vice President: Asymmetric Complementary Hero */}
        <div className="relative shrink-0 flex flex-col justify-end w-[260px] sm:w-[310px] lg:w-[360px] group mb-3 sm:mb-5">
          {/* Monospace Role Marker */}
          <div className="flex items-center gap-2 h-5 mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="font-mono text-[10px] sm:text-[11px] font-semibold tracking-[0.2em] uppercase text-emerald-400 drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]">
              EXECUTIVE // VICE PRESIDENT
            </span>
          </div>

          {/* Complementary Hero Portrait */}
          <EditorialPortraitSurface
            name="Shreyas Kandi"
            className="w-full h-[370px] sm:h-[420px] lg:h-[470px]"
          />

          {/* Museum Exhibition Caption (+10-15% Text Scale & High Contrast) */}
          <div className="mt-4 text-left">
            <h3 className="font-display text-xl sm:text-2xl lg:text-[26px] text-slate-50 uppercase tracking-tight leading-tight group-hover:text-emerald-300 transition-colors drop-shadow-[0_3px_12px_rgba(0,0,0,0.98)]">
              Shreyas Kandi
            </h3>
            <p className="font-mono text-[13px] sm:text-[14px] lg:text-[15px] text-slate-300/90 font-normal tracking-wide mt-1.5 drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)]">
              Vice President & Operations
            </p>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* GALLERY CONTACT SHEET: FUNCTIONAL DEPARTMENTS & ADVISORS                  */}
      {/* ========================================================================= */}
      {TEAM_DATA.filter((grp) => grp.category === "contact-sheet").map((grp) => {
        // Continuous, subtle cinematic visibility falloff (never drops below 68%)
        const dist = Math.abs((currentFrame || 940) - grp.targetFrame);
        const isActive = dist < 50;
        const opacity = isActive
          ? 1
          : dist < 120
          ? Math.max(0.78, 1 - (dist - 50) / 320)
          : Math.max(0.68, 1 - (dist - 50) / 450);
        const scale = isActive ? 1 : 0.985;

        return (
          <div
            key={grp.id}
            className="relative shrink-0 flex flex-col justify-end w-[185px] sm:w-[215px] lg:w-[245px] h-[520px] sm:h-[580px] lg:h-[620px] will-change-transform transition-all duration-300 ease-out"
            style={{
              opacity,
              transform: `scale(${scale})`,
            }}
          >
            {/* Department Index Header */}
            <div className="flex items-center gap-2 h-5 mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/80" />
              <span className="font-mono text-[10.5px] sm:text-[11.5px] font-semibold tracking-[0.2em] uppercase text-emerald-400 drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)] truncate">
                // {grp.label}
              </span>
            </div>

            {/* Stacked 1x1 Contact Sheet Prints */}
            <div className="flex flex-col justify-between h-[460px] sm:h-[510px] lg:h-[550px]">
              {grp.members.map((member) => (
                <div key={member.name} className="group text-left flex flex-col justify-between">
                  {/* Square Exhibition Print */}
                  <EditorialPortraitSurface
                    name={member.name}
                    className="w-full aspect-square"
                  />

                  {/* Museum Caption (+10-15% Text Scale & High Contrast) */}
                  <div className="mt-2.5">
                    <h4 className="font-display text-[17px] sm:text-[18px] lg:text-[20px] text-slate-50 uppercase tracking-tight leading-snug group-hover:text-emerald-300 transition-colors drop-shadow-[0_2px_8px_rgba(0,0,0,0.98)] truncate">
                      {member.name}
                    </h4>
                    <p className="font-mono text-[11px] sm:text-[12px] lg:text-[13px] text-slate-300/85 tracking-tight mt-0.5 drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)] truncate">
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
