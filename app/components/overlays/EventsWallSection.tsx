"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { getAssetUrl } from "../../lib/assets";
import { loadEventsPack, getCachedEventUrl } from "../../lib/eventsPack";

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
    targetFrame: 630,
    range: [598, 680],
  },
  {
    number: "02",
    label: "02 — FLAGSHIP EVENT",
    title: "PANEL DISCUSSION",
    description:
      "A high-impact leadership exchange uniting industry leaders, venture builders, and aspiring founders to dissect emerging market paradigms.",
    image: "/events/panel-discussion.jpg",
    alt: "E-Cell Panel Discussion and Keynote at Woxsen",
    targetFrame: 730,
    range: [680, 775],
  },
  {
    number: "03",
    label: "03 — FLAGSHIP EVENT",
    title: "GAME NIGHT",
    description:
      "An immersive community mixer uniting campus strategists and creators through interactive challenges, casual networking, and rapid problem solving.",
    image: "/events/game-night.jpg",
    alt: "E-Cell Game Night and Community Networking",
    targetFrame: 810,
    range: [775, 860],
  },
];

export default function EventsWallSection({}: EventsWallSectionProps) {
  const [packUrls, setPackUrls] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const item of EVENTS_DATA) {
      const cached = getCachedEventUrl(item.image);
      if (cached) initial[item.image] = cached;
    }
    return initial;
  });

  useEffect(() => {
    loadEventsPack().then((urls) => {
      setPackUrls((prev) => ({ ...prev, ...urls }));
    });
  }, []);

  return (
    <div className="flex items-center gap-24 sm:gap-36 md:gap-52 lg:gap-72 shrink-0">
      {EVENTS_DATA.map((event, index) => {
        return (
          <div
            key={event.number}
            data-active={index === 0 ? "true" : "false"}
            className="gallery-event-card relative shrink-0 flex flex-col items-start justify-center w-[85vw] sm:w-[500px] md:w-[560px] lg:w-[620px] select-none"
            style={{ contain: "layout style" }}
          >
            {/* CINEMATIC AMBIENT ILLUMINATION (GPU-performant softbox gradient without 900px blur kernel) */}
            <div
              className="absolute -top-28 -left-28 w-[720px] h-[600px] pointer-events-none rounded-full"
              style={{
                background: `radial-gradient(ellipse at 40% 35%, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.015) 45%, transparent 70%)`,
              }}
              aria-hidden="true"
            />

            {/* TYPOGRAPHY INTEGRATED INTO THE WALL */}
            <div className="relative z-10 text-left mb-4 sm:mb-5 max-w-[540px]">
              {/* Level 1: Refined Editorial Index Label */}
              <div className="flex items-center gap-2.5 h-5 mb-2.5 sm:mb-3">
                <span className="event-card-dot w-1.5 h-1.5 rounded-full bg-emerald-400/50 transition-all duration-300" />
                <span className="event-card-label font-mono text-[10px] sm:text-[11px] font-semibold tracking-[0.22em] uppercase text-emerald-400/70 transition-colors duration-300">
                  {event.label}
                </span>
                <span className="h-px w-6 bg-white/20" />
              </div>

              {/* Level 2: Scaled Editorial Title */}
              <h3 className="event-card-title font-display text-4xl sm:text-5xl lg:text-6xl xl:text-[66px] tracking-[-0.01em] uppercase leading-[0.92] mb-3 sm:mb-4 text-slate-200/80 drop-shadow-[0_4px_20px_rgba(0,0,0,0.98)] transition-colors duration-300">
                {event.title}
              </h3>

              {/* Level 3: Restrained Editorial Reading Description */}
              <p className="text-[14px] sm:text-[15px] text-slate-100/90 font-normal leading-[1.65] drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)] max-w-[480px] lg:max-w-[540px]">
                {event.description}
              </p>
            </div>

            {/* LEVEL 4: MOUNTED EDITORIAL EXHIBITION PHOTOGRAPH */}
            <div className="event-card-image relative z-10 w-full max-w-[540px] lg:max-w-[620px] aspect-[16/9.5] rounded-xl sm:rounded-2xl overflow-hidden border border-white/15 bg-[#0a0f16] shadow-[0_20px_45px_rgba(0,0,0,0.85)] group transition-all duration-500">
              <Image
                src={packUrls[event.image] || getAssetUrl(event.image)}
                alt={event.alt}
                fill
                unoptimized={Boolean(packUrls[event.image])}
                className="event-card-img object-cover transition-transform duration-700 ease-out group-hover:scale-[1.02]"
                sizes="(max-width: 768px) 85vw, 620px"
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
