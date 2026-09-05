"use client";

import React, { useState } from "react";
import { ArrowRight, ArrowUpRight, CheckCircle2, Loader2 } from "lucide-react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

interface ContactWallSectionProps {
  currentFrame?: number;
}

export default function ContactWallSection({
  currentFrame = 1260,
}: ContactWallSectionProps) {
  const submitContact = useMutation(api.contacts.submit);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [honeypot, setHoneypot] = useState("");

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    // Silent honeypot check: if bot filled this hidden field, fake success
    if (honeypot) {
      setSent(true);
      return;
    }

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedMessage = message.trim();

    if (trimmedName.length < 2) {
      setErrorMsg("Please enter your name (at least 2 characters).");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setErrorMsg("Please enter a valid email address.");
      return;
    }

    if (trimmedMessage.length < 5) {
      setErrorMsg("Please enter a message (at least 5 characters).");
      return;
    }

    setErrorMsg(null);
    setSubmitting(true);
    try {
      await submitContact({
        name: trimmedName,
        email: trimmedEmail,
        message: trimmedMessage,
        source: "website_contact_wall",
      });
      setSent(true);
      setName("");
      setEmail("");
      setMessage("");
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to send message. Please try again.";
      setErrorMsg(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const isEndReached = currentFrame >= 1200;

  return (
    <div
      className="gallery-contact-section relative shrink-0 flex flex-col justify-center w-[85vw] max-w-[1200px] py-6"
      data-active={isEndReached ? "true" : "false"}
      style={{
        contain: "layout style",
      }}
    >
      {/* ========================================================================= */}
      {/* 1. CINEMATIC LOCALIZED CONTRAST GRADING & STUDIO SOFTBOX LIGHTING          */}
      {/* High WCAG contrast behind text & form, maintaining concrete wall visibility*/}
      {/* ========================================================================= */}
      <div
        className="contact-softbox absolute -inset-10 pointer-events-none rounded-3xl"
        style={{
          background: `
            radial-gradient(ellipse at 20% 50%, rgba(3, 6, 10, 0.85) 0%, rgba(3, 6, 10, 0.55) 50%, transparent 80%),
            radial-gradient(ellipse at 80% 50%, rgba(3, 6, 10, 0.85) 0%, rgba(3, 6, 10, 0.55) 50%, transparent 80%),
            radial-gradient(ellipse at 50% 20%, rgba(255, 255, 255, 0.08) 0%, rgba(52, 211, 153, 0.03) 40%, transparent 75%)
          `,
        }}
        aria-hidden="true"
      />

      {/* ========================================================================= */}
      {/* 2. TOP HEADER ROW: [EYEBROW] <------------------------> [HYDERABAD METADATA] */}
      {/* ========================================================================= */}
      <div className="relative z-10 flex items-center justify-between gap-4 mb-6 pb-4 border-b border-white/20">
        {/* Eyebrow Label (Exact match to ABOUT) */}
        <div className="flex items-center gap-3 h-6">
          <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]" />
          <span className="font-mono text-[11px] sm:text-xs font-semibold tracking-[0.22em] uppercase text-emerald-400 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
            03 — GET IN TOUCH
          </span>
          <span className="h-px w-8 bg-white/25" />
        </div>

        {/* Minimalist Upper-Right Metadata */}
        <div className="flex items-center gap-2 font-mono text-[11px] tracking-[0.22em] uppercase text-slate-300 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
          <span className="text-emerald-400 font-semibold">HYDERABAD</span>
          <span className="text-white/40">·</span>
          <span>INDIA</span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. BALANCED 2-COLUMN EDITORIAL GRID (EXACT HARMONY WITH ABOUT SECTION)     */}
      {/* ========================================================================= */}
      <div className="relative z-10 grid grid-cols-1 md:grid-cols-[1.1fr_1fr] gap-12 lg:gap-16 xl:gap-20 items-start">
        {/* ======================================================================= */}
        {/* LEFT COLUMN: Monumental Typography & Structured Contact Info             */}
        {/* ======================================================================= */}
        <div className="w-full max-w-[480px] text-left flex flex-col justify-start">
          {/* Monumental Editorial Headline (Exact scale and 2-tone styling as ABOUT) */}
          <h2 className="font-display text-5xl sm:text-6xl lg:text-7xl xl:text-[80px] text-slate-50 tracking-[-0.01em] uppercase leading-[0.90] mb-5 drop-shadow-[0_4px_24px_rgba(0,0,0,0.98)]">
            CONNECT
            <br />
            <span className="text-emerald-400">WITH US.</span>
          </h2>

          {/* Short Narrative Statement */}
          <p className="text-[14px] sm:text-[15px] lg:text-[16px] text-slate-100/95 font-normal leading-[1.75] mb-7 max-w-[440px] drop-shadow-[0_2px_10px_rgba(0,0,0,0.95)]">
            Ideas, partnerships, and ambitious ventures start with a conversation. Let’s build the next generation of founders together.
          </p>

          {/* Structured Contact Details (Clean horizontal dividers) */}
          <div className="space-y-4 max-w-[440px] select-text">
            {/* Email */}
            <div className="pb-3 border-b border-white/20">
              <span className="block font-mono text-[10px] sm:text-[11px] font-semibold tracking-[0.2em] text-emerald-400 uppercase mb-1 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
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
            <div className="pb-3 border-b border-white/20">
              <span className="block font-mono text-[10px] sm:text-[11px] font-semibold tracking-[0.2em] text-emerald-400 uppercase mb-1 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
                CALL OFFICE
              </span>
              <a
                href="tel:+918008627493"
                className="font-display text-lg sm:text-xl text-white hover:text-teal-300 transition-colors tracking-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)] block"
              >
                +91 80086 27493
              </a>
              <p className="font-mono text-xs text-slate-300 mt-0.5 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
                Mon–Fri · 10 AM – 5 PM IST
              </p>
            </div>

            {/* Campus */}
            <div className="pb-3 border-b border-white/20">
              <span className="block font-mono text-[10px] sm:text-[11px] font-semibold tracking-[0.2em] text-emerald-400 uppercase mb-1 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
                CAMPUS LOCATION
              </span>
              <p className="font-display text-base sm:text-lg text-white uppercase tracking-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)]">
                Woxsen University Campus
              </p>
              <p className="text-xs sm:text-[13px] text-slate-300 mt-0.5 leading-relaxed drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
                Sadashivpet, Hyderabad, Telangana 502345
              </p>
            </div>

            {/* Social Links */}
            <div className="pt-2">
              <span className="block font-mono text-[10px] sm:text-[11px] font-semibold tracking-[0.2em] text-slate-400 uppercase mb-2">
                FOLLOW OUR JOURNEY →
              </span>
              <div className="flex items-center gap-4 text-xs font-mono">
                <a
                  href="https://www.linkedin.com/school/woxsen-university/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-200 hover:text-emerald-400 transition-colors flex items-center gap-1 group drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]"
                >
                  <span>LinkedIn</span>
                  <ArrowUpRight className="w-3 h-3 opacity-60 group-hover:opacity-100 transition-opacity" />
                </a>
                <span className="text-white/25">·</span>
                <a
                  href="https://instagram.com/ecell_wou"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-200 hover:text-pink-400 transition-colors flex items-center gap-1 group drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]"
                >
                  <span>Instagram</span>
                  <ArrowUpRight className="w-3 h-3 opacity-60 group-hover:opacity-100 transition-opacity" />
                </a>
                <span className="text-white/25">·</span>
                <a
                  href="https://woxsen.edu.in/ecell"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-200 hover:text-white transition-colors flex items-center gap-1 group drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]"
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
        <div className="w-full max-w-[460px] md:ml-auto flex flex-col justify-start">
          {/* Form Header Eyebrow */}
          <div className="flex items-center gap-2 h-6 mb-5">
            <span className="font-mono text-[11px] sm:text-xs font-semibold tracking-[0.22em] uppercase text-emerald-400 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
              {"// DIRECT INQUIRY"}
            </span>
          </div>

          {sent ? (
            <div className="h-full min-h-[320px] flex flex-col items-start justify-center text-left py-6 select-none animate-in fade-in duration-300">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mb-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              </div>
              <h3 className="font-display text-2xl sm:text-3xl text-white uppercase tracking-tight drop-shadow-[0_2px_10px_rgba(0,0,0,0.98)]">
                Message Sent
              </h3>
              <p className="text-xs sm:text-sm text-slate-200 mt-1.5 max-w-[280px] leading-relaxed drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]">
                Thank you for reaching out. The E-Cell leadership team will connect with you shortly.
              </p>
              <button
                type="button"
                onClick={() => setSent(false)}
                className="mt-6 font-mono text-[11px] tracking-[0.16em] uppercase text-emerald-400 hover:text-emerald-300 underline underline-offset-4 cursor-pointer transition-colors"
              >
                ← Send Another Message
              </button>
            </div>
          ) : (
            <form
              onSubmit={handleSend}
              onKeyDown={(e) => e.stopPropagation()}
              className="space-y-6 select-text"
            >
              {/* Honeypot field for bot spam prevention */}
              <input
                type="text"
                name="website_contact_verification"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
                tabIndex={-1}
                autoComplete="off"
                className="sr-only pointer-events-none"
                aria-hidden="true"
              />

              {errorMsg && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-mono leading-relaxed">
                  {errorMsg}
                </div>
              )}

              {/* Field 1: Name */}
              <div className="border-b border-white/30 pb-2.5 focus-within:border-emerald-400 transition-colors">
                <label className="block font-mono text-[10px] sm:text-[11px] tracking-[0.2em] uppercase text-emerald-400 font-semibold mb-1 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
                  YOUR NAME
                </label>
                <input
                  required
                  disabled={submitting}
                  type="text"
                  autoComplete="name"
                  maxLength={100}
                  placeholder="Enter your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-transparent text-sm sm:text-base text-slate-50 placeholder-slate-400 focus:outline-none transition-colors drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)] disabled:opacity-50 select-text"
                />
              </div>

              {/* Field 2: Email */}
              <div className="border-b border-white/30 pb-2.5 focus-within:border-emerald-400 transition-colors">
                <label className="block font-mono text-[10px] sm:text-[11px] tracking-[0.2em] uppercase text-emerald-400 font-semibold mb-1 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
                  YOUR EMAIL
                </label>
                <input
                  required
                  disabled={submitting}
                  type="email"
                  autoComplete="email"
                  maxLength={150}
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-transparent text-sm sm:text-base text-slate-50 placeholder-slate-400 focus:outline-none transition-colors drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)] disabled:opacity-50 select-text"
                />
              </div>

              {/* Field 3: Message */}
              <div className="border-b border-white/30 pb-2.5 focus-within:border-emerald-400 transition-colors">
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-mono text-[10px] sm:text-[11px] tracking-[0.2em] uppercase text-emerald-400 font-semibold drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
                    MESSAGE
                  </label>
                  {message.length > 0 && (
                    <span className="font-mono text-[10px] text-slate-400">
                      {message.length}/3000
                    </span>
                  )}
                </div>
                <textarea
                  required
                  disabled={submitting}
                  rows={3}
                  maxLength={3000}
                  placeholder="Tell us about your inquiry or startup idea..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full bg-transparent text-sm sm:text-base text-slate-50 placeholder-slate-400 focus:outline-none transition-colors resize-none drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)] disabled:opacity-50 select-text"
                />
              </div>

              {/* Submit Action (Restrained, solid emerald button) */}
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-7 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed text-slate-950 font-bold font-mono text-xs uppercase tracking-[0.18em] flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-emerald-500/25 active:scale-[0.98]"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>SENDING...</span>
                    </>
                  ) : (
                    <>
                      <span>SEND NOTE</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
