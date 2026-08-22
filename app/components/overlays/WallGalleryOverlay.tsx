"use client";

import React, { useEffect, useState } from "react";
import EventsWallCard from "./EventsWallCard";
import TeamWallCards from "./TeamWallCards";
import ContactWallCard from "./ContactWallCard";

interface WallGalleryOverlayProps {
  currentFrame: number;
  onOpenJoinModal: () => void;
}

function WallGalleryOverlay({
  currentFrame,
  onOpenJoinModal,
}: WallGalleryOverlayProps) {
  const [renderScale, setRenderScale] = useState(1);

  // Active range for the sequence: frames 603 to 840
  let opacity = 0;
  if (currentFrame >= 603 && currentFrame < 618) {
    opacity = (currentFrame - 603) / 15;
  } else if (currentFrame >= 618) {
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

  // Physical 1:1 camera tracking math for 600-840 (241 frames):
  // Total optical pan is ~1268px spread across 240 frames = 5.30px per frame in 1280x720 video space.
  const frameOffset = Math.max(0, currentFrame - 608);
  const pxPerFrame = 5.30;
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

export default React.memo(WallGalleryOverlay, (prevProps, nextProps) => {
  if (prevProps.currentFrame < 603 && nextProps.currentFrame < 603) return true;
  return prevProps.currentFrame === nextProps.currentFrame;
});
