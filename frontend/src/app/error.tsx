"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[ABO SPORTS TV] Error:", error, error.digest ? `(digest: ${error.digest})` : "");
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-[#080a11] px-4 text-center text-white">
      <div className="mb-6 text-6xl">⚠️</div>
      <h1 className="mb-2 text-2xl font-bold text-amber-400">কিছু একটা সমস্যা হয়েছে</h1>
      <p className="mb-1 text-sm text-zinc-400">পেজটি লোড করা যায়নি।</p>
      {error.digest && (
        <p className="mb-6 font-mono text-xs text-zinc-600">ref: {error.digest}</p>
      )}
      <button
        onClick={() => reset()}
        className="rounded-lg bg-amber-500 px-6 py-2.5 text-sm font-semibold text-black transition hover:bg-amber-400 active:scale-95"
      >
        আবার চেষ্টা করুন
      </button>
    </div>
  );
}
