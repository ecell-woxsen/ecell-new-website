"use client";

import React, { useEffect, useState, useRef } from "react";
import EventsWallSection from "./EventsWallSection";
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
  const trackRef = useRef<HTMLDivElement>(null);
  const [maxScrollWidth, setMaxScrollWidth] = useState(2400);

  // Active range for the sequence: frames 603 to 1262
  let opacity = 0;
  if (currentFrame >= 603 && currentFrame < 618) {
    opacity = (currentFrame - 603) / 15;
  } else if (currentFrame >= 618) {
    opacity = 1;
  }

  useEffect(() => {
    const updateScaleAndWidth = () => {
      const scale = Math.max(window.innerWidth / 1280, window.innerHeight / 720);
      setRenderScale(scale);
      if (trackRef.current) {
        const totalWidth = trackRef.current.scrollWidth;
        const viewWidth = window.innerWidth;
        setMaxScrollWidth(Math.max(0, totalWidth - viewWidth + 180 * scale));
      }
    };

    updateScaleAndWidth();
    window.addEventListener("resize", updateScaleAndWidth);
    return () => window.removeEventListener("resize", updateScaleAndWidth);
  }, []);

  // Smooth normalized tracking across the extended 1262-frame sequence
  // Starts at frame 608, completes smoothly at frame 1262
  const startFrame = 608;
  const endFrame = 1262;
  const progress = Math.min(1, Math.max(0, (currentFrame - startFrame) / (endFrame - startFrame)));
  const translateX = -(progress * maxScrollWidth);

  return (
    <div
      className="fixed inset-0 z-30 flex items-center overflow-hidden transition-opacity duration-300 pointer-events-none"
      style={{
        opacity,
        visibility: opacity <= 0.005 ? "hidden" : "visible",
      }}
    >
      {/* Physically Wall-Anchored Gallery Track */}
      <div
        ref={trackRef}
        className={`flex items-center gap-16 sm:gap-24 md:gap-36 lg:gap-44 pl-10 sm:pl-20 md:pl-32 pr-32 py-12 will-change-transform ${
          opacity > 0.1 ? "pointer-events-auto" : "pointer-events-none"
        }`}
        style={{
          transform: `translate3d(${translateX}px, 0, 0)`,
        }}
      >
        {/* Section 1: Flagship Initiatives & Events (3 Sequential Chapters with Studio Spotlight) */}
        <EventsWallSection onOpenJoinModal={onOpenJoinModal} />

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
