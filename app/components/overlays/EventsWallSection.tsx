"use client";

import React from "react";
import Image from "next/image";

interface EventsWallSectionProps {
  currentFrame?: number;
  onOpenJoinModal?: () => void;
}

const EVENTS_DATA = [
  {
    number: "01",
    label: "01 — FLAGSHIP EVENT",
    title: "HULT",
    description:
      "An on-campus Hult Prize experience bringing student innovators together to develop ambitious, globally relevant startup ideas.",
    image: "/events/hult.png",
    alt: "Hult Prize On-Campus Experience at Woxsen",
    targetFrame: 640,
    range: [600, 695],
  },
  {
    number: "02",
    label: "02 — FLAGSHIP EVENT",
    title: "PANEL DISCUSSION",
    description:
      "A high-impact leadership exchange uniting industry leaders, venture builders, and aspiring founders to dissect emerging market paradigms.",
    image: "/events/panel-discussion.jpg",
    alt: "E-Cell Panel Discussion and Keynote at Woxsen",
    targetFrame: 725,
    range: [695, 775],
  },
  {
    number: "03",
    label: "03 — FLAGSHIP EVENT",
    title: "GAME NIGHT",
    description:
      "An immersive community mixer uniting campus strategists and creators through interactive challenges, casual networking, and rapid problem solving.",
    image: "/events/game-night.jpg",
    alt: "E-Cell Game Night and Community Networking",
    targetFrame: 805,
    range: [775, 855],
  },
];

export default function EventsWallSection({
  currentFrame = 650,
}: EventsWallSectionProps) {
  return (
    <div className="flex items-center gap-24 sm:gap-36 md:gap-52 lg:gap-72 shrink-0">
      {EVENTS_DATA.map((event) => {
        // Calculate focal distance to highlight active event
        const dist = Math.abs(currentFrame - event.targetFrame);
        const isActive = dist < 55;
        const opacity = isActive
          ? 1
          : Math.max(0.42, 1 - (dist - 55) / 90);
        const scale = isActive ? 1 : 0.97;
        const spotlightOpacity = isActive
          ? 1
          : Math.max(0.25, 1 - (dist - 55) / 80);

        return (
          <div
            key={event.number}
            className="relative shrink-0 flex flex-col items-start justify-center w-[85vw] sm:w-[500px] md:w-[560px] lg:w-[620px] select-none will-change-transform transition-all duration-300 ease-out"
            style={{
              opacity,
              transform: `scale(${scale})`,
            }}
          >
            {/* ========================================================================= */}
            {/* STUDIO SPOTLIGHT EFFECT                                                   */}
            {/* Organic, soft radial illumination centered over the active event          */}
            {/* ========================================================================= */}
            <div
              className="absolute -top-16 -left-16 sm:-left-20 w-[540px] sm:w-[660px] h-[520px] sm:h-[620px] pointer-events-none rounded-full transition-opacity duration-300"
              style={{
                opacity: spotlightOpacity,
                background: `
                  radial-gradient(circle at 38% 30%, rgba(255, 255, 255, 0.08) 0%, rgba(5, 8, 14, 0.48) 44%, rgba(5, 8, 14, 0) 76%)
                `,
              }}
              aria-hidden="true"
            />

            {/* ========================================================================= */}
            {/* TYPOGRAPHY INTEGRATED INTO THE WALL                                       */}
            {/* ========================================================================= */}
            <div className="relative z-10 text-left mb-4 sm:mb-5 max-w-[540px]">
              {/* Level 1: Refined Editorial Index Label */}
              <div className="flex items-center gap-2.5 h-5 mb-2.5 sm:mb-3">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]" />
                <span className="font-mono text-[10px] sm:text-[11px] font-semibold tracking-[0.22em] uppercase text-emerald-400 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
                  {event.label}
                </span>
                <span className="h-px w-6 bg-white/20" />
              </div>

              {/* Level 2: Scaled Editorial Title */}
              <h3 className="font-display text-4xl sm:text-5xl lg:text-6xl xl:text-[66px] text-slate-50 tracking-[-0.01em] uppercase leading-[0.92] mb-3 sm:mb-4 drop-shadow-[0_4px_20px_rgba(0,0,0,0.98)]">
                {event.title}
              </h3>

              {/* Level 3: Restrained Editorial Reading Description */}
              <p className="text-[14px] sm:text-[15px] text-slate-100/90 font-normal leading-[1.65] drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)] max-w-[480px] lg:max-w-[540px]">
                {event.description}
              </p>
            </div>

            {/* ========================================================================= */}
            {/* LEVEL 4: MOUNTED EDITORIAL EXHIBITION PHOTOGRAPH                          */}
            {/* Proportional exhibition print with breathing room and subtle depth        */}
            {/* ========================================================================= */}
            <div
              className="relative z-10 w-full max-w-[540px] lg:max-w-[620px] aspect-[16/9.5] rounded-xl sm:rounded-2xl overflow-hidden border border-white/15 shadow-[0_20px_45px_rgba(0,0,0,0.85)] group transition-all duration-500 hover:border-emerald-400/40"
            >
              <Image
                src={event.image}
                alt={event.alt}
                fill
                className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.02]"
                sizes="(max-width: 768px) 85vw, 620px"
                priority
              />
              {/* Atmospheric lighting gradient */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/10 pointer-events-none" />
            </div>
          </div>
        );
      })}
    </div>
  );
}
