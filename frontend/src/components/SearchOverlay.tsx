"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Search, X, Clock } from "lucide-react";
import { useState, useEffect } from "react";
import type { Channel } from "@/lib/types";

interface SearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  suggestions: Channel[];
  onSuggestionClick: (suggestion: Channel) => void;
  recentSearches: string[];
  onRecentClick: (query: string) => void;
  onClearRecent: () => void;
}

export function SearchOverlay({
  isOpen,
  onClose,
  searchQuery,
  onSearchChange,
  suggestions,
  onSuggestionClick,
  recentSearches,
  onRecentClick,
  onClearRecent,
}: SearchOverlayProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      setTimeout(() => {
        document.getElementById("search-overlay-input")?.focus();
      }, 100);
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!mounted) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* ব্যাকড্রপ */}
          <motion.div
            key="overlay-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[45] bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* সার্চ প্যানেল */}
          <motion.div
            key="overlay-panel"
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed left-0 right-0 top-0 z-[50] max-h-[90vh] overflow-y-auto overflow-x-hidden glass-premium border-b border-glass-border"
          >
            {/* সার্চ ইনপুট */}
            <div className="sticky top-0 z-[51] border-b border-glass-border p-4 sm:p-5 glass-premium">
              <div className="flex items-center gap-3">
                <div className="flex-1 relative">
                  <Search
                    size={20}
                    className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                    style={{ color: "var(--text-muted)" }}
                  />
                  <input
                    id="search-overlay-input"
                    type="search"
                    value={searchQuery}
                    onChange={(e) => onSearchChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") onClose();
                    }}
                    placeholder="চ্যানেল, স্পোর্টস খুঁজুন..."
                    autoComplete="off"
                    className="search-input w-full rounded-xl border border-glass-border bg-surface-elevated/80 pl-10 pr-4 py-3 text-base font-medium backdrop-blur-md focus:outline-none placeholder:opacity-50"
                  />
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="shrink-0 p-2.5 rounded-lg transition hover:bg-white/10"
                  style={{ color: "var(--text-muted)" }}
                  aria-label="বন্ধ করুন"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* সামগ্রী */}
            <div className="px-4 sm:px-5 pb-6">
              {searchQuery.trim() ? (
                // সার্চ ফলাফল
                <div>
                  {suggestions.length > 0 ? (
                    <>
                      <p className="text-xs font-semibold uppercase tracking-wider mb-3 mt-6" style={{ color: "var(--text-muted)" }}>
                        চ্যানেল ({suggestions.length})
                      </p>
                      <div className="space-y-2">
                        {suggestions.map((ch) => (
                          <button
                            key={ch.id}
                            type="button"
                            onClick={() => {
                              onSuggestionClick(ch);
                              onClose();
                            }}
                            className="glass-premium w-full flex items-center gap-3 rounded-xl p-3 transition-colors hover:border-accent-gold/30 active:scale-[0.99]"
                          >
                            {ch.logo_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={ch.logo_url}
                                alt={ch.name}
                                className="h-12 w-12 shrink-0 rounded-md object-contain"
                                style={{ border: "1px solid var(--border)" }}
                                loading="lazy"
                              />
                            ) : (
                              <div
                                className="h-12 w-12 shrink-0 rounded-md flex items-center justify-center text-sm font-bold"
                                style={{ background: "var(--bg-card)", color: "var(--primary-accent)" }}
                              >
                                {ch.name.slice(0, 2)}
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="font-medium truncate" style={{ color: "var(--text-main)" }}>
                                {ch.name}
                              </p>
                              <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                                {ch.country} · {ch.quality_tag.toUpperCase()}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-3 py-12">
                      <Search size={36} style={{ color: "var(--text-muted)", opacity: 0.4 }} />
                      <p style={{ color: "var(--text-muted)" }} className="text-sm text-center">
                        &quot;{searchQuery}&quot; এর জন্য কোনো চ্যানেল পাওয়া যায়নি
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                // সাম্প্রতিক সার্চ
                <div>
                  {recentSearches.length > 0 && (
                    <>
                      <div className="flex items-center justify-between mt-6 mb-3">
                        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                          সাম্প্রতিক অনুসন্ধান
                        </p>
                        <button
                          type="button"
                          onClick={onClearRecent}
                          className="text-[10px] font-semibold transition hover:opacity-70"
                          style={{ color: "var(--primary-accent)" }}
                        >
                          সাফ করুন
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {recentSearches.map((recent) => (
                          <button
                            key={recent}
                            type="button"
                            onClick={() => {
                              onRecentClick(recent);
                            }}
                            className="flex items-center gap-2 px-3 py-2 rounded-full text-sm transition hover:opacity-80 active:scale-95"
                            style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-main)" }}
                          >
                            <Clock size={14} style={{ color: "var(--text-muted)" }} />
                            {recent}
                          </button>
                        ))}
                      </div>
                    </>
                  )}

                  {recentSearches.length === 0 && (
                    <div className="flex flex-col items-center justify-center gap-3 py-12">
                      <Search size={36} style={{ color: "var(--text-muted)", opacity: 0.5 }} />
                      <p style={{ color: "var(--text-muted)" }} className="text-sm text-center">
                        আপনার প্রিয় চ্যানেল খুঁজুন
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
