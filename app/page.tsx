"use client";

import React, { useState, useCallback } from "react";
import ScrollytellingEngine from "./components/ScrollytellingEngine";
import Header from "./components/Header";
import JoinApplyModal from "./components/modals/JoinApplyModal";

export default function Home() {
  const [currentFrame, setCurrentFrame] = useState(1);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [targetNavigationFrame, setTargetNavigationFrame] = useState<number | null>(null);

  const handleFrameUpdate = useCallback((frame: number) => {
    setCurrentFrame(frame);
  }, []);

  const handleNavigateToFrame = useCallback((targetFrame: number) => {
    setTargetNavigationFrame(targetFrame);
  }, []);

  const handleNavigationComplete = useCallback(() => {
    setTargetNavigationFrame(null);
  }, []);

  const handleOpenJoinModal = useCallback(() => {
    setIsJoinModalOpen(true);
  }, []);

  const handleCloseJoinModal = useCallback(() => {
    setIsJoinModalOpen(false);
  }, []);

  return (
    <main className="relative bg-[#040608] text-slate-100 selection:bg-emerald-500/30 selection:text-emerald-200 min-h-screen">
      {/* Floating Header */}
      <Header
        currentFrame={currentFrame}
        onNavigateToFrame={handleNavigateToFrame}
        onOpenJoinModal={handleOpenJoinModal}
      />

      {/* Main Scrollytelling Engine with Lenis Smooth Scroll */}
      <ScrollytellingEngine
        onFrameUpdate={handleFrameUpdate}
        onOpenJoinModal={handleOpenJoinModal}
        targetNavigationFrame={targetNavigationFrame}
        onNavigationComplete={handleNavigationComplete}
        isJoinModalOpen={isJoinModalOpen}
      />

      {/* Application / Ideas Modal */}
      <JoinApplyModal
        isOpen={isJoinModalOpen}
        onClose={handleCloseJoinModal}
      />
    </main>
  );
}
