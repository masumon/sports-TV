"use client";

import { motion } from "framer-motion";
import {
  Bell,
  Bolt,
  Cast,
  ChartNoAxesColumnIncreasing,
  CircleDot,
  ChevronRight,
  CircleUserRound,
  Clapperboard,
  Cog,
  Globe,
  LogOut,
  Menu,
  MonitorPlay,
  Search,
  SatelliteDish,
  Shield,
  Trophy,
  Tv,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type CategoryFilter = "all" | "football" | "cricket" | "motorsport" | "multi-sport";
type ExternalPlayer = "web" | "vlc" | "mx" | "xmtv";

type ChannelItem = {
  id: number;
  name: string;
  category: Exclude<CategoryFilter, "all">;
  matchInfo: string;
  code: string;
  color: string;
  imageUrl: string;
  logoText: string;
};

type Toast = {
  id: number;
  message: string;
  type: "success" | "info";
};

type EpgItem = {
  time: string;
  title: string;
  desc: string;
  now?: boolean;
};

const CHANNELS: ChannelItem[] = [
  {
    id: 1,
    name: "Sky Sports Main Event",
    category: "football",
    matchInfo: "Premier League • Arsenal vs Liverpool",
    code: "SKY-ME",
    color: "#e50914",
    imageUrl:
      "https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=1600&q=80",
    logoText: "SKY",
  },
  {
    id: 2,
    name: "ESPN HD",
    category: "motorsport",
    matchInfo: "Formula 1 • Saudi Arabian GP Highlights",
    code: "ESPN-HD",
    color: "#ef4444",
    imageUrl:
      "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1600&q=80",
    logoText: "ESPN",
  },
  {
    id: 3,
    name: "T Sports",
    category: "cricket",
    matchInfo: "BPL • Dhaka vs Chattogram",
    code: "TSP-01",
    color: "#dc2626",
    imageUrl:
      "https://images.unsplash.com/photo-1531415074968-036ba1b575da?auto=format&fit=crop&w=1600&q=80",
    logoText: "TS",
  },
  {
    id: 4,
    name: "beIN Sports 1",
    category: "football",
    matchInfo: "UEFA Champions League • Bayern vs Inter",
    code: "BEIN-1",
    color: "#f43f5e",
    imageUrl:
      "https://images.unsplash.com/photo-1517927033932-b3d18e61fb3a?auto=format&fit=crop&w=1600&q=80",
    logoText: "beIN",
  },
  {
    id: 5,
    name: "Fox Cricket",
    category: "cricket",
    matchInfo: "ODI Series • Australia vs India",
    code: "FOX-CR",
    color: "#fb7185",
    imageUrl:
      "https://images.unsplash.com/photo-1624880357913-a8539238245b?auto=format&fit=crop&w=1600&q=80",
    logoText: "FOX",
  },
  {
    id: 6,
    name: "Eurosport Motorsport",
    category: "motorsport",
    matchInfo: "MotoGP • Qualifying Session",
    code: "EURO-M",
    color: "#ef4444",
    imageUrl:
      "https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=1600&q=80",
    logoText: "EURO",
  },
  {
    id: 7,
    name: "Star Sports Select",
    category: "multi-sport",
    matchInfo: "Tennis ATP • Quarter Final Live",
    code: "STAR-SEL",
    color: "#e11d48",
    imageUrl:
      "https://images.unsplash.com/photo-1542144582-1ba00456b5e3?auto=format&fit=crop&w=1600&q=80",
    logoText: "STAR",
  },
  {
    id: 8,
    name: "Sony TEN 2",
    category: "multi-sport",
    matchInfo: "WWE Live • Main Event Card",
    code: "SONY-T2",
    color: "#f43f5e",
    imageUrl:
      "https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=1600&q=80",
    logoText: "TEN2",
  },
];

const BREAKING_UPDATES = [
  "GOAL ALERT: Arsenal takes the lead in 62nd minute!",
  "WICKET: Bangladesh loses opener early in powerplay.",
  "F1 UPDATE: Pole position battle goes down to final lap.",
  "INJURY REPORT: Key striker expected back next match.",
  "TRANSFER NEWS: Top midfielder linked with mega move.",
];

const SIDEBAR_ITEMS: Array<{
  key: CategoryFilter | "settings" | "logout";
  label: string;
  icon: React.ReactNode;
}> = [
  { key: "all", label: "All Channels", icon: <Globe size={17} /> },
  { key: "football", label: "Football", icon: <Trophy size={17} /> },
  { key: "cricket", label: "Cricket", icon: <CircleDot size={17} /> },
  { key: "motorsport", label: "Motorsport", icon: <MonitorPlay size={17} /> },
  { key: "multi-sport", label: "Multi-Sport", icon: <Tv size={17} /> },
  { key: "settings", label: "Settings", icon: <Cog size={17} /> },
  { key: "logout", label: "Logout", icon: <LogOut size={17} /> },
];

function makeEpg(channel: ChannelItem): EpgItem[] {
  return [
    {
      time: "NOW",
      title: `NOW PLAYING • ${channel.name}`,
      desc: channel.matchInfo,
      now: true,
    },
    {
      time: "20:30",
      title: "Studio Analysis",
      desc: "Expert panel tactical breakdown and key moments.",
    },
    {
      time: "21:15",
      title: "Highlights Reloaded",
      desc: "Top plays and turning points from global leagues.",
    },
    {
      time: "22:00",
      title: "Night Sports Center",
      desc: "Headlines, stats, and fixtures across all competitions.",
    },
  ];
}

function formatClock(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
}

export default function HomePage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [clock, setClock] = useState(formatClock(new Date()));
  const [activeChannel, setActiveChannel] = useState<ChannelItem>(CHANNELS[0]);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [loaderVisible, setLoaderVisible] = useState(false);
  const [externalPlayer, setExternalPlayer] = useState<ExternalPlayer>("web");
  const [toasts, setToasts] = useState<Toast[]>([]);

  const playerRef = useRef<HTMLDivElement | null>(null);
  const toastCounter = useRef(1);

  const showToast = useCallback((message: string, type: Toast["type"] = "info") => {
    const id = toastCounter.current++;
    setToasts((prev) => [...prev, { id, message, type }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, 4900);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(formatClock(new Date())), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const events = [
      "GOAL! Last-minute winner in stoppage time!",
      "WICKET! New batter at the crease now.",
      "RED CARD! Team reduced to ten men.",
      "SIX! Massive hit into the crowd!",
      "CHECKERED FLAG! Race leader wins it!",
    ];
    const interval = window.setInterval(() => {
      const random = events[Math.floor(Math.random() * events.length)];
      showToast(random, "info");
    }, 20000);
    return () => window.clearInterval(interval);
  }, [showToast]);

  const filteredChannels = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return CHANNELS.filter((channel) => {
      const categoryMatch = activeCategory === "all" ? true : channel.category === activeCategory;
      const searchMatch = term.length === 0 ? true : channel.name.toLowerCase().includes(term);
      return categoryMatch && searchMatch;
    });
  }, [activeCategory, searchTerm]);

  const epgItems = useMemo(() => makeEpg(activeChannel), [activeChannel]);

  const onChannelClick = (channel: ChannelItem) => {
    setActiveChannel(channel);
    setLoaderVisible(true);
    setSidebarOpen(false);
    playerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => {
      setLoaderVisible(false);
      showToast(`Stream Connected • ${channel.name}`, "success");
    }, 1200);
  };

  const onNavClick = (key: (typeof SIDEBAR_ITEMS)[number]["key"]) => {
    if (key === "settings") {
      showToast("Settings module coming soon.", "info");
      return;
    }
    if (key === "logout") {
      showToast("Logout সফল হয়েছে।", "info");
      return;
    }
    setActiveCategory(key);
    setSidebarOpen(false);
  };

  const onExternalPlayerClick = (player: ExternalPlayer) => {
    setExternalPlayer(player);
    showToast(`Opening stream with ${player.toUpperCase()} player`, "info");
  };

  const toggleFullscreen = async () => {
    const element = playerRef.current;
    if (!element) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    await element.requestFullscreen();
  };

  return (
    <main className="abo-page">
      <ToastContainer toasts={toasts} />

      <aside className={`abo-sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="abo-logo">
          <SatelliteDish size={22} />
          <span>
            ABO <span className="accent">IP TV</span>
          </span>
        </div>

        <nav className="abo-nav">
          {SIDEBAR_ITEMS.map((item) => {
            const active = item.key === activeCategory;
            return (
              <button
                key={String(item.key)}
                type="button"
                className={`abo-nav-item ${active ? "active" : ""}`}
                onClick={() => onNavClick(item.key)}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      {sidebarOpen ? <button className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} /> : null}

      <section className="abo-content">
        <header className="abo-header">
          <div className="header-left">
            <button className="mobile-menu-btn" type="button" onClick={() => setSidebarOpen((s) => !s)}>
              {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <label className="search-wrap">
              <Search size={16} />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search sports channels..."
              />
            </label>
          </div>

          <div className="header-right">
            <div className="clock-pill">
              <span className="live-dot" />
              <span>{clock}</span>
            </div>
            <button className="icon-pill" type="button" onClick={() => showToast("Chromecast scan started.", "info")}>
              <Cast size={16} />
            </button>
            <button
              className="icon-pill notification"
              type="button"
              onClick={() => showToast("No new notifications", "info")}
            >
              <Bell size={16} />
            </button>
            <div className="avatar-pill">
              <CircleUserRound size={22} />
            </div>
          </div>
        </header>

        <div className="abo-ticker">
          <div className="breaking-badge">BREAKING NEWS</div>
          <div className="ticker-track-wrap">
            <div className="ticker-track">
              {[...BREAKING_UPDATES, ...BREAKING_UPDATES].map((item, idx) => (
                <span key={`${item}-${idx}`}>
                  {item} <ChevronRight size={14} />
                </span>
              ))}
            </div>
          </div>
        </div>

        <section className="player-section" ref={playerRef}>
          <motion.div
            className="main-player"
            style={{ backgroundImage: `url(${activeChannel.imageUrl})` }}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="player-grad-overlay">
              <div className="player-live-badge">
                <span className="dot" /> LIVE STREAM
              </div>
              <h2>{activeChannel.name}</h2>
              <p>{activeChannel.matchInfo}</p>
              <div className="player-progress">
                <span />
              </div>
              <div className="player-controls">
                <button type="button" onClick={() => setIsPlaying((s) => !s)}>
                  {isPlaying ? <Clapperboard size={16} /> : <MonitorPlay size={16} />}
                </button>
                <button type="button" onClick={() => setIsMuted((s) => !s)}>
                  {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                </button>
                <span className="quality-tag">4K HDR</span>
                <button type="button">CC</button>
                <button type="button">
                  <Cog size={16} />
                </button>
                <button type="button" onClick={() => void toggleFullscreen()}>
                  <MonitorPlay size={16} />
                </button>
              </div>
            </div>

            {loaderVisible ? (
              <div className="stream-loader">
                <span className="spinner" />
                <p>Connecting to Stream...</p>
              </div>
            ) : null}
          </motion.div>

          <div className="external-row">
            <span>Open With:</span>
            {(["web", "vlc", "mx", "xmtv"] as ExternalPlayer[]).map((player) => (
              <button
                key={player}
                type="button"
                className={externalPlayer === player ? "active" : ""}
                onClick={() => onExternalPlayerClick(player)}
              >
                {player.toUpperCase()}
              </button>
            ))}
          </div>

          <div className="epg-row">
            {epgItems.map((item) => (
              <article key={`${item.time}-${item.title}`} className={`epg-item ${item.now ? "now" : ""}`}>
                <small>{item.time}</small>
                <h4>{item.title}</h4>
                <p>{item.desc}</p>
              </article>
            ))}
          </div>
        </section>

        <section>
          <div className="section-head">
            <h3>Channel Directory</h3>
            <span>{filteredChannels.length} channels available</span>
          </div>

          <div className="channel-grid">
            {filteredChannels.map((channel) => {
              const active = channel.id === activeChannel.id;
              return (
                <button
                  key={channel.id}
                  type="button"
                  className={`channel-card ${active ? "active" : ""}`}
                  onClick={() => onChannelClick(channel)}
                >
                  <div className="channel-logo" style={{ background: `linear-gradient(135deg, ${channel.color}, #4b1a1a)` }}>
                    {channel.logoText}
                  </div>
                  <h4>{channel.name}</h4>
                  <p>{channel.matchInfo}</p>
                  <div className="channel-meta">
                    <span>{channel.category}</span>
                    <strong>{channel.code}</strong>
                  </div>
                  {active ? (
                    <span className="active-icon">
                      <ChartNoAxesColumnIncreasing size={14} />
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </section>

        <footer className="premium-footer">
          <div className="footer-grid">
            <div>
              <h5>
                ABO <span className="accent">IP TV</span>
              </h5>
              <p>Premium live IPTV sports experience with smooth multi-device streaming UI.</p>
              <div className="socials">
                <span>FB</span>
                <span>YT</span>
                <span>X</span>
                <span>IG</span>
              </div>
            </div>
            <div>
              <h6>Quick Links</h6>
              <ul>
                <li>Live TV</li>
                <li>Schedule</li>
                <li>Highlights</li>
                <li>Top Leagues</li>
              </ul>
            </div>
            <div>
              <h6>Support</h6>
              <ul>
                <li>Help Center</li>
                <li>Contact</li>
                <li>Subscription</li>
                <li>Device Setup</li>
              </ul>
            </div>
            <div>
              <h6>Legal</h6>
              <ul>
                <li>Terms of Service</li>
                <li>Privacy Policy</li>
                <li>Copyright</li>
                <li>DMCA</li>
              </ul>
            </div>
          </div>
          <div className="footer-bottom">
            <span>Copyright © {new Date().getFullYear()} ABO IP TV. All rights reserved.</span>
            <span className="powered-by">
              <Bolt size={14} />
              POWERED BY SUMONIX AI
            </span>
          </div>
        </footer>
      </section>
    </main>
  );
}

function ToastContainer({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="toast-stack">
      {toasts.map((toast) => (
        <motion.div
          key={toast.id}
          className={`toast-item ${toast.type}`}
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 40 }}
          transition={{ duration: 0.28 }}
        >
          {toast.type === "success" ? <Shield size={16} /> : <Bolt size={16} />}
          <span>{toast.message}</span>
        </motion.div>
      ))}
    </div>
  );
}
