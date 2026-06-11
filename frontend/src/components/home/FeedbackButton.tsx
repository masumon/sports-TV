"use client";

import { MessageCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function FeedbackButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!feedback.trim()) {
      toast.error("প্লিজ কিছু feedback দিন");
      return;
    }

    setIsSubmitting(true);
    try {
      await fetch("/api/v1/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: feedback,
          userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
          timestamp: new Date().toISOString(),
        }),
      });
      toast.success("ধন্যবাদ! আপনার feedback গুরুত্বপূর্ণ।");
      setFeedback("");
      setIsOpen(false);
    } catch {
      toast.error("Feedback পাঠাতে সমস্যা হয়েছে");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 left-6 z-30 rounded-full p-3 transition hover:scale-110 active:scale-95 md:bottom-8 md:left-8"
        style={{
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          color: "white",
          boxShadow: "0 4px 12px rgba(102, 126, 234, 0.4)",
        }}
        aria-label="Send feedback"
      >
        <MessageCircle size={20} />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
          <div
            className="absolute inset-0"
            onClick={() => setIsOpen(false)}
            style={{ background: "rgba(0,0,0,0.5)" }}
          />
          <div
            className="glass-player-bar-premium relative w-full rounded-t-2xl border border-border-subtle p-6 md:w-96 md:rounded-2xl"
            style={{
              boxShadow: "0 12px 48px rgba(0,0,0,0.6)",
            }}
          >
            <h3 className="mb-3 text-lg font-bold" style={{ color: "var(--text-main)" }}>
              📝 আপনার মতামত দিন
            </h3>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="আপনার মতামত, সমস্যা বা পরামর্শ..."
              maxLength={500}
              className="mb-4 w-full rounded-lg border border-border-subtle bg-white/5 px-4 py-3 text-sm text-foreground placeholder-muted-foreground focus:border-accent-gold focus:outline-none"
              rows={4}
            />
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                {feedback.length}/500
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-lg px-4 py-2 text-sm font-semibold transition hover:opacity-80"
                  style={{ background: "rgba(255,255,255,0.1)", color: "var(--text-muted)" }}
                >
                  বাতিল
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting || !feedback.trim()}
                  className="rounded-lg px-4 py-2 text-sm font-semibold transition hover:opacity-90 disabled:opacity-50"
                  style={{
                    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                    color: "white",
                  }}
                >
                  {isSubmitting ? "পাঠাচ্ছি..." : "পাঠান"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
