"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { Sparkles, Menu, X, ArrowUpRight } from "lucide-react";

interface HeaderProps {
  onNavigateToFrame: (targetFrame: number) => void;
  onOpenJoinModal: () => void;
  currentFrame: number;
}

export default function Header({
  onNavigateToFrame,
  onOpenJoinModal,
  currentFrame,
}: HeaderProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setIsScrolled(currentFrame > 20);
  }, [currentFrame]);

  const navItems = [
    { label: "Campus Entry", frame: 1, active: currentFrame < 365 },
    { label: "About E-Cell", frame: 378, active: currentFrame >= 365 && currentFrame < 430 },
    { label: "Events", frame: 630, active: currentFrame >= 590 && currentFrame < 690 },
    { label: "Core Team", frame: 715, active: currentFrame >= 690 && currentFrame < 775 },
    { label: "Contact", frame: 795, active: currentFrame >= 775 },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 px-4 sm:px-8 pt-4 sm:pt-6 transition-all duration-500 pointer-events-none">
      <div className="max-w-7xl mx-auto flex items-center justify-between pointer-events-auto">
        {/* Logo & Brand */}
        <button
          onClick={() => onNavigateToFrame(1)}
          className="flex items-center gap-3 group text-left transition-transform hover:scale-[1.02]"
        >
          <div className="relative w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-slate-900/80 border border-white/15 p-1.5 backdrop-blur-md shadow-lg shadow-black/40 overflow-hidden flex items-center justify-center">
            <Image
              src="/ecell-logo.png"
              alt="E-Cell Woxsen Logo"
              width={40}
              height={40}
              className="object-contain"
              priority
            />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-heading font-bold text-sm sm:text-base tracking-wider text-white">
                E-CELL
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono font-medium border border-emerald-500/30">
                WOXSEN
              </span>
            </div>
            <p className="text-[10px] text-slate-400 tracking-tight hidden sm:block">
              Where Innovation Meets Initiative
            </p>
          </div>
        </button>

        {/* Floating Nav Pill (Desktop) */}
        <nav className="hidden md:flex items-center gap-1 bg-slate-950/70 border border-white/10 backdrop-blur-xl px-2 py-1.5 rounded-full shadow-2xl shadow-black/60">
          {navItems.map((item) => (
            <button
              key={item.label}
              onClick={() => onNavigateToFrame(item.frame)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-300 ${
                item.active
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm shadow-emerald-500/20"
                  : "text-slate-300 hover:text-white hover:bg-white/5"
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* Action Button & Mobile Menu Toggle */}
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenJoinModal}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-xs sm:text-sm font-medium bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-semibold shadow-lg shadow-emerald-500/25 transition-all hover:scale-105 active:scale-95 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-slate-950" />
            <span>Join E-Cell</span>
            <ArrowUpRight className="w-3.5 h-3.5 opacity-80" />
          </button>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-full bg-slate-900/80 border border-white/15 text-slate-300 hover:text-white backdrop-blur-md"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden mt-3 p-4 rounded-2xl bg-slate-950/95 border border-white/15 backdrop-blur-2xl shadow-2xl flex flex-col gap-2 pointer-events-auto animate-in fade-in slide-in-from-top-4 duration-200">
          {navItems.map((item) => (
            <button
              key={item.label}
              onClick={() => {
                onNavigateToFrame(item.frame);
                setMobileMenuOpen(false);
              }}
              className={`text-left px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
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
