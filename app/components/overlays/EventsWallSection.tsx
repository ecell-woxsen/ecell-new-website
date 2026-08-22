"use client";

import React from "react";
import Image from "next/image";

interface EventsWallSectionProps {
  onOpenJoinModal?: () => void;
}

const EVENTS_DATA = [
  {
    number: "01",
    label: "FLAGSHIP EVENT / 01",
    title: "HULT",
    description:
      "An on-campus Hult Prize experience bringing student innovators together to develop ambitious, globally relevant startup ideas.",
    image: "/events/hult.png",
    alt: "Hult Prize On-Campus Experience at Woxsen",
    aspect: "aspect-[16/9.5]",
  },
  {
    number: "02",
    label: "FLAGSHIP EVENT / 02",
    title: "PANEL DISCUSSION",
    description:
      "A high-impact leadership exchange uniting industry leaders, venture builders, and aspiring founders to dissect emerging market paradigms.",
    image: "/events/panel-discussion.jpg",
    alt: "E-Cell Panel Discussion and Keynote at Woxsen",
    aspect: "aspect-[16/10.5]",
  },
  {
    number: "03",
    label: "FLAGSHIP EVENT / 03",
    title: "GAME NIGHT",
    description:
      "An immersive community mixer uniting campus strategists and creators through interactive challenges, casual networking, and rapid problem solving.",
    image: "/events/game-night.jpg",
    alt: "E-Cell Game Night and Community Networking",
    aspect: "aspect-[16/9.5]",
  },
];

export default function EventsWallSection({
  onOpenJoinModal,
}: EventsWallSectionProps) {
  return (
    <div className="flex items-center gap-16 sm:gap-24 md:gap-36 lg:gap-48 shrink-0">
      {EVENTS_DATA.map((event) => (
        <div
          key={event.number}
          className="relative shrink-0 flex flex-col items-start justify-center w-[88vw] sm:w-[580px] md:w-[660px] lg:w-[740px] select-none"
        >
          {/* ========================================================================= */}
          {/* STUDIO SPOTLIGHT EFFECT                                                   */}
          {/* Soft, organic illumination falloff behind the event typography            */}
          {/* ========================================================================= */}
          <div
            className="absolute -top-20 -left-16 sm:-left-24 w-[600px] sm:w-[760px] h-[580px] sm:h-[720px] pointer-events-none rounded-full"
            style={{
              background: `
                radial-gradient(circle at 35% 32%, rgba(255, 255, 255, 0.09) 0%, rgba(5, 8, 14, 0.52) 42%, rgba(5, 8, 14, 0) 74%)
              `,
            }}
            aria-hidden="true"
          />

          {/* ========================================================================= */}
          {/* TYPOGRAPHY INTEGRATED INTO THE WALL                                       */}
          {/* ========================================================================= */}
          <div className="relative z-10 text-left mb-6 sm:mb-8 max-w-[620px]">
            {/* Level 1: Small Section Label */}
            <div className="flex items-center gap-3 h-6 mb-3 sm:mb-4">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
              <span className="font-mono text-[11px] sm:text-xs font-semibold tracking-[0.22em] uppercase text-emerald-400 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
                {event.label}
              </span>
              <span className="h-px w-8 bg-white/25" />
            </div>

            {/* Level 2: Monolithic Event Title */}
            <h3 className="font-display text-5xl sm:text-6xl lg:text-7xl xl:text-8xl text-slate-50 tracking-[-0.01em] uppercase leading-[0.90] mb-4 sm:mb-5 drop-shadow-[0_4px_24px_rgba(0,0,0,0.98)]">
              {event.title}
            </h3>

            {/* Level 3: Short Editorial Description */}
            <p className="text-[15px] sm:text-[16px] lg:text-[17px] text-slate-100/90 font-normal leading-[1.75] drop-shadow-[0_2px_10px_rgba(0,0,0,0.95)] max-w-[580px]">
              {event.description}
            </p>
          </div>

          {/* ========================================================================= */}
          {/* LEVEL 4: MOUNTED EDITORIAL EXHIBITION PHOTOGRAPH                          */}
          {/* Physical exhibition print mounted in the environment                      */}
          {/* ========================================================================= */}
          <div
            className={`relative z-10 w-full max-w-[680px] ${event.aspect} rounded-2xl overflow-hidden border border-white/15 shadow-[0_25px_60px_rgba(0,0,0,0.85)] group transition-all duration-500 hover:border-emerald-400/40`}
          >
            <Image
              src={event.image}
              alt={event.alt}
              fill
              className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.02]"
              sizes="(max-width: 768px) 88vw, 680px"
              priority
            />
            {/* Subtle atmospheric vignette */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/10 pointer-events-none" />
          </div>
        </div>
      ))}
    </div>
  );
}
