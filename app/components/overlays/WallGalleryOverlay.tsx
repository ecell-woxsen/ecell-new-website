"use client";

import React, { useEffect, useState, useRef } from "react";
import EventsWallSection from "./EventsWallSection";
import TeamWallSection from "./TeamWallSection";
import ContactWallSection from "./ContactWallSection";

interface WallGalleryOverlayProps {
  currentFrame: number;
  onOpenJoinModal: () => void;
  onTrackWidthChange?: (width: number) => void;
}

function WallGalleryOverlay({
  currentFrame,
  onOpenJoinModal,
  onTrackWidthChange,
}: WallGalleryOverlayProps) {
  const [renderScale, setRenderScale] = useState(1);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateScaleAndWidth = () => {
      const scale = Math.min(1.2, Math.max(0.8, window.innerWidth / 1280));
      setRenderScale(scale);
      if (trackRef.current) {
        const totalWidth = trackRef.current.scrollWidth;
        const viewWidth = window.innerWidth;
        const width = Math.max(0, totalWidth - viewWidth);
        if (onTrackWidthChange) {
          onTrackWidthChange(width);
        }
      }
    };

    updateScaleAndWidth();
    window.addEventListener("resize", updateScaleAndWidth);
    return () => window.removeEventListener("resize", updateScaleAndWidth);
  }, [onTrackWidthChange]);

  return (
    <div
      className="fixed inset-0 z-30 flex items-center overflow-hidden pointer-events-none"
      style={{
        opacity: "var(--gallery-opacity, 0)",
        visibility: "var(--gallery-vis, hidden)" as any,
      }}
    >
      {/* Physically Wall-Anchored Gallery Track */}
      <div
        ref={trackRef}
        className="flex items-center gap-16 sm:gap-24 md:gap-36 lg:gap-44 pl-10 sm:pl-20 md:pl-32 pr-32 py-12 will-change-transform"
        style={{
          transform: "translate3d(var(--gallery-tx, 0px), 0, 0)",
          pointerEvents: "var(--gallery-pe, none)" as any,
        }}
      >
        {/* Section 1: Flagship Initiatives & Events (3 Sequential Chapters with Studio Spotlight) */}
        <EventsWallSection currentFrame={currentFrame} onOpenJoinModal={onOpenJoinModal} />

        {/* Section 2: Core Team Leadership (Cinematic Leadership Exhibition) */}
        <div className="shrink-0 pl-16 sm:pl-28 md:pl-40 lg:pl-56">
          <TeamWallSection currentFrame={currentFrame} />
        </div>

        {/* Section 3: Connect & Application Form (Architectural Wall Integration & Reveal) */}
        <div className="shrink-0 pl-24 sm:pl-36 md:pl-48 lg:pl-64">
          <ContactWallSection currentFrame={currentFrame} />
        </div>
      </div>
    </div>
  );
}

export default React.memo(WallGalleryOverlay, (prevProps, nextProps) => {
  if (prevProps.currentFrame < 590 && nextProps.currentFrame < 590) return true;
  return prevProps.currentFrame === nextProps.currentFrame;
});
