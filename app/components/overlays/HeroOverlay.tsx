"use client";

import React from "react";

interface HeroOverlayProps {
  currentFrame: number;
  onExploreClick: () => void;
  onOpenJoinModal?: () => void;
}

function HeroOverlay({
  currentFrame,
  onExploreClick,
  onOpenJoinModal,
}: HeroOverlayProps) {
  if (currentFrame > 45) return null;

  const part1 = "WHERE ";
  const part2 = "BUILDERS";
  const part3 = " START.";

  return (
    <div
      className="fixed inset-0 z-20 flex flex-col justify-center items-center px-6 sm:px-16 text-center pointer-events-none will-change-transform"
      style={{
        opacity: "var(--hero-opacity, 1)",
        transform: "translate3d(0, var(--hero-ty, 0px), 0)",
        visibility: "var(--hero-vis, visible)" as any,
      }}
    >
      <div className="relative z-10 max-w-[880px] mx-auto flex flex-col items-center text-center px-4 pointer-events-auto">
        {/* Subtitle / Eyebrow */}
        <p
          className="font-mono text-[11px] tracking-[0.1em] uppercase text-white mb-6 animate-fade-up delay-1 text-center drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] select-none"
          style={{ textAlign: "center" }}
        >
          Entrepreneurship Cell · Woxsen University
        </p>

        {/* Main Heading with Staggered Character Reveal */}
        <h1
          className="font-display text-[clamp(44px,7.5vw,100px)] leading-[0.95] tracking-[-0.01em] text-white mb-8 text-center select-none drop-shadow-[0_4px_10px_rgba(0,0,0,0.8)]"
          style={{ textAlign: "center" }}
          aria-label="WHERE BUILDERS START."
        >
          <span aria-hidden="true" className="inline-block whitespace-nowrap">
            {part1.split("").map((char, index) => (
              <span
                key={`p1-${index}`}
                className="inline-block animate-letter-reveal"
                style={{
                  animationDelay: `${index * 0.04}s`,
                  whiteSpace: char === " " ? "pre" : "normal",
                }}
              >
                {char}
              </span>
            ))}
            {part2.split("").map((char, index) => (
              <span
                key={`p2-${index}`}
                className="inline-block text-[#3fb950] animate-letter-reveal text-[1.25em]"
                style={{
                  animationDelay: `${(part1.length + index) * 0.04}s`,
                  whiteSpace: char === " " ? "pre" : "normal",
                }}
              >
                {char}
              </span>
            ))}
            {part3.split("").map((char, index) => (
              <span
                key={`p3-${index}`}
                className="inline-block animate-letter-reveal"
                style={{
                  animationDelay: `${(part1.length + part2.length + index) * 0.04}s`,
                  whiteSpace: char === " " ? "pre" : "normal",
                }}
              >
                {char}
              </span>
            ))}
          </span>
        </h1>

        {/* Description */}
        <p
          className="max-w-[560px] text-[15px] leading-[1.8] text-white font-light mb-10 animate-fade-up delay-3 text-center drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
          style={{ textAlign: "center", marginLeft: "auto", marginRight: "auto" }}
        >
          The Entrepreneurship Cell of Woxsen University. We build founders, not just businesses — through hands-on programs, mentorship, and a network that ships.
        </p>

        {/* Buttons */}
        <div className="flex items-center justify-center gap-4 animate-fade-up delay-4 max-sm:flex-col max-sm:w-full font-mono">
          <button
            onClick={onExploreClick}
            className="px-7 py-3 rounded-full bg-[#16a34a] hover:bg-[#22c55e] text-white text-xs sm:text-sm font-bold tracking-wider uppercase shadow-lg shadow-emerald-950/40 transition-all hover:scale-105 active:scale-95 cursor-pointer max-sm:w-full"
          >
            Explore Events
          </button>

          <button
            onClick={onOpenJoinModal}
            className="px-7 py-3 rounded-full bg-black/40 hover:bg-black/60 text-slate-200 hover:text-white text-xs sm:text-sm font-bold tracking-wider uppercase border border-white/20 hover:border-white/40 backdrop-blur-md transition-all hover:scale-105 active:scale-95 cursor-pointer max-sm:w-full"
          >
            Submit Your Idea
          </button>
        </div>
      </div>
    </div>
  );
}

export default React.memo(HeroOverlay, (prevProps, nextProps) => {
  if (prevProps.currentFrame > 35 && nextProps.currentFrame > 35) return true;
  return prevProps.currentFrame === nextProps.currentFrame;
});
