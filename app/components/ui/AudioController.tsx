"use client";

import React, { useState, useEffect, useRef } from "react";
import { Volume2, VolumeX } from "lucide-react";

export default function AudioController() {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const oscillatorsRef = useRef<OscillatorNode[]>([]);

  const startAmbientSound = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioContextClass();
      audioCtxRef.current = ctx;

      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0.01, ctx.currentTime);
      masterGain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 3);
      masterGain.connect(ctx.destination);
      gainNodeRef.current = masterGain;

      // Warm ambient drone frequencies (F major / D minor ambient pad)
      const frequencies = [174.61, 220.0, 261.63, 349.23, 523.25];
      const oscs: OscillatorNode[] = [];

      frequencies.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        osc.type = idx % 2 === 0 ? "sine" : "triangle";
        osc.frequency.setValueAtTime(freq, ctx.currentTime);

        // subtle detuning for rich cinematic shimmer
        osc.detune.setValueAtTime((idx - 2) * 4, ctx.currentTime);

        const oscGain = ctx.createGain();
        oscGain.gain.setValueAtTime(0.04, ctx.currentTime);

        // Subtle LFO for breathing effect
        const lfo = ctx.createOscillator();
        lfo.frequency.setValueAtTime(0.15 + idx * 0.05, ctx.currentTime);
        const lfoGain = ctx.createGain();
        lfoGain.gain.setValueAtTime(0.02, ctx.currentTime);
        lfo.connect(lfoGain.gain);
        lfo.start();

        osc.connect(oscGain);
        oscGain.connect(masterGain);
        osc.start();
        oscs.push(osc);
      });

      oscillatorsRef.current = oscs;
      setIsPlaying(true);
    } catch (e) {
      console.warn("Audio Context init error:", e);
    }
  };

  const stopAmbientSound = () => {
    if (gainNodeRef.current && audioCtxRef.current) {
      const ctx = audioCtxRef.current;
      gainNodeRef.current.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1);
      setTimeout(() => {
        oscillatorsRef.current.forEach((osc) => {
          try {
            osc.stop();
            osc.disconnect();
          } catch {}
        });
        oscillatorsRef.current = [];
        if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
          audioCtxRef.current.close();
        }
        audioCtxRef.current = null;
        gainNodeRef.current = null;
        setIsPlaying(false);
      }, 1000);
    } else {
      setIsPlaying(false);
    }
  };

  const toggleAudio = () => {
    if (isPlaying) {
      stopAmbientSound();
    } else {
      startAmbientSound();
    }
  };

  useEffect(() => {
    return () => {
      stopAmbientSound();
    };
  }, []);

  return (
    <button
      onClick={toggleAudio}
      className={`fixed bottom-6 left-6 z-40 flex items-center gap-2.5 px-3.5 py-2 rounded-full border backdrop-blur-xl transition-all duration-300 shadow-xl ${
        isPlaying
          ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300 shadow-emerald-500/10"
          : "bg-slate-950/70 border-white/10 text-slate-400 hover:text-white hover:border-white/20"
      }`}
      title={isPlaying ? "Mute Ambient Soundscape" : "Play Ambient Soundscape"}
    >
      {isPlaying ? (
        <>
          <Volume2 className="w-4 h-4 text-emerald-400 animate-pulse" />
          <span className="text-xs font-mono font-medium tracking-tight">SOUND ON</span>
          <span className="flex items-end gap-0.5 h-3">
            <span className="w-0.5 h-3 bg-emerald-400 animate-pulse" />
            <span className="w-0.5 h-2 bg-emerald-400 animate-pulse [animation-delay:150ms]" />
            <span className="w-0.5 h-2.5 bg-emerald-400 animate-pulse [animation-delay:300ms]" />
          </span>
        </>
      ) : (
        <>
          <VolumeX className="w-4 h-4" />
          <span className="text-xs font-mono font-medium tracking-tight">AMBIENCE</span>
        </>
      )}
    </button>
  );
}
