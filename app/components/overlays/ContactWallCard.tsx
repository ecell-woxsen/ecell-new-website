"use client";

import React, { useState } from "react";
import { Mail, Phone, MapPin, Globe, Send, CheckCircle2, MessageSquare } from "lucide-react";

export default function ContactWallCard() {
  const [sent, setSent] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    setSent(true);
  };

  return (
    <div className="w-[88vw] sm:w-[560px] md:w-[620px] lg:w-[680px] shrink-0 glass-wall-card rounded-3xl p-6 sm:p-8 text-slate-100 shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 mb-5 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2 text-emerald-400 text-xs font-mono font-semibold tracking-wider mb-1">
            <MessageSquare className="w-3.5 h-3.5" />
            <span>GET IN TOUCH</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold font-heading text-white">
            Connect With Us
          </h2>
        </div>
        <span className="text-[11px] font-mono px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
          HYDERABAD · INDIA
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
        {/* Contact Info Cards */}
        <div className="space-y-3">
          <a
            href="mailto:ecell@woxsen.edu.in"
            className="flex items-start gap-3 p-3 rounded-2xl bg-slate-950/60 border border-white/10 hover:border-emerald-500/40 transition-colors group"
          >
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-mono text-slate-400 uppercase">Email Us</span>
              <p className="text-xs sm:text-sm font-semibold text-white group-hover:text-emerald-300 transition-colors">
                ecell@woxsen.edu.in
              </p>
            </div>
          </a>

          <a
            href="tel:+918008627493"
            className="flex items-start gap-3 p-3 rounded-2xl bg-slate-950/60 border border-white/10 hover:border-emerald-500/40 transition-colors group"
          >
            <div className="w-8 h-8 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 shrink-0 mt-0.5">
              <Phone className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-mono text-slate-400 uppercase">Call Office</span>
              <p className="text-xs sm:text-sm font-semibold text-white group-hover:text-teal-300 transition-colors">
                +91 80086 27493
              </p>
              <p className="text-[10px] text-slate-500">Mon - Fri, 10 AM - 5 PM IST</p>
            </div>
          </a>

          <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-950/60 border border-white/10">
            <div className="w-8 h-8 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 shrink-0 mt-0.5">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-mono text-slate-400 uppercase">Campus Location</span>
              <p className="text-xs text-white font-medium">
                Woxsen University Campus
              </p>
              <p className="text-[10px] text-slate-400">
                Sadasivpet, Hyderabad, Telangana 502345
              </p>
            </div>
          </div>
        </div>

        {/* Quick Message Form */}
        <div className="p-4 rounded-2xl bg-slate-950/70 border border-white/10 flex flex-col justify-between">
          {sent ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-4">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mb-2" />
              <p className="font-heading font-bold text-sm text-white">Message Sent!</p>
              <p className="text-[11px] text-slate-400 mt-1">We will reply to your email shortly.</p>
            </div>
          ) : (
            <form onSubmit={handleSend} className="space-y-2.5 text-xs">
              <div>
                <input
                  required
                  type="text"
                  placeholder="Your Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
                />
              </div>
              <div>
                <input
                  required
                  type="email"
                  placeholder="Your Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
                />
              </div>
              <div>
                <textarea
                  required
                  rows={2}
                  placeholder="Quick message or inquiry..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 resize-none"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send Note</span>
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Social Bar */}
      <div className="pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs">
        <span className="text-[11px] font-mono text-slate-400">Follow Our Journey:</span>
        <div className="flex items-center gap-3">
          <a
            href="https://www.linkedin.com/school/woxsen-university/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
          >
            <svg className="w-3.5 h-3.5 fill-sky-400" viewBox="0 0 24 24">
              <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 8.76a1.64 1.64 0 1 0 0-3.28 1.64 1.64 0 0 0 0 3.28m1.39 9.74v-8.37H5.07v8.37h2.78z" />
            </svg>
            <span className="text-[11px]">LinkedIn</span>
          </a>
          <a
            href="https://instagram.com/ecell_wou"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
          >
            <svg className="w-3.5 h-3.5 fill-pink-400" viewBox="0 0 24 24">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
            </svg>
            <span className="text-[11px]">@ecell_wou</span>
          </a>
          <a
            href="https://woxsen.edu.in/ecell"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
          >
            <Globe className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[11px]">woxsen.edu.in</span>
          </a>
        </div>
      </div>
    </div>
  );
}
