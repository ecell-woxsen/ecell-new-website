"use client";

import React, { useState } from "react";
import { ArrowRight, ArrowUpRight, CheckCircle2 } from "lucide-react";

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
  // Core Team ends ~1110. Transition corridor: 1110 -> 1225
  const progress = Math.min(1, Math.max(0, (currentFrame - 1110) / 115));
  
  // Overhead studio lighting intensity: soft, low-contrast, warm neutral white
  const lightIntensity = Math.min(1, Math.max(0.12, progress));
  
  // Luxury subtle motion: maximum 20px drift
  const revealY = (1 - progress) * 16;
  const sectionOpacity = Math.min(1, Math.max(0.35, 0.35 + progress * 0.65));

  return (
    <div
      className="relative shrink-0 flex flex-col justify-center w-[84vw] max-w-[1140px] select-none will-change-transform transition-all duration-300 ease-out py-6"
      style={{
        opacity: sectionOpacity,
        transform: `translate3d(0, ${revealY}px, 0)`,
      }}
    >
      {/* ========================================================================= */}
      {/* APPLE STUDIO OVERHEAD SOFT ILLUMINATION (NATURAL ARCHITECTURAL LIGHT)      */}
      {/* Layered, ultra-soft, low-contrast feathered falloff: zero visible edges    */}
      {/* ========================================================================= */}
      <div
        className="absolute -top-40 -left-20 w-[1200px] h-[850px] pointer-events-none blur-3xl rounded-full transition-opacity duration-500"
        style={{
          opacity: lightIntensity,
          background: `
            radial-gradient(ellipse at 45% 25%, rgba(255, 255, 255, 0.07) 0%, rgba(52, 211, 153, 0.025) 40%, rgba(5, 8, 14, 0.5) 68%, transparent 85%)
          `,
        }}
        aria-hidden="true"
      />

      {/* ========================================================================= */}
      {/* BALANCED 2-COLUMN EDITORIAL GRID (MATCHING ABOUT ARCHITECTURAL COMPOSITION)*/}
      {/* ========================================================================= */}
      <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-12 lg:gap-20 xl:gap-24 items-start">
        {/* ======================================================================= */}
        {/* LEFT COLUMN: Editorial Story & Contact Info on the Wall                 */}
        {/* ======================================================================= */}
        <div className="w-full max-w-[460px] text-left flex flex-col justify-start">
          {/* Eyebrow Label (Matching ABOUT) */}
          <div className="flex items-center gap-3 h-6 mb-4 sm:mb-5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]" />
            <span className="font-mono text-[11px] sm:text-xs font-semibold tracking-[0.22em] uppercase text-emerald-400 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
              03 — GET IN TOUCH
            </span>
            <span className="h-px w-8 bg-white/25" />
          </div>

          {/* Monumental Editorial Headline (Scale harmonious with ABOUT) */}
          <h2 className="font-display text-5xl sm:text-6xl lg:text-7xl xl:text-[76px] text-slate-50 tracking-[-0.01em] uppercase leading-[0.90] mb-4 drop-shadow-[0_4px_24px_rgba(0,0,0,0.98)]">
            CONNECT<br />WITH US
          </h2>

          {/* Narrative Statement */}
          <p className="text-[14px] sm:text-[15px] lg:text-[16px] text-slate-100/90 font-normal leading-[1.7] mb-7 max-w-[420px] drop-shadow-[0_2px_10px_rgba(0,0,0,0.95)]">
            Ideas, partnerships, and ambitious ventures start with a conversation.
          </p>

          {/* Contact Details (Thin subtle horizontal rules) */}
          <div className="space-y-3.5 max-w-[420px]">
            {/* Email */}
            <div className="pb-3 border-b border-white/15">
              <span className="block font-mono text-[10px] sm:text-[11px] font-medium tracking-[0.2em] text-emerald-400 uppercase mb-1 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
                EMAIL US
              </span>
              <a
                href="mailto:ecell@woxsen.edu.in"
                className="font-display text-lg sm:text-xl text-white hover:text-emerald-300 transition-colors uppercase tracking-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)]"
              >
                ecell@woxsen.edu.in
              </a>
            </div>

            {/* Call Office */}
            <div className="pb-3 border-b border-white/15">
              <span className="block font-mono text-[10px] sm:text-[11px] font-medium tracking-[0.2em] text-emerald-400 uppercase mb-1 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
                CALL OFFICE
              </span>
              <a
                href="tel:+918008627493"
                className="font-display text-lg sm:text-xl text-white hover:text-teal-300 transition-colors tracking-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)] block"
              >
                +91 80086 27493
              </a>
              <p className="font-mono text-xs text-slate-300/80 mt-0.5 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
                Mon–Fri · 10 AM – 5 PM IST
              </p>
            </div>

            {/* Campus */}
            <div className="pb-3 border-b border-white/15">
              <span className="block font-mono text-[10px] sm:text-[11px] font-medium tracking-[0.2em] text-emerald-400 uppercase mb-1 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
                CAMPUS
              </span>
              <p className="font-display text-base sm:text-lg text-white uppercase tracking-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)]">
                Woxsen University Campus
              </p>
              <p className="text-xs sm:text-[13px] text-slate-300/80 mt-0.5 leading-relaxed drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
                Sadashivpet, Hyderabad
              </p>
            </div>

            {/* Social Links */}
            <div className="pt-2">
              <span className="block font-mono text-[10px] sm:text-[11px] font-medium tracking-[0.2em] text-slate-400 uppercase mb-2">
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
        {/* RIGHT COLUMN: Minimal Form Integrated Directly into the Architecture   */}
        {/* ======================================================================= */}
        <div className="w-full max-w-[440px] md:ml-auto flex flex-col justify-start">
          {/* Upper Right Metadata (Aligned with Eyebrow) */}
          <div className="flex items-center justify-end h-6 mb-4 sm:mb-5">
            <span className="font-mono text-[10px] sm:text-[11px] tracking-[0.22em] uppercase text-slate-400 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
              <span className="text-emerald-400 font-semibold">HYDERABAD</span> · INDIA
            </span>
          </div>

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
            <form onSubmit={handleSend} className="space-y-5 pt-2">
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
                  className="w-full bg-transparent text-sm sm:text-base text-slate-100 placeholder-slate-400/70 focus:outline-none transition-colors drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]"
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
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-transparent text-sm sm:text-base text-slate-100 placeholder-slate-400/70 focus:outline-none transition-colors drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]"
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
                  className="w-full bg-transparent text-sm sm:text-base text-slate-100 placeholder-slate-400/70 focus:outline-none transition-colors resize-none drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]"
                />
              </div>

              {/* Submit Action */}
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold font-mono text-xs uppercase tracking-[0.18em] flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-emerald-500/20 active:scale-[0.98]"
                >
                  <span>SEND NOTE</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
