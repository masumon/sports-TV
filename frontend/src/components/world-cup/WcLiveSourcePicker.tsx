"use client";

import { ExternalLink, Play, Tv } from "lucide-react";
import { useMemo, useState } from "react";
import type { Channel, LiveFixture } from "@/lib/types";
import { WC_OFFICIAL_BROADCASTERS } from "@/lib/wcKnownPlatforms";

type Tab = "iptv" | "official";

type Props = {
  fixture: LiveFixture;
  wcChannels: Channel[];
  onSelectChannel: (ch: Channel) => void;
};

export function WcLiveSourcePicker({ fixture, wcChannels, onSelectChannel }: Props) {
  const [tab, setTab] = useState<Tab>("iptv");

  const iptv = useMemo(() => {
    const suggestedIds = new Set(fixture.suggested_channels.map((c) => c.id));
    // suggested channels first, then remaining wc channels (up to 20 total)
    const extra = wcChannels
      .filter((c) => !suggestedIds.has(c.id))
      .slice(0, Math.max(0, 20 - fixture.suggested_channels.length));
    return [...fixture.suggested_channels, ...extra];
  }, [fixture.suggested_channels, wcChannels]);

  const hasIptv = iptv.length > 0;

  return (
    <div
      className="mt-2 rounded-xl overflow-hidden"
      style={{
        background: "var(--bg-card2)",
        border: "1px solid rgba(245,166,35,0.22)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between gap-3 px-3 py-2"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-1.5">
          <Tv size={12} style={{ color: "var(--primary-accent)" }} />
          <span className="text-[11px] font-bold" style={{ color: "var(--primary-accent)" }}>
            Watch Sources
          </span>
          <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
            — {fixture.home_team} vs {fixture.away_team}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex" style={{ borderBottom: "1px solid var(--border)" }}>
        {([["iptv", "📡 IPTV Streams"], ["official", "🌐 Official Sites"]] as const).map(
          ([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className="flex flex-1 items-center justify-center py-2 text-[10px] font-bold transition"
              style={{
                color: tab === id ? "var(--primary-accent)" : "var(--text-muted)",
                borderBottom: tab === id ? "2px solid var(--primary-accent)" : "2px solid transparent",
                background: tab === id ? "rgba(245,166,35,0.05)" : "transparent",
              }}
            >
              {label}
            </button>
          )
        )}
      </div>

      {/* Content */}
      <div className="px-3 py-2.5">
        {tab === "iptv" ? (
          hasIptv ? (
            <div className="flex flex-wrap gap-1.5">
              {iptv.map((ch) => (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => {
                    onSelectChannel(ch);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition hover:opacity-90 active:scale-95"
                  style={{
                    background: "rgba(239,68,68,0.1)",
                    border: "1px solid rgba(239,68,68,0.28)",
                    color: "#f87171",
                  }}
                >
                  <Play size={10} />
                  {ch.name}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-center text-[11px] py-3" style={{ color: "var(--text-muted)" }}>
              No IPTV sources found for this match yet. Check Official Sites tab.
            </p>
          )
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {WC_OFFICIAL_BROADCASTERS.map((b) => (
              <a
                key={b.name}
                href={b.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition hover:opacity-90 active:scale-95"
                style={{
                  background: "rgba(245,166,35,0.08)",
                  border: "1px solid rgba(245,166,35,0.25)",
                  color: "var(--primary-accent)",
                }}
              >
                <ExternalLink size={10} />
                {b.name}
                <span
                  className="text-[9px] leading-none"
                  style={{ opacity: 0.55 }}
                >
                  {b.region}
                </span>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
