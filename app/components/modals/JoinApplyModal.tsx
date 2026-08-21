"use client";

import React, { useState } from "react";
import { X, Sparkles, Send, CheckCircle2, Building2, User, Mail, Phone, Lightbulb } from "lucide-react";

interface JoinApplyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function JoinApplyModal({ isOpen, onClose }: JoinApplyModalProps) {
  const [formType, setFormType] = useState<"student" | "startup" | "partner">("student");
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    department: "School of Technology",
    year: "1st Year",
    interestOrIdea: "",
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => {
      // Auto close after 3 seconds on submit if desired or let user close
    }, 2000);
  };

  const resetAndClose = () => {
    setSubmitted(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-xl animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-gradient-to-b from-slate-900/95 to-slate-950/95 border border-white/15 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-emerald-950/40 text-slate-100 overflow-hidden">
        {/* Glow ambient background */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-60 h-60 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-60 h-60 bg-teal-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={resetAndClose}
          className="absolute top-5 right-5 p-2 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/10 transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {submitted ? (
          <div className="py-12 flex flex-col items-center text-center gap-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-bold font-heading text-white">
              Application Received!
            </h3>
            <p className="text-slate-300 max-w-md text-sm leading-relaxed">
              Thank you for connecting with the Entrepreneurship Cell, Woxsen University. Our team will review your application and reach out via email within 48 hours.
            </p>
            <button
              onClick={resetAndClose}
              className="mt-4 px-6 py-2.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-sm transition-all"
            >
              Done
            </button>
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-mono font-medium mb-1">
              <Sparkles className="w-4 h-4" />
              <span>OFFICIAL APPLICATION PORTAL</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold font-heading text-white">
              Join E-Cell Woxsen
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 mb-6">
              Empowering student founders, innovators, and changemakers across campus.
            </p>

            {/* Tab Selector */}
            <div className="grid grid-cols-3 gap-2 p-1 bg-slate-950/80 border border-white/10 rounded-xl mb-6 text-xs">
              <button
                type="button"
                onClick={() => setFormType("student")}
                className={`py-2 rounded-lg font-medium transition-all ${
                  formType === "student"
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Join Team
              </button>
              <button
                type="button"
                onClick={() => setFormType("startup")}
                className={`py-2 rounded-lg font-medium transition-all ${
                  formType === "startup"
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Pitch Idea
              </button>
              <button
                type="button"
                onClick={() => setFormType("partner")}
                className={`py-2 rounded-lg font-medium transition-all ${
                  formType === "partner"
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Partner / Sponsor
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs sm:text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-300 mb-1.5 font-medium">Full Name</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                    <input
                      required
                      type="text"
                      placeholder="e.g. Aarav Sharma"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full bg-slate-950/60 border border-white/10 rounded-xl py-2.5 pl-9 pr-3 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 mb-1.5 font-medium">Email Address</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                    <input
                      required
                      type="email"
                      placeholder="e.g. name@woxsen.edu.in"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full bg-slate-950/60 border border-white/10 rounded-xl py-2.5 pl-9 pr-3 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 transition-colors"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-300 mb-1.5 font-medium">Phone Number</label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                    <input
                      required
                      type="tel"
                      placeholder="+91 98765 43210"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full bg-slate-950/60 border border-white/10 rounded-xl py-2.5 pl-9 pr-3 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 mb-1.5 font-medium">Department / School</label>
                  <div className="relative">
                    <Building2 className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                    <select
                      value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                      className="w-full bg-slate-950/60 border border-white/10 rounded-xl py-2.5 pl-9 pr-3 text-white focus:outline-none focus:border-emerald-500/50 transition-colors"
                    >
                      <option value="School of Technology" className="bg-slate-900 text-white">School of Technology</option>
                      <option value="School of Business" className="bg-slate-900 text-white">School of Business</option>
                      <option value="School of Arts & Design" className="bg-slate-900 text-white">School of Arts & Design</option>
                      <option value="School of Law" className="bg-slate-900 text-white">School of Law</option>
                      <option value="School of Architecture & Planning" className="bg-slate-900 text-white">School of Architecture</option>
                      <option value="School of Sciences" className="bg-slate-900 text-white">School of Sciences</option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1.5 font-medium">
                  {formType === "student"
                    ? "Why do you want to join E-Cell? (Area of interest / skills)"
                    : formType === "startup"
                    ? "Briefly describe your startup idea or problem statement"
                    : "How would you like to collaborate / partner with E-Cell?"}
                </label>
                <div className="relative">
                  <Lightbulb className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <textarea
                    required
                    rows={3}
                    placeholder={
                      formType === "student"
                        ? "e.g. Interested in events, corporate relations, marketing or technical development..."
                        : formType === "startup"
                        ? "e.g. Building an AI sustainability tool for university campuses..."
                        : "e.g. Interested in mentoring student startups, speaking at E-Summit, or event sponsorship..."
                    }
                    value={formData.interestOrIdea}
                    onChange={(e) => setFormData({ ...formData, interestOrIdea: e.target.value })}
                    className="w-full bg-slate-950/60 border border-white/10 rounded-xl py-2.5 pl-9 pr-3 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full mt-2 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer hover:scale-[1.01] active:scale-[0.99]"
              >
                <Send className="w-4 h-4" />
                <span>Submit Application</span>
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
