"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { getAssetUrl } from "../../lib/assets";
import { loadTeamPack, getCachedTeamUrl } from "../../lib/teamPack";

interface TeamMember {
  name: string;
  role: string;
  department?: string;
  image: string;
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
        image: "/team/monis.webp",
      },
      {
        name: "Shreyas Kandi",
        role: "Vice President",
        department: "Executive Committee",
        image: "/team/Shreyas.webp",
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
        image: "/team/hc.webp",
      },
      {
        name: "Nihal",
        role: "Advisor",
        department: "Advisory Board",
        image: "/team/Nihal.webp",
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
        image: "/team/Shrinidhi.webp",
      },
      {
        name: "Abhichandra Medipally",
        role: "Secretary",
        department: "Governance & Secretariat",
        image: "/team/abhi.webp",
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
        image: "/team/imad.webp",
      },
      {
        name: "Aali",
        role: "Lead of Technology",
        department: "Engineering & Digital",
        image: "/team/aali.webp",
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
        image: "/team/mahek.webp",
      },
      {
        name: "Shloka",
        role: "Team Lead Marketing & Creatives",
        department: "Brand & Communications",
        image: "/team/Shloka.webp",
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
        image: "/team/mihir.webp",
      },
      {
        name: "Pooja",
        role: "Lead of Events & Operations",
        department: "Experience & Logistics",
        image: "/team/Pooja.webp",
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
        image: "/team/pranav.webp",
      },
      {
        name: "Minal",
        role: "Team Lead Finance & Operations",
        department: "Treasury & Capital",
        image: "/team/minal.webp",
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
        image: "/team/reetika.webp",
      },
    ],
  },
];

/**
 * Editorial Museum Portrait Surface
 * Features warm studio softbox illumination, fine photographic tonal depth,
 * subtle directional keylight, and high-performance unpacked binary images.
 */
function EditorialPortraitSurface({
  name,
  imageSrc,
  className,
}: {
  name: string;
  imageSrc?: string;
  className: string;
}) {
  return (
    <div
      className={`team-portrait-surface relative overflow-hidden rounded-2xl border border-white/15 shadow-[0_25px_60px_rgba(0,0,0,0.9)] bg-gradient-to-b from-[#181d26] via-[#0f131a] to-[#080b10] flex items-center justify-center select-none group-hover:border-emerald-400/40 transition-all duration-500 ${className}`}
    >
      {/* Studio Softbox Keylight from Top-Left (GPU-performant radial gradient, 0 blur kernels) */}
      <div
        className="absolute -top-16 -left-16 w-56 h-56 rounded-full pointer-events-none"
        style={{
          background: "radial-gradient(circle, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.02) 40%, transparent 70%)",
        }}
      />

      {/* Subtle Warm Fill Light from Bottom (GPU-performant radial gradient, 0 blur kernels) */}
      <div
        className="absolute -bottom-10 -right-10 w-48 h-48 rounded-full pointer-events-none"
        style={{
          background: "radial-gradient(circle, rgba(52, 211, 153, 0.06) 0%, rgba(52, 211, 153, 0.015) 45%, transparent 70%)",
        }}
      />

      {/* Render Portrait Image if available */}
      {imageSrc ? (
        <Image
          src={imageSrc}
          alt={name}
          fill
          unoptimized={imageSrc.startsWith("blob:")}
          className="object-cover object-top transition-transform duration-700 ease-out group-hover:scale-[1.04]"
          sizes="(max-width: 640px) 280px, (max-width: 1024px) 340px, 400px"
        />
      ) : (
        /* Minimalist Editorial Monogram Silhouette Fallback */
        <div className="relative z-10 flex flex-col items-center justify-center p-6 text-center transition-all duration-500">
          <span className="team-monogram font-display text-3xl sm:text-4xl tracking-wider uppercase text-slate-100/40 group-hover:text-emerald-300/60 transition-all drop-shadow-md">
            {name.charAt(0)}
          </span>
        </div>
      )}

      {/* Atmospheric photographic shadow falloff overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/15 pointer-events-none" />
    </div>
  );
}

export default function TeamWallSection({
  currentFrame = 1,
}: {
  currentFrame?: number;
}) {
  const [packUrls, setPackUrls] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const group of TEAM_DATA) {
      for (const member of group.members) {
        if (member.image) {
          const cached = getCachedTeamUrl(member.image);
          if (cached) initial[member.image] = cached;
        }
      }
    }
    return initial;
  });

  useEffect(() => {
    loadTeamPack().then((urls) => {
      setPackUrls((prev) => ({ ...prev, ...urls }));
    });
  }, []);

  // Frame-range culling: Mount images when entering the wall gallery (frame >= 598)
  // Pre-warmed pack blobs decode smoothly before user scrolls to the team section
  const shouldRenderImages = currentFrame >= 598 && currentFrame <= 1262;

  const resolveImage = (imagePath?: string): string | undefined => {
    if (!imagePath || !shouldRenderImages) return undefined;
    // 1. Prefer packed blob URL if available
    if (packUrls[imagePath]) return packUrls[imagePath];
    // 2. Only fall back to direct network fetch if the user is approaching the team wall
    if (currentFrame >= 750) {
      return getAssetUrl(imagePath);
    }
    // 3. Otherwise show monogram silhouette fallback until pack is ready
    return undefined;
  };

  const president = TEAM_DATA[0]?.members[0];
  const vicePresident = TEAM_DATA[0]?.members[1];

  return (
    <div className="relative flex items-center gap-16 sm:gap-24 md:gap-32 lg:gap-40 shrink-0 select-none">
      {/* INVISIBLE APPLE STUDIO SOFTBOX ILLUMINATION (Optimized radial gradient without 900px blur kernel) */}
      <div
        className="absolute -top-40 left-0 right-0 h-[900px] pointer-events-none rounded-full"
        style={{
          background: `radial-gradient(ellipse at 45% 25%, rgba(255, 255, 255, 0.055) 0%, rgba(255, 255, 255, 0.015) 55%, transparent 80%)`,
        }}
        aria-hidden="true"
      />

      {/* CHAPTER OPENING: DRAMATIC EXHIBITION TITLE WALL */}
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

      {/* HERO DUO: PRESIDENT & VICE PRESIDENT */}
      <div
        className="gallery-team-item gallery-team-hero relative shrink-0 flex items-end gap-10 sm:gap-14 lg:gap-18"
        style={{ contain: "layout style" }}
        data-active="true"
      >
        {/* President: Dominant Hero Portrait */}
        <div className="relative shrink-0 flex flex-col justify-end w-[280px] sm:w-[340px] lg:w-[400px] group">
          <div className="flex items-center gap-2 h-5 mb-3">
            <span className="team-hero-dot w-1.5 h-1.5 rounded-full bg-emerald-400/50 transition-all duration-300" />
            <span className="team-hero-label font-mono text-[10px] sm:text-[11px] font-semibold tracking-[0.2em] uppercase text-emerald-400/70 transition-colors duration-300">
              EXECUTIVE PRESIDENT
            </span>
          </div>

          <EditorialPortraitSurface
            name={president?.name || "Mohnish Singh Patwal"}
            imageSrc={resolveImage(president?.image)}
            className="w-full h-[400px] sm:h-[460px] lg:h-[520px]"
          />

          <div className="mt-4 text-left">
            <h3 className="team-hero-name font-display text-2xl sm:text-3xl lg:text-[32px] uppercase tracking-tight leading-tight text-slate-300/80 group-hover:text-emerald-300 transition-colors drop-shadow-[0_3px_12px_rgba(0,0,0,0.98)]">
              {president?.name || "Mohnish Singh Patwal"}
            </h3>
            <p className="team-hero-role font-mono text-[13px] sm:text-[14px] lg:text-[15px] font-normal tracking-wide mt-1.5 text-slate-400 drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)] transition-colors">
              President & Strategic Lead
            </p>
          </div>
        </div>

        {/* Vice President: Asymmetric Complementary Hero */}
        <div className="relative shrink-0 flex flex-col justify-end w-[260px] sm:w-[310px] lg:w-[360px] group mb-3 sm:mb-5">
          <div className="flex items-center gap-2 h-5 mb-3">
            <span className="team-hero-dot w-1.5 h-1.5 rounded-full bg-emerald-400/50 transition-all duration-300" />
            <span className="team-hero-label font-mono text-[10px] sm:text-[11px] font-semibold tracking-[0.2em] uppercase text-emerald-400/70 transition-colors duration-300">
              EXECUTIVE VICE PRESIDENT
            </span>
          </div>

          <EditorialPortraitSurface
            name={vicePresident?.name || "Shreyas Kandi"}
            imageSrc={resolveImage(vicePresident?.image)}
            className="w-full h-[370px] sm:h-[420px] lg:h-[470px]"
          />

          <div className="mt-4 text-left">
            <h3 className="team-hero-name font-display text-xl sm:text-2xl lg:text-[26px] uppercase tracking-tight leading-tight text-slate-300/80 group-hover:text-emerald-300 transition-colors drop-shadow-[0_3px_12px_rgba(0,0,0,0.98)]">
              {vicePresident?.name || "Shreyas Kandi"}
            </h3>
            <p className="team-hero-role font-mono text-[13px] sm:text-[14px] lg:text-[15px] font-normal tracking-wide mt-1.5 text-slate-400 drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)] transition-colors">
              Vice President & Operations
            </p>
          </div>
        </div>
      </div>

      {/* GALLERY CONTACT SHEET: FUNCTIONAL DEPARTMENTS & ADVISORS */}
      {TEAM_DATA.filter((grp) => grp.category === "contact-sheet").map((grp) => {
        return (
          <div
            key={grp.id}
            data-active="false"
            className="gallery-team-item gallery-team-col relative shrink-0 flex flex-col justify-end w-[185px] sm:w-[215px] lg:w-[245px] h-[520px] sm:h-[580px] lg:h-[620px]"
            style={{ contain: "layout style" }}
          >
            {/* Department Index Header */}
            <div className="flex items-center gap-2 h-5 mb-3">
              <span className="team-col-dot w-1.5 h-1.5 rounded-full bg-emerald-400/50 transition-all duration-300" />
              <span className="team-col-label font-mono text-[10.5px] sm:text-[11.5px] font-semibold tracking-[0.2em] uppercase text-emerald-400/60 transition-colors duration-300 truncate">
                {grp.label}
              </span>
            </div>

            {/* Stacked 1x1 Contact Sheet Prints */}
            <div className="flex flex-col justify-between h-[460px] sm:h-[510px] lg:h-[550px]">
              {grp.members.map((member) => (
                <div key={member.name} className="group text-left flex flex-col justify-between">
                  {/* Square Exhibition Print */}
                  <EditorialPortraitSurface
                    name={member.name}
                    imageSrc={resolveImage(member.image)}
                    className="w-full aspect-square"
                  />

                  {/* Museum Caption */}
                  <div className="mt-2.5">
                    <h4 className="team-col-name font-display text-[17px] sm:text-[18px] lg:text-[20px] uppercase tracking-tight leading-snug text-slate-300/80 group-hover:text-emerald-300 transition-colors drop-shadow-[0_2px_8px_rgba(0,0,0,0.98)] truncate">
                      {member.name}
                    </h4>
                    <p className="team-col-role font-mono text-[11px] sm:text-[12px] lg:text-[13px] tracking-tight mt-0.5 text-slate-400 drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)] truncate transition-colors">
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
