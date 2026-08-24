"use client";

import React, { useState } from "react";
import { Send, CheckCircle2, ArrowRight, ArrowUpRight } from "lucide-react";

export default function ContactWallSection() {
  const [sent, setSent] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    setSent(true);
  };

  return (
    <div className="relative shrink-0 flex flex-col justify-center w-[90vw] sm:w-[740px] md:w-[860px] lg:w-[980px] xl:w-[1040px] select-none">
      {/* ========================================================================= */}
      {/* CINEMATIC LOCALIZED CONTRAST GRADING & APPLE STUDIO LIGHTING               */}
      {/* Seamless ambient exposure lift behind content: zero card/box boundaries   */}
      {/* ========================================================================= */}
      <div
        className="absolute -top-32 -left-24 w-[1100px] h-[800px] pointer-events-none blur-3xl rounded-full"
        style={{
          background: `
            radial-gradient(ellipse at 35% 30%, rgba(255, 255, 255, 0.05) 0%, rgba(5, 8, 14, 0.45) 45%, transparent 75%)
          `,
        }}
        aria-hidden="true"
      />

      {/* ========================================================================= */}
      {/* LEVEL 1 & 2: SECTION HEADING (Directly on the Architectural Wall)         */}
      {/* ========================================================================= */}
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8 sm:mb-10 pb-4 border-b border-white/10">
        <div>
          {/* Small Section Label */}
          <div className="flex items-center gap-3 h-6 mb-3 sm:mb-4">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]" />
            <span className="font-mono text-[11px] sm:text-xs font-semibold tracking-[0.25em] uppercase text-emerald-400 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
              GET IN TOUCH
            </span>
            <span className="h-px w-8 bg-white/20" />
          </div>

          {/* Monumental Editorial Title */}
          <h2 className="font-display text-4xl sm:text-5xl lg:text-6xl text-slate-50 tracking-[-0.01em] uppercase leading-[0.90] drop-shadow-[0_4px_24px_rgba(0,0,0,0.98)]">
            CONNECT<br />WITH US
          </h2>
        </div>

        {/* Editorial Location Metadata */}
        <div className="flex items-center gap-2 font-mono text-[10px] sm:text-[11px] tracking-[0.22em] uppercase text-slate-400 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
          <span className="text-emerald-400 font-semibold">HYDERABAD</span>
          <span>·</span>
          <span>INDIA</span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MAIN COMPOSITION: [LEFT EDITORIAL INFO] | [RIGHT MINIMAL FORM]             */}
      {/* ========================================================================= */}
      <div className="relative z-10 grid grid-cols-1 md:grid-cols-[1.1fr_1fr] gap-8 lg:gap-14 items-start">
        {/* ======================================================================= */}
        {/* LEFT COLUMN: Editorial Contact Information Printed on the Wall          */}
        {/* ======================================================================= */}
        <div className="flex flex-col justify-between space-y-6">
          {/* Item 1: Email */}
          <div className="pb-4 border-b border-white/10">
            <span className="font-mono text-[10px] sm:text-[11px] font-semibold tracking-[0.2em] uppercase text-emerald-400/90 block mb-1">
              EMAIL US
            </span>
            <a
              href="mailto:ecell@woxsen.edu.in"
              className="font-display text-lg sm:text-xl text-slate-100 hover:text-emerald-300 transition-colors uppercase tracking-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)]"
            >
              ecell@woxsen.edu.in
            </a>
          </div>

          {/* Item 2: Call Office */}
          <div className="pb-4 border-b border-white/10">
            <span className="font-mono text-[10px] sm:text-[11px] font-semibold tracking-[0.2em] uppercase text-emerald-400/90 block mb-1">
              CALL OFFICE
            </span>
            <a
              href="tel:+918008627493"
              className="font-display text-lg sm:text-xl text-slate-100 hover:text-teal-300 transition-colors tracking-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)] block"
            >
              +91 80086 27493
            </a>
            <p className="font-mono text-[11px] sm:text-xs text-slate-400 mt-0.5">
              Mon – Fri, 10 AM – 5 PM IST
            </p>
          </div>

          {/* Item 3: Campus Location */}
          <div className="pb-4 border-b border-white/10">
            <span className="font-mono text-[10px] sm:text-[11px] font-semibold tracking-[0.2em] uppercase text-emerald-400/90 block mb-1">
              CAMPUS LOCATION
            </span>
            <p className="font-display text-base sm:text-lg text-slate-100 uppercase tracking-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)]">
              Woxsen University Campus
            </p>
            <p className="text-xs sm:text-[13px] text-slate-400 mt-0.5 leading-relaxed">
              Sadashivpet, Hyderabad, Telangana 502345
            </p>
          </div>

          {/* Item 4: Subtle Editorial Social Links */}
          <div className="pt-2">
            <span className="font-mono text-[10px] sm:text-[11px] font-semibold tracking-[0.2em] uppercase text-slate-400 block mb-2.5">
              FOLLOW OUR JOURNEY →
            </span>
            <div className="flex items-center gap-4 text-xs font-mono">
              <a
                href="https://www.linkedin.com/school/woxsen-university/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-300 hover:text-emerald-400 transition-colors flex items-center gap-1 group"
              >
                <span>LinkedIn</span>
                <ArrowUpRight className="w-3 h-3 opacity-60 group-hover:opacity-100 transition-opacity" />
              </a>
              <span className="text-white/20">·</span>
              <a
                href="https://instagram.com/ecell_wou"
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-300 hover:text-pink-400 transition-colors flex items-center gap-1 group"
              >
                <span>Instagram</span>
                <ArrowUpRight className="w-3 h-3 opacity-60 group-hover:opacity-100 transition-opacity" />
              </a>
              <span className="text-white/20">·</span>
              <a
                href="https://woxsen.edu.in/ecell"
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-300 hover:text-white transition-colors flex items-center gap-1 group"
              >
                <span>Woxsen</span>
                <ArrowUpRight className="w-3 h-3 opacity-60 group-hover:opacity-100 transition-opacity" />
              </a>
            </div>
          </div>
        </div>

        {/* ======================================================================= */}
        {/* RIGHT COLUMN: Minimal Interactive Form Integrated into Architecture     */}
        {/* ======================================================================= */}
        <div className="relative p-6 sm:p-7 rounded-2xl bg-black/35 backdrop-blur-md border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.85)]">
          {sent ? (
            <div className="h-full min-h-[260px] flex flex-col items-center justify-center text-center p-4 select-none">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mb-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              </div>
              <h3 className="font-display text-xl text-white uppercase tracking-tight">
                Message Sent
              </h3>
              <p className="text-xs text-slate-300 mt-1 max-w-[240px] leading-relaxed">
                Thank you for reaching out. We will connect with you shortly.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSend} className="space-y-3.5">
              <div>
                <label className="block font-mono text-[10px] tracking-wider uppercase text-slate-400 mb-1.5">
                  Your Name
                </label>
                <input
                  required
                  type="text"
                  placeholder="Enter your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/10 focus:border-emerald-400/50 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none transition-all"
                />
              </div>

              <div>
                <label className="block font-mono text-[10px] tracking-wider uppercase text-slate-400 mb-1.5">
                  Your Email
                </label>
                <input
                  required
                  type="email"
                  placeholder="Enter your email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/10 focus:border-emerald-400/50 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none transition-all"
                />
              </div>

              <div>
                <label className="block font-mono text-[10px] tracking-wider uppercase text-slate-400 mb-1.5">
                  Message
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Tell us about your inquiry or startup idea..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/10 focus:border-emerald-400/50 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none transition-all resize-none"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold font-mono text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-emerald-500/20 active:scale-[0.99]"
              >
                <span>Send Note</span>
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
