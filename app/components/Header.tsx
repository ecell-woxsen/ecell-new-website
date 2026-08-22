"use client";

import React, { useState } from "react";
import Image from "next/image";
import { ArrowRight, Menu, X } from "lucide-react";

interface HeaderProps {
  onNavigateToFrame: (targetFrame: number) => void;
  onOpenJoinModal: () => void;
  currentFrame: number;
}

function Header({
  onNavigateToFrame,
  onOpenJoinModal,
  currentFrame,
}: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { label: "ABOUT", frame: 378, active: currentFrame >= 365 && currentFrame < 450 },
    { label: "EVENTS", frame: 680, active: currentFrame >= 603 && currentFrame < 840 },
    { label: "TEAM", frame: 940, active: currentFrame >= 840 && currentFrame < 1090 },
    { label: "COMMUNITY", frame: 1180, active: currentFrame >= 1090 },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 px-4 sm:px-8 pt-4 sm:pt-6 transition-all duration-500 pointer-events-none">
      <div className="max-w-7xl mx-auto flex items-center justify-center pointer-events-auto">
        {/* Center Floating Pill Navbar */}
        <nav className="flex items-center gap-1.5 sm:gap-3 bg-black/70 border border-white/15 backdrop-blur-2xl px-2 sm:px-3 py-1.5 rounded-full shadow-2xl shadow-black/80">
          {/* Logo Badge */}
          <button
            onClick={() => onNavigateToFrame(1)}
            className="flex items-center gap-2 pr-1 group cursor-pointer"
            title="Return to Home"
          >
            <div className="relative w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-slate-900/90 border border-white/15 p-1 flex items-center justify-center overflow-hidden">
              <Image
                src="/ecell-logo.png"
                alt="E-Cell Logo"
                width={28}
                height={28}
                className="object-contain"
                priority
              />
            </div>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          </button>

          <div className="h-4 w-px bg-white/15 hidden sm:block" />

          {/* Desktop Nav Items */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <button
                key={item.label}
                onClick={() => onNavigateToFrame(item.frame)}
                className={`px-3 py-1 rounded-full text-xs font-mono font-medium tracking-wider uppercase transition-all duration-200 cursor-pointer ${
                  item.active
                    ? "text-emerald-400 bg-white/10"
                    : "text-slate-300 hover:text-white hover:bg-white/5"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Submit Idea Action Button */}
          <button
            onClick={onOpenJoinModal}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-mono font-bold tracking-wider uppercase bg-[#16a34a] hover:bg-[#22c55e] text-white shadow-md transition-all hover:scale-105 active:scale-95 cursor-pointer ml-1"
          >
            <span>SUBMIT IDEA</span>
            <ArrowRight className="w-3 h-3" />
          </button>

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-1.5 rounded-full text-slate-300 hover:text-white"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </nav>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden mt-3 p-4 rounded-2xl bg-slate-950/95 border border-white/15 backdrop-blur-2xl shadow-2xl flex flex-col gap-2 pointer-events-auto animate-in fade-in slide-in-from-top-4 duration-200 max-w-sm mx-auto">
          {navItems.map((item) => (
            <button
              key={item.label}
              onClick={() => {
                onNavigateToFrame(item.frame);
                setMobileMenuOpen(false);
              }}
              className={`text-left px-4 py-2.5 rounded-xl text-xs font-mono font-semibold tracking-wider uppercase transition-all ${
                item.active
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  : "text-slate-300 hover:bg-white/5"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </header>
  );
}

export default React.memo(Header, (prevProps, nextProps) => {
  const prevActiveAbout = prevProps.currentFrame >= 365 && prevProps.currentFrame < 450;
  const nextActiveAbout = nextProps.currentFrame >= 365 && nextProps.currentFrame < 450;

  const prevActiveEvents = prevProps.currentFrame >= 603 && prevProps.currentFrame < 840;
  const nextActiveEvents = nextProps.currentFrame >= 603 && nextProps.currentFrame < 840;

  const prevActiveTeam = prevProps.currentFrame >= 840 && prevProps.currentFrame < 1090;
  const nextActiveTeam = nextProps.currentFrame >= 840 && nextProps.currentFrame < 1090;

  const prevActiveCommunity = prevProps.currentFrame >= 1090;
  const nextActiveCommunity = nextProps.currentFrame >= 1090;

  return (
    prevActiveAbout === nextActiveAbout &&
    prevActiveEvents === nextActiveEvents &&
    prevActiveTeam === nextActiveTeam &&
    prevActiveCommunity === nextActiveCommunity
  );
});
