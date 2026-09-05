"use client";

import React, { useEffect, useRef } from "react";
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
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateScaleAndWidth = () => {
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

  // Real-time, 60/120fps center-card focus detector
  // Ensures whichever card or column is at the center of the viewport is strictly 100% opaque
  useEffect(() => {
    let rafId: number;
    let lastCheck = 0;
    let cachedEventCards: HTMLElement[] | null = null;
    let cachedTeamItems: HTMLElement[] | null = null;

    const updateActiveCards = (time: number) => {
      rafId = requestAnimationFrame(updateActiveCards);

      // Smooth ~16Hz check (every ~60ms) is ideal for 0.35s CSS highlight transitions
      // without burning GPU/CPU rasterization bandwidth on continuous layout reads
      if (time - lastCheck < 60) return;
      lastCheck = time;

      const track = trackRef.current;
      if (!track) return;

      // Skip entirely if gallery is invisible or hidden (zero layout flush)
      const parent = track.parentElement;
      if (parent) {
        const vis = parent.style.getPropertyValue("--gallery-vis");
        if (vis === "hidden") return;
      }

      if (!cachedEventCards || cachedEventCards.length === 0) {
        cachedEventCards = Array.from(track.querySelectorAll<HTMLElement>(".gallery-event-card"));
      }
      if (!cachedTeamItems || cachedTeamItems.length === 0) {
        cachedTeamItems = Array.from(track.querySelectorAll<HTMLElement>(".gallery-team-item"));
      }

      const screenCenter = window.innerWidth / 2;

      // 1. Events Section: Find closest event card to screen center
      if (cachedEventCards.length > 0) {
        let closestEvent: HTMLElement | null = null;
        let minEventDist = Infinity;

        for (let i = 0; i < cachedEventCards.length; i++) {
          const card = cachedEventCards[i];
          const rect = card.getBoundingClientRect();
          const center = rect.left + rect.width / 2;
          const dist = Math.abs(center - screenCenter);
          if (dist < minEventDist) {
            minEventDist = dist;
            closestEvent = card;
          }
        }

        for (let i = 0; i < cachedEventCards.length; i++) {
          const card = cachedEventCards[i];
          const isActive = card === closestEvent;
          const cur = card.getAttribute("data-active");
          if (isActive && cur !== "true") {
            card.setAttribute("data-active", "true");
          } else if (!isActive && cur !== "false") {
            card.setAttribute("data-active", "false");
          }
        }
      }

      // 2. Team Section: Find closest team column or hero to screen center
      if (cachedTeamItems.length > 0) {
        let closestTeam: HTMLElement | null = null;
        let minTeamDist = Infinity;

        for (let i = 0; i < cachedTeamItems.length; i++) {
          const item = cachedTeamItems[i];
          const rect = item.getBoundingClientRect();
          const center = rect.left + rect.width / 2;
          const dist = Math.abs(center - screenCenter);
          if (dist < minTeamDist) {
            minTeamDist = dist;
            closestTeam = item;
          }
        }

        for (let i = 0; i < cachedTeamItems.length; i++) {
          const item = cachedTeamItems[i];
          const isActive = item === closestTeam;
          const cur = item.getAttribute("data-active");
          if (isActive && cur !== "true") {
            item.setAttribute("data-active", "true");
          } else if (!isActive && cur !== "false") {
            item.setAttribute("data-active", "false");
          }
        }
      }
    };

    rafId = requestAnimationFrame(updateActiveCards);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <div
      className="fixed inset-0 z-30 flex items-center overflow-hidden pointer-events-none"
      style={{
        opacity: "var(--gallery-opacity, 0)",
        visibility: "var(--gallery-vis, hidden)" as React.CSSProperties["visibility"],
      }}
    >
      {/* Physically Wall-Anchored Gallery Track */}
      <div
        ref={trackRef}
        className="flex items-center gap-16 sm:gap-24 md:gap-36 lg:gap-44 pl-10 sm:pl-20 md:pl-32 pr-32 py-12 will-change-transform"
        style={{
          transform: "translate3d(var(--gallery-tx, 0px), 0, 0)",
          pointerEvents: "var(--gallery-pe, none)" as React.CSSProperties["pointerEvents"],
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
