"use client";

import React, { useRef, useEffect, useState } from "react";
import EventsWallCard from "./EventsWallCard";
import TeamWallCards from "./TeamWallCards";
import ContactWallCard from "./ContactWallCard";

interface WallGalleryOverlayProps {
  currentFrame: number;
  onOpenJoinModal: () => void;
}

export default function WallGalleryOverlay({
  currentFrame,
  onOpenJoinModal,
}: WallGalleryOverlayProps) {
  const [renderScale, setRenderScale] = useState(1);

  // Active range: frames 592 to 840
  let opacity = 0;
  if (currentFrame >= 592 && currentFrame < 605) {
    opacity = (currentFrame - 592) / 13;
  } else if (currentFrame >= 605) {
    opacity = 1;
  }

  useEffect(() => {
    const updateScale = () => {
      const scale = Math.max(window.innerWidth / 1280, window.innerHeight / 720);
      setRenderScale(scale);
    };

    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, []);

  // Physical 1:1 camera tracking math:
  // In the 1280x720 video, the concrete wall moves left by ~5.25px per frame from frame 600 to 840.
  const frameOffset = Math.max(0, currentFrame - 600);
  const pxPerFrame = 5.25;
  const translateX = -(frameOffset * pxPerFrame * renderScale);

  return (
    <div
      className="fixed inset-0 z-30 flex items-center overflow-hidden transition-opacity duration-300 pointer-events-none"
      style={{
        opacity,
        visibility: opacity <= 0.005 ? "hidden" : "visible",
      }}
    >
      {/* Wall Spotlight Ambient Glow */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Physically 1:1 Wall-Anchored Gallery Track */}
      <div
        className={`flex items-center gap-12 sm:gap-16 md:gap-24 pl-8 sm:pl-16 md:pl-28 pr-24 py-12 will-change-transform ${
          opacity > 0.1 ? "pointer-events-auto" : "pointer-events-none"
        }`}
        style={{
          transform: `translate3d(${translateX}px, 0, 0)`,
        }}
      >
        {/* Section 1: Flagship Initiatives & Events (Anchored at beginning of wall) */}
        <div className="shrink-0 transition-transform duration-300 hover:scale-[1.01]">
          <EventsWallCard onOpenJoinModal={onOpenJoinModal} />
        </div>

        {/* Section 2: Core Team Leadership (Anchored at middle of wall) */}
        <div className="shrink-0 transition-transform duration-300 hover:scale-[1.01]">
          <TeamWallCards />
        </div>

        {/* Section 3: Connect & Application Form (Anchored at end of wall) */}
        <div className="shrink-0 transition-transform duration-300 hover:scale-[1.01]">
          <ContactWallCard />
        </div>
      </div>
    </div>
  );
}
