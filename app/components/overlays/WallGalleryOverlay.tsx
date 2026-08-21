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
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [maxScrollWidth, setMaxScrollWidth] = useState(0);

  // Active range: frames 590 to 1041
  let opacity = 0;
  if (currentFrame >= 590 && currentFrame < 610) {
    opacity = (currentFrame - 590) / 20;
  } else if (currentFrame >= 610) {
    opacity = 1;
  }

  useEffect(() => {
    const calculateWidth = () => {
      if (trackRef.current && containerRef.current) {
        const trackWidth = trackRef.current.scrollWidth;
        const viewportWidth = window.innerWidth;
        // Total distance the track needs to shift from start to end
        setMaxScrollWidth(Math.max(0, trackWidth - viewportWidth + 120));
      }
    };

    calculateWidth();
    window.addEventListener("resize", calculateWidth);
    return () => window.removeEventListener("resize", calculateWidth);
  }, []);

  if (opacity <= 0.01) return null;

  // Normalized progression along the wall (0 at frame 605, 1 at frame 1040)
  const startFrame = 605;
  const endFrame = 1040;
  const t = Math.min(1, Math.max(0, (currentFrame - startFrame) / (endFrame - startFrame)));

  // Smooth easing for physical wall tracking
  const translateX = -(t * maxScrollWidth);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-30 flex items-center overflow-hidden pointer-events-none transition-opacity duration-300"
      style={{ opacity }}
    >
      {/* Wall Spotlight Ambient Glow */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Horizontally Panning Gallery Track */}
      <div
        ref={trackRef}
        className="flex items-center gap-8 sm:gap-12 pl-6 sm:pl-16 md:pl-24 pr-16 py-12 pointer-events-auto will-change-transform transition-transform duration-100 ease-out"
        style={{
          transform: `translate3d(${translateX}px, 0, 0)`,
        }}
      >
        {/* Section 1: Flagship Initiatives & Events */}
        <EventsWallCard onOpenJoinModal={onOpenJoinModal} />

        {/* Section 2: Core Team Leadership */}
        <TeamWallCards />

        {/* Section 3: Connect & Application Form */}
        <ContactWallCard />
      </div>
    </div>
  );
}
