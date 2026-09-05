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

  // Cached relative centers (distance from track left edge to card center)
  // Measured ONCE on resize/mount, NEVER during scrolling (zero layout reflows)
  const eventCentersRef = useRef<number[]>([]);
  const teamCentersRef = useRef<number[]>([]);
  const activeEventIdxRef = useRef<number>(0);
  const activeTeamIdxRef = useRef<number>(0);

  useEffect(() => {
    const updateGeometry = () => {
      const track = trackRef.current;
      if (!track) return;

      const totalWidth = track.scrollWidth;
      const viewWidth = window.innerWidth;
      const width = Math.max(0, totalWidth - viewWidth);
      if (onTrackWidthChange) {
        onTrackWidthChange(width);
      }

      // Pre-calculate invariant relative center points of cards along the track
      // (BoundingClientRect called ONLY on mount/window resize, NEVER during scroll)
      const trackRect = track.getBoundingClientRect();
      const trackLeft = trackRect.left;

      const eventCards = Array.from(track.querySelectorAll<HTMLElement>(".gallery-event-card"));
      eventCentersRef.current = eventCards.map((card) => {
        const r = card.getBoundingClientRect();
        return r.left - trackLeft + r.width / 2;
      });

      const teamItems = Array.from(track.querySelectorAll<HTMLElement>(".gallery-team-item"));
      teamCentersRef.current = teamItems.map((item) => {
        const r = item.getBoundingClientRect();
        return r.left - trackLeft + r.width / 2;
      });
    };

    updateGeometry();
    // Allow an additional tick after initial layout/fonts settle
    const timer = setTimeout(updateGeometry, 150);
    window.addEventListener("resize", updateGeometry);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", updateGeometry);
    };
  }, [onTrackWidthChange]);

  // Real-time, zero-reflow center-card focus detector
  // Uses pure arithmetic against cached geometry & direct style property lookup
  useEffect(() => {
    let rafId: number;
    let lastCheck = 0;
    let cachedEventCards: HTMLElement[] | null = null;
    let cachedTeamItems: HTMLElement[] | null = null;

    const updateActiveCards = (time: number) => {
      rafId = requestAnimationFrame(updateActiveCards);

      // ~25Hz check (every ~40ms) is ideal for 0.35s CSS transitions
      // with zero layout reads and zero compositor stalls
      if (time - lastCheck < 40) return;
      lastCheck = time;

      const track = trackRef.current;
      if (!track) return;

      const parent = track.parentElement;
      const container = parent?.parentElement || track.closest<HTMLElement>("[style*='--gallery-tx']");
      if (!container) return;

      // Skip entirely if gallery is invisible or hidden (zero work when outside wall)
      const vis = container.style.getPropertyValue("--gallery-vis") || parent?.style.getPropertyValue("--gallery-vis");
      if (vis === "hidden") return;

      const txRaw = container.style.getPropertyValue("--gallery-tx");
      const tx = parseFloat(txRaw) || 0;
      const screenCenter = window.innerWidth / 2;

      // 1. Events Section: Find closest event card using cached geometry
      const eventCenters = eventCentersRef.current;
      if (eventCenters.length > 0) {
        if (!cachedEventCards || cachedEventCards.length === 0) {
          cachedEventCards = Array.from(track.querySelectorAll<HTMLElement>(".gallery-event-card"));
        }

        let closestEventIdx = 0;
        let minEventDist = Infinity;
        for (let i = 0; i < eventCenters.length; i++) {
          const dist = Math.abs(tx + eventCenters[i] - screenCenter);
          if (dist < minEventDist) {
            minEventDist = dist;
            closestEventIdx = i;
          }
        }

        if (closestEventIdx !== activeEventIdxRef.current && cachedEventCards.length > 0) {
          activeEventIdxRef.current = closestEventIdx;
          for (let i = 0; i < cachedEventCards.length; i++) {
            const card = cachedEventCards[i];
            const isActive = i === closestEventIdx;
            const cur = card.getAttribute("data-active");
            if (isActive && cur !== "true") {
              card.setAttribute("data-active", "true");
            } else if (!isActive && cur !== "false") {
              card.setAttribute("data-active", "false");
            }
          }
        }
      }

      // 2. Team Section: Find closest team column or hero using cached geometry
      const teamCenters = teamCentersRef.current;
      if (teamCenters.length > 0) {
        if (!cachedTeamItems || cachedTeamItems.length === 0) {
          cachedTeamItems = Array.from(track.querySelectorAll<HTMLElement>(".gallery-team-item"));
        }

        let closestTeamIdx = 0;
        let minTeamDist = Infinity;
        for (let i = 0; i < teamCenters.length; i++) {
          const dist = Math.abs(tx + teamCenters[i] - screenCenter);
          if (dist < minTeamDist) {
            minTeamDist = dist;
            closestTeamIdx = i;
          }
        }

        if (closestTeamIdx !== activeTeamIdxRef.current && cachedTeamItems.length > 0) {
          activeTeamIdxRef.current = closestTeamIdx;
          for (let i = 0; i < cachedTeamItems.length; i++) {
            const item = cachedTeamItems[i];
            const isActive = i === closestTeamIdx;
            const cur = item.getAttribute("data-active");
            if (isActive && cur !== "true") {
              item.setAttribute("data-active", "true");
            } else if (!isActive && cur !== "false") {
              item.setAttribute("data-active", "false");
            }
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
