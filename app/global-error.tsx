"use client";

import React, { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("GLOBAL ERROR:", error);
  }, [error]);

  return (
    <html>
      <body className="bg-[#040608] text-red-400 p-8 font-mono">
        <h1 className="text-2xl font-bold text-red-500 mb-4">GLOBAL ROOT ERROR</h1>
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
      </body>
    </html>
  );
}
