"use client";

import React, { useState, useCallback } from "react";
import ScrollytellingEngine from "./components/ScrollytellingEngine";
import Header from "./components/Header";
import AudioController from "./components/ui/AudioController";
import ScrollProgressHUD from "./components/ui/ScrollProgressHUD";
import JoinApplyModal from "./components/modals/JoinApplyModal";

export default function Home() {
  const [currentFrame, setCurrentFrame] = useState(1);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [targetNavigationFrame, setTargetNavigationFrame] = useState<number | null>(null);

  const handleFrameUpdate = useCallback((frame: number) => {
    setCurrentFrame(frame);
  }, []);

  const handleNavigateToFrame = (targetFrame: number) => {
    setTargetNavigationFrame(targetFrame);
  };

  const handleNavigationComplete = () => {
    setTargetNavigationFrame(null);
  };

  return (
    <main className="fixed inset-0 w-screen h-screen overflow-hidden bg-[#040608] text-slate-100 selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* Floating Header */}
      <Header
        currentFrame={currentFrame}
        onNavigateToFrame={handleNavigateToFrame}
        onOpenJoinModal={() => setIsJoinModalOpen(true)}
      />

      {/* Main Scrollytelling Engine with Y-axis Virtual Scroll Lock */}
      <ScrollytellingEngine
        onFrameUpdate={handleFrameUpdate}
        onOpenJoinModal={() => setIsJoinModalOpen(true)}
        targetNavigationFrame={targetNavigationFrame}
        onNavigationComplete={handleNavigationComplete}
      />

      {/* Ambient Audio Controller */}
      <AudioController />

      {/* Chapter & Progress HUD */}
      <ScrollProgressHUD
        currentFrame={currentFrame}
        totalFrames={1041}
      />

      {/* Application / Ideas Modal */}
      <JoinApplyModal
        isOpen={isJoinModalOpen}
        onClose={() => setIsJoinModalOpen(false)}
      />
    </main>
  );
}
