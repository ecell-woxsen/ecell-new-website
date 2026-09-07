"use client";

import React, { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("CAUGHT CLIENT ERROR:", error);
  }, [error]);

  return (
    <div className="fixed inset-0 z-50 bg-[#040608] text-red-400 p-8 font-mono overflow-auto">
      <h1 className="text-2xl font-bold text-red-500 mb-4">CAUGHT CLIENT ERROR</h1>
      <p className="text-lg text-white mb-2 font-semibold">{error?.message || "Unknown error"}</p>
      <pre className="text-xs text-slate-300 bg-black/80 p-4 rounded border border-red-500/30 whitespace-pre-wrap mb-4">
        {error?.stack}
      </pre>
      <button
        onClick={() => reset()}
        className="px-4 py-2 bg-red-600 text-white rounded cursor-pointer"
      >
        Reset / Try Again
      </button>
    </div>
  );
}
