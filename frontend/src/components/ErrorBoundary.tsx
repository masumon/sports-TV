"use client";

import { ReactNode, useEffect, useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorState {
  hasError: boolean;
  error: Error | null;
}

export function ErrorBoundary({ children }: ErrorBoundaryProps) {
  const [state, setState] = useState<ErrorState>({ hasError: false, error: null });

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      console.error("Uncaught error:", event.error);
      setState({ hasError: true, error: event.error });
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error("Unhandled promise rejection:", event.reason);
      setState({ hasError: true, error: new Error(event.reason?.message || String(event.reason)) });
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, []);

  if (state.hasError) {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center gap-6 px-4"
        style={{ background: "var(--bg-dark)" }}
      >
        <div
          className="rounded-full p-4 flex items-center justify-center"
          style={{ background: "rgba(239,68,68,0.1)" }}
        >
          <AlertTriangle size={40} style={{ color: "#EF4444" }} />
        </div>

        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--text-main)" }}>
            কিছু ভুল হয়েছে
          </h1>
          <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
            আমরা একটি অপ্রত্যাশিত ত্রুটি সম্মুখীন হয়েছি। দয়া করে পৃষ্ঠা রিফ্রেশ করুন বা পরে আবার চেষ্টা করুন।
          </p>
          {state.error && (
            <p className="text-xs font-mono p-3 mb-4 rounded-lg overflow-auto max-h-24" style={{ background: "var(--bg-card)", color: "#EF4444" }}>
              {state.error.message}
            </p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => {
              setState({ hasError: false, error: null });
              window.location.reload();
            }}
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold transition hover:opacity-90 min-h-11"
            style={{ background: "var(--primary-accent)", color: "#0a0a0f" }}
          >
            <RefreshCw size={18} />
            পৃষ্ঠা রিফ্রেশ করুন
          </button>
          <button
            onClick={() => {
              setState({ hasError: false, error: null });
              window.location.href = "/";
            }}
            className="flex items-center justify-center px-6 py-3 rounded-xl font-semibold transition hover:bg-white/10 min-h-11"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-main)" }}
          >
            হোম পেজে যান
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
