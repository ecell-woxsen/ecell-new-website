"use client";

import React, { useState } from "react";
import { Send, CheckCircle2, ArrowRight, ArrowUpRight } from "lucide-react";

interface ContactWallSectionProps {
  currentFrame?: number;
}

export default function ContactWallSection({
  currentFrame = 1235,
}: ContactWallSectionProps) {
  const [sent, setSent] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    setSent(true);
  };

  // Scroll-driven lighting & reveal interpolation
  // Core Team ends ~1120. Transition corridor: 1120 -> 1235
  const progress = Math.min(1, Math.max(0, (currentFrame - 1110) / 115)); // 0 at 1110, 1 at 1225+
  
  // Spotlight intensity ramps up from 0 to 1 as user enters the final illuminated room
  const lightIntensity = Math.min(1, Math.max(0.1, progress));
  
  // Staggered sequential reveal offsets
  const headTranslateX = (1 - Math.min(1, Math.max(0, (currentFrame - 1110) / 80))) * 45;
  const headOpacity = Math.min(1, Math.max(0.3, progress));

  const infoTranslateX = (1 - Math.min(1, Math.max(0, (currentFrame - 1130) / 80))) * 35;
  const infoOpacity = Math.min(1, Math.max(0.2, (currentFrame - 1125) / 90));

  const formTranslateX = (1 - Math.min(1, Math.max(0, (currentFrame - 1145) / 80))) * 25;
  const formOpacity = Math.min(1, Math.max(0.15, (currentFrame - 1140) / 90));

  return (
    <div className="relative shrink-0 flex flex-col justify-center w-[92vw] sm:w-[840px] md:w-[980px] lg:w-[1140px] xl:w-[1240px] select-none">
      {/* ========================================================================= */}
      {/* 1. APPLE STUDIO OVERHEAD SOFTBOX ILLUMINATION (FINAL ILLUMINATED ROOM)    */}
      {/* Layered, ultra-diffused overhead spotlight falling naturally on the wall   */}
      {/* Zero visible circles, zero bubbles, zero hard gradient edges              */}
      {/* ========================================================================= */}
      <div
        className="absolute -top-56 -left-36 w-[1300px] h-[1000px] pointer-events-none blur-3xl rounded-full transition-opacity duration-500"
        style={{
          opacity: lightIntensity,
          background: `
            radial-gradient(ellipse at 40% 25%, rgba(255, 255, 255, 0.085) 0%, rgba(52, 211, 153, 0.04) 38%, rgba(5, 8, 14, 0.6) 65%, transparent 85%)
          `,
        }}
        aria-hidden="true"
      />

      {/* Secondary Soft Fill Light behind Form */}
      <div
        className="absolute -bottom-28 right-0 w-[850px] h-[650px] pointer-events-none blur-3xl rounded-full transition-opacity duration-500"
        style={{
          opacity: lightIntensity * 0.8,
          background: `radial-gradient(ellipse at 65% 75%, rgba(52, 211, 153, 0.035) 0%, transparent 70%)`,
        }}
        aria-hidden="true"
      />

      {/* ========================================================================= */}
      {/* TOP ZONE: SECTION EYEBROW & UPPER-RIGHT HYDERABAD METADATA                */}
      {/* ========================================================================= */}
      <div
        className="relative z-10 flex items-center justify-between gap-4 mb-6 sm:mb-8 pb-4 border-b border-white/15 will-change-transform transition-all duration-300 ease-out"
        style={{
          opacity: headOpacity,
          transform: `translate3d(${headTranslateX}px, 0, 0)`,
        }}
      >
        {/* Eyebrow Label */}
        <div className="flex items-center gap-3 h-6">
          <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
          <span className="font-mono text-[11px] sm:text-xs font-semibold tracking-[0.25em] uppercase text-emerald-400 drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]">
            03 — GET IN TOUCH
          </span>
          <span className="h-px w-8 bg-white/25" />
        </div>

        {/* Minimalist Upper-Right Metadata (No Badge) */}
        <div className="flex items-center gap-2 font-mono text-[10px] sm:text-[11px] tracking-[0.22em] uppercase text-slate-400 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
          <span className="text-emerald-400 font-semibold">HYDERABAD</span>
          <span>·</span>
          <span>INDIA</span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MAIN ARCHITECTURAL COMPOSITION: [LEFT EDITORIAL] | [RIGHT MINIMAL FORM]   */}
      {/* ========================================================================= */}
      <div className="relative z-10 grid grid-cols-1 md:grid-cols-[1.15fr_0.95fr] lg:grid-cols-[1.2fr_0.9fr] gap-10 lg:gap-16 xl:gap-20 items-start">
        {/* ======================================================================= */}
        {/* LEFT COLUMN: Monumental Typography & Editorial Contact Info on the Wall */}
        {/* ======================================================================= */}
        <div
          className="flex flex-col justify-start text-left will-change-transform transition-all duration-300 ease-out"
          style={{
            opacity: headOpacity,
            transform: `translate3d(${headTranslateX}px, 0, 0)`,
          }}
        >
          {/* Monumental Headline (Matching ABOUT scale) */}
          <h2 className="font-display text-5xl sm:text-6xl md:text-7xl lg:text-8xl xl:text-9xl text-slate-50 tracking-[-0.01em] uppercase leading-[0.85] mb-4 drop-shadow-[0_4px_32px_rgba(0,0,0,0.98)]">
            CONNECT<br />WITH US
          </h2>

          {/* Short Narrative Statement */}
          <p className="text-[15px] sm:text-[16px] lg:text-[17px] text-slate-200/90 font-normal leading-[1.65] max-w-[420px] mb-8 drop-shadow-[0_2px_10px_rgba(0,0,0,0.95)]">
            Ideas, partnerships, and ambitious ventures start with a conversation.
          </p>

          {/* Editorial Contact Blocks (Separated by clean horizontal lines) */}
          <div
            className="space-y-4 max-w-[440px] will-change-transform transition-all duration-300 ease-out"
            style={{
              opacity: infoOpacity,
              transform: `translate3d(${infoTranslateX}px, 0, 0)`,
            }}
          >
            {/* Block 1: Email */}
            <div className="pb-3.5 border-b border-white/15">
              <span className="font-mono text-[10px] sm:text-[11px] font-semibold tracking-[0.22em] uppercase text-emerald-400 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] block mb-1">
                EMAIL US
              </span>
              <a
                href="mailto:ecell@woxsen.edu.in"
                className="font-display text-lg sm:text-xl lg:text-2xl text-slate-50 hover:text-emerald-300 transition-colors uppercase tracking-tight drop-shadow-[0_2px_10px_rgba(0,0,0,0.98)]"
              >
                ecell@woxsen.edu.in
              </a>
            </div>

            {/* Block 2: Call Office */}
            <div className="pb-3.5 border-b border-white/15">
              <span className="font-mono text-[10px] sm:text-[11px] font-semibold tracking-[0.22em] uppercase text-emerald-400 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] block mb-1">
                CALL OFFICE
              </span>
              <a
                href="tel:+918008627493"
                className="font-display text-lg sm:text-xl lg:text-2xl text-slate-50 hover:text-teal-300 transition-colors tracking-tight drop-shadow-[0_2px_10px_rgba(0,0,0,0.98)] block"
              >
                +91 80086 27493
              </a>
              <p className="font-mono text-[11px] sm:text-xs text-slate-300/90 mt-0.5 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
                Mon–Fri · 10 AM – 5 PM IST
              </p>
            </div>

            {/* Block 3: Campus Location */}
            <div className="pb-3.5 border-b border-white/15">
              <span className="font-mono text-[10px] sm:text-[11px] font-semibold tracking-[0.22em] uppercase text-emerald-400 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] block mb-1">
                CAMPUS LOCATION
              </span>
              <p className="font-display text-base sm:text-lg lg:text-xl text-slate-50 uppercase tracking-tight drop-shadow-[0_2px_10px_rgba(0,0,0,0.98)]">
                Woxsen University Campus
              </p>
              <p className="text-xs sm:text-[13px] text-slate-300/90 mt-0.5 leading-relaxed drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
                Sadashivpet, Hyderabad, Telangana 502345
              </p>
            </div>

            {/* Block 4: Subtle Editorial Social Links (Zero pills/cards) */}
            <div className="pt-2">
              <span className="font-mono text-[10px] sm:text-[11px] font-semibold tracking-[0.22em] uppercase text-slate-400 block mb-2">
                FOLLOW OUR JOURNEY →
              </span>
              <div className="flex items-center gap-4 text-xs font-mono">
                <a
                  href="https://www.linkedin.com/school/woxsen-university/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-300 hover:text-emerald-400 transition-colors flex items-center gap-1 group drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]"
                >
                  <span>LinkedIn</span>
                  <ArrowUpRight className="w-3 h-3 opacity-60 group-hover:opacity-100 transition-opacity" />
                </a>
                <span className="text-white/20">·</span>
                <a
                  href="https://instagram.com/ecell_wou"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-300 hover:text-pink-400 transition-colors flex items-center gap-1 group drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]"
                >
                  <span>Instagram</span>
                  <ArrowUpRight className="w-3 h-3 opacity-60 group-hover:opacity-100 transition-opacity" />
                </a>
                <span className="text-white/20">·</span>
                <a
                  href="https://woxsen.edu.in/ecell"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-300 hover:text-white transition-colors flex items-center gap-1 group drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]"
                >
                  <span>Woxsen</span>
                  <ArrowUpRight className="w-3 h-3 opacity-60 group-hover:opacity-100 transition-opacity" />
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* ======================================================================= */}
        {/* RIGHT COLUMN: Minimal Form Integrated Directly into Wall (NO CARD BOX)  */}
        {/* Asymmetrical placement: slightly offset lower/right                     */}
        {/* ======================================================================= */}
        <div
          className="relative pt-2 sm:pt-6 md:pt-10 will-change-transform transition-all duration-300 ease-out"
          style={{
            opacity: formOpacity,
            transform: `translate3d(${formTranslateX}px, 0, 0)`,
          }}
        >
          {sent ? (
            <div className="h-full min-h-[300px] flex flex-col items-start justify-center text-left py-6 select-none">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mb-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              </div>
              <h3 className="font-display text-2xl sm:text-3xl text-white uppercase tracking-tight drop-shadow-[0_2px_10px_rgba(0,0,0,0.98)]">
                Message Sent
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 mt-1.5 max-w-[280px] leading-relaxed drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]">
                Thank you for reaching out. The leadership team will connect with you shortly.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSend} className="space-y-6">
              {/* Field 1: Name */}
              <div className="border-b border-white/20 pb-2 focus-within:border-emerald-400 transition-colors">
                <label className="block font-mono text-[10px] tracking-[0.2em] uppercase text-emerald-400 font-semibold mb-1 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
                  YOUR NAME
                </label>
                <input
                  required
                  type="text"
                  placeholder="Enter your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-transparent text-sm sm:text-base text-slate-100 placeholder-slate-400/80 focus:outline-none transition-colors drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]"
                />
              </div>

              {/* Field 2: Email */}
              <div className="border-b border-white/20 pb-2 focus-within:border-emerald-400 transition-colors">
                <label className="block font-mono text-[10px] tracking-[0.2em] uppercase text-emerald-400 font-semibold mb-1 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
                  YOUR EMAIL
                </label>
                <input
                  required
                  type="email"
                  placeholder="Enter your email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-transparent text-sm sm:text-base text-slate-100 placeholder-slate-400/80 focus:outline-none transition-colors drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]"
                />
              </div>

              {/* Field 3: Message */}
              <div className="border-b border-white/20 pb-2 focus-within:border-emerald-400 transition-colors">
                <label className="block font-mono text-[10px] tracking-[0.2em] uppercase text-emerald-400 font-semibold mb-1 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
                  MESSAGE
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Tell us about your inquiry or startup idea..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full bg-transparent text-sm sm:text-base text-slate-100 placeholder-slate-400/80 focus:outline-none transition-colors resize-none drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                className="w-full py-3.5 mt-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold font-mono text-xs uppercase tracking-[0.15em] flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-emerald-500/20 active:scale-[0.99]"
              >
                <span>SEND NOTE</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
