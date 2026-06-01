"use client";

import { Copy, ExternalLink, X } from "lucide-react";
import { toast } from "sonner";

const EXTERNAL_PLAYERS = [
  {
    id: "vlc",
    name: "VLC",
    emoji: "🟠",
    desc: "All platforms",
    scheme: (url: string) => `vlc://${url}`,
    fallback: "https://www.videolan.org/vlc/",
  },
  {
    id: "mx",
    name: "MX Player",
    emoji: "▶️",
    desc: "Android",
    scheme: (url: string) =>
      `intent:${url}#Intent;package=com.mxtech.videoplayer.ad;S.browser_fallback_url=https://play.google.com/store/apps/details?id=com.mxtech.videoplayer.ad;end`,
    fallback: "https://play.google.com/store/apps/details?id=com.mxtech.videoplayer.ad",
  },
  {
    id: "pot",
    name: "PotPlayer",
    emoji: "🟢",
    desc: "Windows",
    scheme: (url: string) => `potplayer://${url}`,
    fallback: "https://potplayer.daum.net/",
  },
  {
    id: "iina",
    name: "IINA",
    emoji: "⬛",
    desc: "macOS",
    scheme: (url: string) => `iina://open?url=${encodeURIComponent(url)}`,
    fallback: "https://iina.io/",
  },
  {
    id: "mpv",
    name: "mpv",
    emoji: "🟣",
    desc: "Win/Mac/Linux",
    scheme: (url: string) => `mpv://${url}`,
    fallback: "https://mpv.io/installation/",
  },
  {
    id: "infuse",
    name: "Infuse",
    emoji: "🔵",
    desc: "iOS / tvOS",
    scheme: (url: string) => `infuse://x-callback-url/play?url=${encodeURIComponent(url)}`,
    fallback: "https://apps.apple.com/app/infuse-7/id1136220934",
  },
] as const;

export function tryLaunchPlayer(schemeUrl: string, fallbackUrl: string): void {
  if (schemeUrl.startsWith("intent:")) {
    window.location.href = schemeUrl;
    return;
  }
  let didBlur = false;
  const onBlur = () => { didBlur = true; };
  window.addEventListener("blur", onBlur, { once: true });
  window.location.href = schemeUrl;
  setTimeout(() => {
    window.removeEventListener("blur", onBlur);
    if (!didBlur) {
      window.open(fallbackUrl, "_blank", "noopener,noreferrer");
    }
  }, 1500);
}

export function ExternalPlayerPicker({
  streamUrl,
  onClose,
  idPrefix,
}: {
  streamUrl: string;
  onClose: () => void;
  idPrefix: string;
}) {
  return (
    <div className="flex min-h-0 flex-col" onClick={(e) => e.stopPropagation()}>
      <div className="mb-2 flex items-start justify-between gap-2 sm:mb-3">
        <p
          id={`${idPrefix}-ext-title`}
          className="pr-1 text-[9px] font-bold uppercase leading-snug tracking-[0.1em] sm:tracking-[0.12em]"
          style={{ color: "var(--text-muted)" }}
        >
          Open in external app — tap a player (or install if prompted)
        </p>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-lg p-1.5 transition hover:bg-white/10"
          style={{ color: "var(--text-muted)", border: "1px solid rgba(255,255,255,0.1)" }}
          aria-label="Close external players"
        >
          <X size={18} />
        </button>
      </div>

      <div className="grid max-h-[min(44dvh,18rem)] grid-cols-2 gap-2 overflow-y-auto overscroll-contain pr-0.5 sm:max-h-none sm:grid-cols-3 md:grid-cols-6">
        {EXTERNAL_PLAYERS.map((player) => (
          <button
            key={player.id}
            type="button"
            onClick={() => { tryLaunchPlayer(player.scheme(streamUrl), player.fallback); onClose(); }}
            className="flex min-h-0 flex-col items-center justify-center gap-0.5 rounded-xl px-1.5 py-2 text-center transition hover:bg-white/10"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
            title={`${player.name} — ${player.desc}`}
          >
            <span className="text-lg leading-none sm:text-2xl">{player.emoji}</span>
            <span className="w-full truncate text-[10px] font-bold leading-tight text-white sm:text-[11px]">{player.name}</span>
            <span className="line-clamp-2 text-center text-[8px] leading-tight sm:text-[9px]" style={{ color: "var(--text-muted)" }}>{player.desc}</span>
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[10px] font-medium transition hover:bg-white/10 sm:px-3 sm:text-[11px]"
          style={{ background: "rgba(255,255,255,0.05)", color: "var(--text-muted)", border: "1px solid rgba(255,255,255,0.08)" }}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(streamUrl);
              toast.success("Stream URL copied");
            } catch {
              toast.error("Could not copy");
            }
          }}
        >
          <Copy size={12} className="shrink-0" />
          <span>Copy URL</span>
        </button>
        <button
          type="button"
          className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[10px] font-medium transition hover:bg-white/10 sm:px-3 sm:text-[11px]"
          style={{ background: "rgba(255,255,255,0.05)", color: "var(--text-muted)", border: "1px solid rgba(255,255,255,0.08)" }}
          onClick={() => window.open(streamUrl, "_blank", "noopener,noreferrer")}
        >
          <ExternalLink size={12} className="shrink-0" />
          <span>Open in tab</span>
        </button>
      </div>
    </div>
  );
}
