"use client";

import React, { useEffect, useState } from "react";
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

  // Active range for the 60fps sequence: frames 605 to 1078
  let opacity = 0;
  if (currentFrame >= 605 && currentFrame < 635) {
    opacity = (currentFrame - 605) / 30;
  } else if (currentFrame >= 635) {
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

  // Physical 1:1 camera tracking math for 600-1078 (478 interpolated 60fps frames):
  // Total optical pan is ~1268px spread across 478 frames = 2.65px per frame in 1280x720 video space.
  const frameOffset = Math.max(0, currentFrame - 615);
  const pxPerFrame = 2.65;
  const translateX = -(frameOffset * pxPerFrame * renderScale);

  return (
    <div
      className="fixed inset-0 z-30 flex items-center overflow-hidden transition-opacity duration-300 pointer-events-none"
      style={{
        opacity,
        visibility: opacity <= 0.005 ? "hidden" : "visible",
      }}
    >
      {/* Physically 1:1 Wall-Anchored Gallery Track */}
      <div
        className={`flex items-center gap-12 sm:gap-16 md:gap-24 pl-8 sm:pl-16 md:pl-28 pr-24 py-12 will-change-transform ${
          opacity > 0.1 ? "pointer-events-auto" : "pointer-events-none"
        }`}
        style={{
          transform: `translate3d(${translateX}px, 0, 0)`,
        }}
      >
        {/* Section 1: Flagship Initiatives & Events */}
        <div className="shrink-0">
          <EventsWallCard onOpenJoinModal={onOpenJoinModal} />
        </div>

        {/* Section 2: Core Team Leadership */}
        <div className="shrink-0">
          <TeamWallCards />
        </div>

        {/* Section 3: Connect & Application Form */}
        <div className="shrink-0">
          <ContactWallCard />
        </div>
      </div>
    </div>
  );
}
