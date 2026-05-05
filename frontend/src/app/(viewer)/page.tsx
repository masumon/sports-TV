"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Hls from "hls.js";

interface Channel {
  id: string;
  name: string;
  category: string;
  logoColor: string;
  url: string;
}

interface ToastItem {
  id: string;
  message: string;
  type: "success" | "error" | "info";
}

const TEST_CHANNELS: Channel[] = [
  { id: "1", name: "Sky Sports Main Event", category: "Football", logoColor: "#e50914", url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8" },
  { id: "2", name: "BT Sport 1", category: "Football", logoColor: "#0055ff", url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8" },
  { id: "3", name: "Willow TV", category: "Cricket", logoColor: "#ff9900", url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8" },
  { id: "4", name: "Sky Sports F1", category: "Motorsport", logoColor: "#00C851", url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8" },
  { id: "5", name: "Eurosport 1", category: "Multi-Sport", logoColor: "#00aaff", url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8" },
  { id: "6", name: "Star Sports 1", category: "Cricket", logoColor: "#ff0055", url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8" },
  { id: "7", name: "ESPN", category: "Multi-Sport", logoColor: "#dd0000", url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8" },
  { id: "8", name: "BeIN Sports", category: "Football", logoColor: "#5500aa", url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8" },
  { id: "9", name: "NBA TV", category: "Multi-Sport", logoColor: "#1d428a", url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8" },
  { id: "10", name: "Ten Sports", category: "Cricket", logoColor: "#008800", url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8" },
];

export default function EnterpriseDashboard() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [showStats, setShowStats] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [isLoadingVideo, setIsLoadingVideo] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  
  const [clock, setClock] = useState("");
  const [latency, setLatency] = useState(12);

  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);

  // Initialize clock and data
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setClock(now.toLocaleTimeString('en-US', { hour12: false }));
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    
    // Simulate fetching from Render Backend
    const fetchChannels = async () => {
      try {
        // Example logic for Render backend:
        // const res = await fetch('https://gstv-backend.onrender.com/api/channels');
        // const data = await res.json();
        setChannels(TEST_CHANNELS);
        setActiveChannel(TEST_CHANNELS[0]);
      } catch (err) {
        setChannels(TEST_CHANNELS);
        setActiveChannel(TEST_CHANNELS[0]);
      }
    };
    
    fetchChannels();
    
    // Load favorites from local storage
    if (typeof window !== "undefined") {
      const savedFavs = localStorage.getItem('iptv-favorites');
      if (savedFavs) {
        try {
          setFavorites(JSON.parse(savedFavs));
        } catch (e) {}
      }
    }

    return () => clearInterval(timer);
  }, []);

  // Update latency randomly to simulate ping
  useEffect(() => {
    const int = setInterval(() => {
      setLatency(10 + Math.floor(Math.random() * 8));
    }, 5000);
    return () => clearInterval(int);
  }, []);

  // HLS logic
  useEffect(() => {
    if (!activeChannel || !videoRef.current) return;
    const video = videoRef.current;
    
    setIsLoadingVideo(true);
    setIsPlaying(false);

    if (Hls.isSupported()) {
      if (hlsRef.current) hlsRef.current.destroy();
      
      const hls = new Hls({ maxBufferLength: 30 });
      hlsRef.current = hls;
      
      hls.loadSource(activeChannel.url);
      hls.attachMedia(video);
      
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {});
        setIsLoadingVideo(false);
        setIsPlaying(true);
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          switch(data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              addToast("Network error. Retrying...", "error");
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              addToast("Media error. Recovering...", "error");
              hls.recoverMediaError();
              break;
            default:
              hls.destroy();
              break;
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = activeChannel.url;
      video.addEventListener('loadedmetadata', () => {
        video.play().catch(() => {});
        setIsLoadingVideo(false);
        setIsPlaying(true);
      });
    }
    
    return () => {
      if (hlsRef.current) hlsRef.current.destroy();
    };
  }, [activeChannel]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play().catch(() => {});
    }
    setIsPlaying(!isPlaying);
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const toggleFullscreen = () => {
    if (!playerContainerRef.current) return;
    if (!document.fullscreenElement) {
      playerContainerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const addToast = useCallback((message: string, type: ToastItem["type"] = "info") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4900);
  }, []);

  const toggleFavorite = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setFavorites(prev => {
      const newFavs = prev.includes(id) ? prev.filter(fid => fid !== id) : [...prev, id];
      if (typeof window !== "undefined") {
        localStorage.setItem('iptv-favorites', JSON.stringify(newFavs));
      }
      addToast(prev.includes(id) ? "Removed from Favorites" : "Added to Favorites", "success");
      return newFavs;
    });
  };

  const handleServerSwitch = (server: string) => {
    if (!videoRef.current) return;
    videoRef.current.pause();
    setIsPlaying(false);
    setIsLoadingVideo(true);
    addToast(`Switching to ${server} server...`, "info");
    
    // Simulate reload
    setTimeout(() => {
      if (activeChannel) {
        setActiveChannel({ ...activeChannel }); // trigger reload
      }
    }, 1000);
  };

  const handleExternalPlayer = (player: string) => {
    if (!videoRef.current) return;
    videoRef.current.pause();
    setIsPlaying(false);
    addToast(`Opening stream in ${player}...`, "success");
  };

  const filteredChannels = useMemo(() => {
    return channels.filter(ch => {
      const matchesSearch = ch.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCat = activeCategory === "All" || 
                         (activeCategory === "Favorites" ? favorites.includes(ch.id) : ch.category === activeCategory);
      return matchesSearch && matchesCat;
    });
  }, [channels, searchQuery, activeCategory, favorites]);

  const navItems = [
    { label: 'All Channels', icon: 'fa-solid fa-tv', filter: 'All', badge: channels.length },
    { label: 'Favorites', icon: 'fa-solid fa-heart', filter: 'Favorites', badge: favorites.length },
    { label: 'Football', icon: 'fa-solid fa-futbol', filter: 'Football' },
    { label: 'Cricket', icon: 'fa-solid fa-baseball-bat-ball', filter: 'Cricket' },
    { label: 'Motorsport', icon: 'fa-solid fa-flag-checkered', filter: 'Motorsport' },
    { label: 'Multi-Sport', icon: 'fa-solid fa-medal', filter: 'Multi-Sport' }
  ];

  const epgItems = [
    { time: '10:00 AM', title: 'Morning Sports Review', active: false },
    { time: '12:00 PM', title: 'Live Match Analysis', active: true },
    { time: '02:00 PM', title: 'Championship Final', active: false },
    { time: '05:00 PM', title: 'Post-Match Interviews', active: false },
    { time: '08:00 PM', title: 'Evening Highlights', active: false },
  ];

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
    @import url('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css');

    :root {
      --bg-dark: #0d0d12;
      --bg-card: #1a1a24;
      --bg-hover: #262635;
      --primary-accent: #e50914;
      --success: #00C851;
      --text-main: #ffffff;
      --text-muted: #a0a0b0;
      --sidebar-width: 260px;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    body {
      font-family: 'Inter', sans-serif;
      background-color: var(--bg-dark);
      color: var(--text-main);
      overflow: hidden;
      height: 100vh;
    }

    ::-webkit-scrollbar { width: 8px; height: 8px; }
    ::-webkit-scrollbar-track { background: var(--bg-dark); }
    ::-webkit-scrollbar-thumb { background: var(--bg-hover); border-radius: 4px; }
    ::-webkit-scrollbar-thumb:hover { background: var(--text-muted); }

    .dashboard-layout {
      display: flex; height: 100vh; width: 100vw; overflow: hidden;
    }

    .sidebar {
      width: var(--sidebar-width);
      background-color: var(--bg-card);
      border-right: 1px solid rgba(255, 255, 255, 0.05);
      display: flex; flex-direction: column;
      transition: transform 0.3s ease; z-index: 40;
    }

    .sidebar-header {
      height: 70px; display: flex; align-items: center; padding: 0 24px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      font-weight: 700; font-size: 1.2rem; letter-spacing: 0.5px;
      color: var(--text-main); gap: 12px;
    }

    .sidebar-header i { color: var(--primary-accent); font-size: 1.4rem; }

    .nav-menu { flex: 1; overflow-y: auto; padding: 24px 16px; display: flex; flex-direction: column; gap: 8px; }

    .nav-item {
      display: flex; align-items: center; justify-content: space-between;
      padding: 12px 16px; border-radius: 8px; cursor: pointer;
      transition: all 0.2s ease; color: var(--text-muted); font-weight: 500;
      border: 1px solid transparent;
    }

    .nav-item:hover, .nav-item.active { background-color: var(--bg-hover); color: var(--text-main); }
    .nav-item.active { border-color: rgba(229, 9, 20, 0.3); box-shadow: inset 4px 0 0 var(--primary-accent); }

    .nav-item-left { display: flex; align-items: center; gap: 12px; }
    .nav-item-left i { font-size: 1.1rem; width: 20px; text-align: center; color: inherit; }

    .badge {
      background-color: var(--primary-accent); color: white; font-size: 0.7rem;
      font-weight: 700; padding: 2px 8px; border-radius: 12px;
    }

    .main-content { flex: 1; display: flex; flex-direction: column; overflow-y: auto; position: relative; }

    .header {
      height: 70px; display: flex; align-items: center; justify-content: space-between;
      padding: 0 24px; background-color: rgba(26, 26, 36, 0.8);
      backdrop-filter: blur(10px); border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      position: sticky; top: 0; z-index: 30; flex-shrink: 0;
    }

    .header-left { display: flex; align-items: center; gap: 16px; }

    .hamburger { display: none; background: none; border: none; color: var(--text-main); font-size: 1.2rem; cursor: pointer; }

    .search-bar { position: relative; display: flex; align-items: center; }
    .search-bar i { position: absolute; left: 14px; color: var(--text-muted); }
    .search-bar input {
      background-color: var(--bg-dark); border: 1px solid rgba(255, 255, 255, 0.1);
      color: var(--text-main); padding: 10px 16px 10px 40px; border-radius: 20px;
      font-family: inherit; font-size: 0.9rem; width: 280px; outline: none; transition: all 0.3s ease;
    }
    .search-bar input:focus { border-color: var(--primary-accent); box-shadow: 0 0 0 2px rgba(229, 9, 20, 0.2); }

    .header-right { display: flex; align-items: center; gap: 24px; }

    .network-latency {
      display: flex; align-items: center; gap: 8px; font-size: 0.8rem;
      color: var(--text-muted); background-color: var(--bg-dark);
      padding: 6px 12px; border-radius: 16px; border: 1px solid rgba(255, 255, 255, 0.05);
    }

    .dot {
      width: 8px; height: 8px; background-color: var(--success);
      border-radius: 50%; animation: pulse-green 2s infinite;
    }

    @keyframes pulse-green {
      0% { box-shadow: 0 0 0 0 rgba(0, 200, 81, 0.4); }
      70% { box-shadow: 0 0 0 6px rgba(0, 200, 81, 0); }
      100% { box-shadow: 0 0 0 0 rgba(0, 200, 81, 0); }
    }

    .live-clock { font-family: monospace; font-size: 0.9rem; font-weight: 600; color: var(--text-main); letter-spacing: 1px; }

    .header-icon {
      background: none; border: none; color: var(--text-muted); font-size: 1.2rem;
      cursor: pointer; transition: color 0.2s ease; position: relative;
    }
    .header-icon:hover { color: var(--text-main); }
    .notification-dot {
      position: absolute; top: -2px; right: -2px; width: 8px; height: 8px;
      background-color: var(--primary-accent); border-radius: 50%;
    }

    .profile-avatar {
      width: 36px; height: 36px; border-radius: 50%;
      background: linear-gradient(135deg, var(--primary-accent), #880000);
      display: flex; align-items: center; justify-content: center;
      font-weight: 700; font-size: 0.9rem; cursor: pointer;
      border: 2px solid rgba(255, 255, 255, 0.1); transition: transform 0.2s ease;
    }
    .profile-avatar:hover { transform: scale(1.05); }

    .news-ticker {
      background-color: var(--bg-hover); display: flex; align-items: center;
      height: 40px; border-bottom: 1px solid rgba(255, 255, 255, 0.05); flex-shrink: 0;
    }
    .ticker-badge {
      background-color: var(--primary-accent); color: white; padding: 0 16px;
      height: 100%; display: flex; align-items: center; font-size: 0.75rem;
      font-weight: 700; text-transform: uppercase; letter-spacing: 1px;
      position: relative; z-index: 2; box-shadow: 2px 0 10px rgba(0,0,0,0.5);
    }
    .ticker-content {
      flex: 1; overflow: hidden; white-space: nowrap; position: relative;
      display: flex; align-items: center; padding: 0 16px;
    }
    .ticker-text {
      display: inline-block; padding-left: 100%; animation: ticker 25s linear infinite;
      font-size: 0.85rem; color: var(--text-muted); font-weight: 500;
    }
    @keyframes ticker {
      0% { transform: translate3d(0, 0, 0); }
      100% { transform: translate3d(-100%, 0, 0); }
    }

    .content-wrapper { padding: 24px; display: flex; flex-direction: column; gap: 24px; }

    .player-container {
      aspect-ratio: 21 / 9; background-color: #000; border-radius: 12px;
      overflow: hidden; position: relative; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    .player-container video { width: 100%; height: 100%; object-fit: cover; }
    
    .loader-overlay {
      position: absolute; inset: 0; background-color: rgba(0, 0, 0, 0.7);
      display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; z-index: 10;
    }
    .spinner {
      width: 40px; height: 40px; border: 3px solid rgba(255, 255, 255, 0.1);
      border-top-color: var(--primary-accent); border-radius: 50%; animation: spin 1s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .control-overlay {
      position: absolute; inset: 0;
      background: linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.2) 50%, rgba(0,0,0,0.7) 100%);
      display: flex; flex-direction: column; justify-content: space-between;
      padding: 24px; opacity: 0; transition: opacity 0.3s ease; z-index: 5;
    }
    .player-container:hover .control-overlay { opacity: 1; }

    .top-controls { display: flex; justify-content: space-between; align-items: flex-start; }
    .live-badge-video {
      background-color: var(--primary-accent); color: white; padding: 4px 10px;
      border-radius: 4px; font-size: 0.75rem; font-weight: 700; display: flex; align-items: center; gap: 6px; letter-spacing: 1px;
    }
    .live-badge-video i { font-size: 0.5rem; animation: blink 1.5s infinite; }
    @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }

    .stats-overlay {
      background-color: rgba(0, 0, 0, 0.6); color: var(--success); font-family: monospace;
      font-size: 0.8rem; padding: 6px 10px; border-radius: 4px; border: 1px solid rgba(0, 200, 81, 0.3);
    }

    .center-info h2 { font-size: 2rem; font-weight: 700; text-shadow: 0 2px 4px rgba(0,0,0,0.5); margin-bottom: 8px; }
    .center-info p { font-size: 1rem; color: rgba(255,255,255,0.8); }

    .bottom-controls { display: flex; align-items: center; gap: 20px; }
    .control-btn { background: none; border: none; color: white; font-size: 1.4rem; cursor: pointer; transition: transform 0.2s ease, color 0.2s ease; }
    .control-btn:hover { transform: scale(1.1); color: var(--primary-accent); }
    .quality-badge { border: 1px solid rgba(255,255,255,0.3); padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; font-weight: 600; color: rgba(255,255,255,0.8); }
    .spacer { flex: 1; }

    .player-tools {
      display: flex; justify-content: space-between; align-items: center;
      background-color: var(--bg-card); padding: 16px; border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.05); margin-top: -8px;
    }
    .tools-group { display: flex; align-items: center; gap: 12px; }
    .tools-group label { font-size: 0.85rem; color: var(--text-muted); font-weight: 500; }
    .tool-select {
      background-color: var(--bg-dark); color: var(--text-main); border: 1px solid rgba(255, 255, 255, 0.1);
      padding: 8px 12px; border-radius: 6px; font-family: inherit; font-size: 0.85rem; outline: none; cursor: pointer;
    }
    .tool-select:focus { border-color: var(--primary-accent); }
    .tool-btn {
      background-color: var(--bg-dark); color: var(--text-main); border: 1px solid rgba(255, 255, 255, 0.1);
      padding: 8px 16px; border-radius: 6px; font-family: inherit; font-size: 0.85rem; cursor: pointer;
      transition: all 0.2s ease; display: flex; align-items: center; gap: 8px;
    }
    .tool-btn:hover { background-color: var(--bg-hover); border-color: rgba(255, 255, 255, 0.2); }

    .section-title { font-size: 1.2rem; font-weight: 700; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
    .section-title i { color: var(--primary-accent); }

    .epg-scroll { display: flex; gap: 16px; overflow-x: auto; padding-bottom: 8px; }
    .epg-item {
      background-color: var(--bg-card); border: 1px solid rgba(255, 255, 255, 0.05);
      padding: 16px; border-radius: 12px; min-width: 200px; flex-shrink: 0; transition: all 0.2s ease;
    }
    .epg-item.active { border-color: var(--primary-accent); background-color: rgba(229, 9, 20, 0.05); }
    .epg-time { font-size: 0.75rem; color: var(--primary-accent); font-weight: 700; margin-bottom: 8px; }
    .epg-title { font-size: 0.9rem; font-weight: 600; color: var(--text-main); }

    .channel-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 20px; }
    .channel-card {
      background-color: var(--bg-card); border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 12px; padding: 20px; display: flex; flex-direction: column;
      align-items: center; gap: 16px; cursor: pointer; transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
      position: relative; text-align: center;
    }
    .channel-card:hover { transform: translateY(-5px); border-color: var(--primary-accent); box-shadow: 0 10px 20px rgba(0, 0, 0, 0.4); }
    .channel-card.active { border-color: var(--primary-accent); background-color: rgba(229, 9, 20, 0.05); }
    
    .fav-btn {
      position: absolute; top: 12px; right: 12px; background: none; border: none;
      color: var(--text-muted); font-size: 1.1rem; cursor: pointer; transition: color 0.2s ease;
    }
    .fav-btn:hover, .fav-btn.active { color: var(--primary-accent); }

    .playing-indicator { position: absolute; top: 12px; left: 12px; display: flex; align-items: flex-end; gap: 2px; height: 12px; }
    .bar { width: 3px; background-color: var(--primary-accent); border-radius: 2px; animation: eq 1s ease-in-out infinite alternate; }
    .bar:nth-child(1) { animation-delay: 0s; height: 60%; }
    .bar:nth-child(2) { animation-delay: 0.2s; height: 100%; }
    .bar:nth-child(3) { animation-delay: 0.4s; height: 40%; }
    @keyframes eq { 0% { height: 30%; } 100% { height: 100%; } }

    .channel-logo {
      width: 64px; height: 64px; border-radius: 50%; display: flex; align-items: center;
      justify-content: center; font-size: 1.5rem; color: white; box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3); margin-top: 8px;
    }
    .channel-name { font-weight: 600; font-size: 1rem; }
    .channel-category {
      background-color: var(--bg-dark); color: var(--text-muted); font-size: 0.7rem;
      padding: 4px 10px; border-radius: 12px; font-weight: 500; border: 1px solid rgba(255, 255, 255, 0.05);
    }

    .footer { margin-top: auto; border-top: 1px solid rgba(255, 255, 255, 0.05); padding: 40px 24px 24px; background-color: var(--bg-card); }
    .footer-cols { display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px; margin-bottom: 40px; }
    .footer-col h4 { font-size: 0.9rem; color: var(--text-main); margin-bottom: 16px; font-weight: 600; }
    .footer-col p { font-size: 0.85rem; color: var(--text-muted); line-height: 1.6; }
    .footer-bottom { border-top: 1px solid rgba(255, 255, 255, 0.05); padding-top: 24px; text-align: center; font-size: 0.8rem; color: var(--text-muted); }
    .text-accent { color: var(--primary-accent); }

    .modal-overlay {
      position: fixed; inset: 0; background-color: rgba(0, 0, 0, 0.6); backdrop-filter: blur(8px);
      display: flex; align-items: center; justify-content: center; z-index: 100;
    }
    .modal-content {
      background-color: var(--bg-card); border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 16px; width: 100%; max-width: 400px; padding: 24px; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
    }
    .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
    .modal-header h3 { font-size: 1.2rem; font-weight: 700; }
    .close-btn { background: none; border: none; color: var(--text-muted); font-size: 1.2rem; cursor: pointer; }
    .close-btn:hover { color: var(--text-main); }
    .form-group { margin-bottom: 16px; }
    .form-group label { display: block; font-size: 0.85rem; color: var(--text-muted); margin-bottom: 8px; }
    .form-control {
      width: 100%; background-color: var(--bg-dark); border: 1px solid rgba(255, 255, 255, 0.1);
      color: var(--text-main); padding: 10px 12px; border-radius: 8px; font-family: inherit; font-size: 0.9rem; outline: none;
    }
    .form-control:focus { border-color: var(--primary-accent); }
    .primary-btn {
      width: 100%; background-color: var(--primary-accent); color: white; border: none;
      padding: 12px; border-radius: 8px; font-family: inherit; font-size: 0.9rem; font-weight: 600;
      cursor: pointer; transition: opacity 0.2s ease; margin-top: 8px;
    }
    .primary-btn:hover { opacity: 0.9; }

    .toast-container { position: fixed; top: 24px; right: 24px; display: flex; flex-direction: column; gap: 12px; z-index: 150; }
    .toast {
      background-color: var(--bg-card); border-left: 4px solid var(--primary-accent);
      color: var(--text-main); padding: 16px 20px; border-radius: 8px; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
      display: flex; align-items: center; gap: 12px; font-size: 0.9rem; font-weight: 500;
      animation: slideIn 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
    }
    .toast.success { border-left-color: var(--success); }
    .toast.info { border-left-color: #00aaff; }
    @keyframes slideIn { from { transform: translateX(120%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }

    @media (max-width: 900px) {
      .sidebar { position: fixed; height: 100vh; left: 0; top: 0; transform: translateX(-100%); }
      .sidebar.open { transform: translateX(0); }
      .hamburger { display: block; }
      .footer-cols { grid-template-columns: 1fr 1fr; }
    }
    @media (max-width: 600px) {
      .player-tools { flex-direction: column; align-items: stretch; gap: 16px; }
      .tools-group { flex-direction: column; align-items: stretch; }
      .footer-cols { grid-template-columns: 1fr; }
    }
  `;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      
      <div className="dashboard-layout">
        {/* Sidebar */}
        <aside className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
          <div className="sidebar-header">
            <i className="fa-solid fa-satellite-dish"></i>
            <span>IPTV ENTERPRISE</span>
          </div>
          <div className="nav-menu">
            {navItems.map((item, idx) => (
              <div 
                key={idx} 
                className={`nav-item ${activeCategory === item.filter ? 'active' : ''}`}
                onClick={() => { setActiveCategory(item.filter); setIsSidebarOpen(false); }}
              >
                <div className="nav-item-left">
                  <i className={item.icon}></i>
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && <span className="badge">{item.badge}</span>}
              </div>
            ))}
            
            <div style={{ margin: '20px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}></div>
            
            <div className="nav-item" onClick={() => setShowSettings(true)}>
              <div className="nav-item-left">
                <i className="fa-solid fa-gear"></i>
                <span>System Settings</span>
              </div>
            </div>
            <div className="nav-item">
              <div className="nav-item-left">
                <i className="fa-solid fa-right-from-bracket"></i>
                <span>Logout</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="main-content">
          {/* Header */}
          <header className="header">
            <div className="header-left">
              <button className="hamburger" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
                <i className="fa-solid fa-bars"></i>
              </button>
              <div className="search-bar">
                <i className="fa-solid fa-magnifying-glass"></i>
                <input 
                  type="text" 
                  placeholder="Search channels..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            <div className="header-right hidden md:flex">
              <div className="network-latency">
                <div className="dot"></div>
                <span>{latency}ms</span>
              </div>
              <div className="live-clock">{clock}</div>
              <button className="header-icon"><i className="fa-brands fa-chromecast"></i></button>
              <button className="header-icon">
                <i className="fa-regular fa-bell"></i>
                <div className="notification-dot"></div>
              </button>
              <div className="profile-avatar">MA</div>
            </div>
          </header>

          {/* News Ticker */}
          <div className="news-ticker">
            <div className="ticker-badge">Enterprise Alert</div>
            <div className="ticker-content">
              <span className="ticker-text">Welcome to IPTV Enterprise Dashboard. All systems operational. Connected to Render Backend via secure WebSocket. Enjoy the seamless 4K streaming experience.</span>
            </div>
          </div>

          <div className="content-wrapper">
            {/* Player Area */}
            <div className="player-section">
              <div className="player-container" ref={playerContainerRef}>
                <video id="videoElement" ref={videoRef} onClick={togglePlay}></video>
                
                {isLoadingVideo && (
                  <div className="loader-overlay">
                    <div className="spinner"></div>
                    <p style={{ color: 'var(--text-main)', fontWeight: 600 }}>Establishing Secure Connection...</p>
                  </div>
                )}
                
                <div className="control-overlay">
                  <div className="top-controls">
                    <div className="live-badge-video"><i className="fa-solid fa-circle"></i> LIVE STREAM</div>
                    {showStats && (
                      <div className="stats-overlay">
                        RES: 1920x1080 | BUF: 4.2s | FPS: 60
                      </div>
                    )}
                  </div>
                  <div className="center-info">
                    <h2>{activeChannel ? activeChannel.name : 'Select a Channel'}</h2>
                    <p>{activeChannel ? `${activeChannel.category} Broadcast / Live Feed` : 'Awaiting Selection'}</p>
                  </div>
                  <div className="bottom-controls">
                    <button className="control-btn" onClick={togglePlay}>
                      <i className={`fa-solid ${isPlaying ? 'fa-pause' : 'fa-play'}`}></i>
                    </button>
                    <button className="control-btn" onClick={toggleMute}>
                      <i className={`fa-solid ${isMuted ? 'fa-volume-xmark' : 'fa-volume-high'}`}></i>
                    </button>
                    <span className="quality-badge">1080p</span>
                    
                    <div className="spacer"></div>
                    
                    <button className="control-btn" onClick={() => setShowStats(!showStats)}>
                      <i className="fa-solid fa-chart-simple"></i>
                    </button>
                    <button className="control-btn" onClick={() => setShowSettings(true)}>
                      <i className="fa-solid fa-gear"></i>
                    </button>
                    <button className="control-btn" onClick={toggleFullscreen}>
                      <i className={`fa-solid ${isFullscreen ? 'fa-compress' : 'fa-expand'}`}></i>
                    </button>
                  </div>
                </div>
              </div>

              {/* Player Tools */}
              <div className="player-tools">
                <div className="tools-group">
                  <label>Edge Servers:</label>
                  <select className="tool-select" onChange={(e) => handleServerSwitch(e.target.value)}>
                    <option value="Main Node">Main Node</option>
                    <option value="Backup 1">Backup 1</option>
                    <option value="Auto Route">Auto Route</option>
                  </select>
                </div>
                <div className="tools-group">
                  <label>Open Stream With:</label>
                  <button className="tool-btn" onClick={() => handleExternalPlayer('VLC')}>
                    <i className="fa-solid fa-play"></i> VLC
                  </button>
                  <button className="tool-btn" onClick={() => handleExternalPlayer('MX Player')}>
                    <i className="fa-solid fa-mobile-screen"></i> MX Player
                  </button>
                </div>
              </div>
            </div>

            {/* EPG Row */}
            <div>
              <div className="section-title"><i className="fa-solid fa-calendar-days"></i> TV Guide</div>
              <div className="epg-scroll">
                <div className="epg-item active">
                  <div className="epg-time">NOW PLAYING</div>
                  <div className="epg-title">Live Premium Broadcast</div>
                </div>
                {epgItems.map((item, idx) => (
                  <div key={idx} className="epg-item">
                    <div className="epg-time">{item.time}</div>
                    <div className="epg-title">{item.title}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Channel Grid */}
            <div>
              <div className="section-title"><i className="fa-solid fa-border-all"></i> Channel Roster</div>
              <div className="channel-grid">
                {filteredChannels.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)', padding: '20px' }}>No channels found matching criteria.</div>
                ) : (
                  filteredChannels.map((ch) => (
                    <div 
                      key={ch.id} 
                      className={`channel-card ${activeChannel?.id === ch.id ? 'active' : ''}`}
                      onClick={() => setActiveChannel(ch)}
                    >
                      <button 
                        className={`fav-btn ${favorites.includes(ch.id) ? 'active' : ''}`}
                        onClick={(e) => toggleFavorite(e, ch.id)}
                      >
                        <i className="fa-solid fa-heart"></i>
                      </button>
                      
                      {activeChannel?.id === ch.id && isPlaying && (
                        <div className="playing-indicator">
                          <div className="bar"></div>
                          <div className="bar"></div>
                          <div className="bar"></div>
                        </div>
                      )}
                      
                      <div className="channel-logo" style={{ backgroundColor: ch.logoColor }}>
                        {ch.name.charAt(0)}
                      </div>
                      <div className="channel-name">{ch.name}</div>
                      <div className="channel-category">{ch.category}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <footer className="footer">
            <div className="footer-cols">
              <div className="footer-col">
                <h4>About Enterprise IPTV</h4>
                <p>The ultimate professional streaming architecture providing low-latency, high-availability sports broadcasting worldwide.</p>
              </div>
              <div className="footer-col">
                <h4>Quick Links</h4>
                <p>API Documentation<br/>Server Status<br/>Edge Nodes</p>
              </div>
              <div className="footer-col">
                <h4>Support</h4>
                <p>Help Center<br/>Report a Stream<br/>Contact Engineering</p>
              </div>
              <div className="footer-col">
                <h4>System Status</h4>
                <p style={{ color: 'var(--success)' }}><i className="fa-solid fa-circle-check"></i> All Systems Operational</p>
                <p>Render Backend: Connected</p>
              </div>
            </div>
            <div className="footer-bottom">
              Architected & Developed with <i className="fa-solid fa-bolt text-accent"></i> by Mumain Ahmed | ABO Enterprise
            </div>
          </footer>
        </main>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>System Settings</h3>
              <button className="close-btn" onClick={() => setShowSettings(false)}><i className="fa-solid fa-xmark"></i></button>
            </div>
            <div className="form-group">
              <label>Target Video Quality</label>
              <select className="form-control">
                <option>Auto (Adaptive)</option>
                <option>1080p60 (Premium)</option>
                <option>720p</option>
                <option>480p</option>
              </select>
            </div>
            <div className="form-group">
              <label>HLS Buffer Length (seconds)</label>
              <input type="number" className="form-control" defaultValue={30} />
            </div>
            <div className="form-group">
              <label>Hardware Acceleration</label>
              <select className="form-control">
                <option>Enabled (Recommended)</option>
                <option>Disabled</option>
              </select>
            </div>
            <button 
              className="primary-btn" 
              onClick={() => { setShowSettings(false); addToast('Settings applied successfully.', 'success'); }}
            >
              Apply Changes
            </button>
          </div>
        </div>
      )}

      {/* Toasts */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.type}`}>
            <i className={`fa-solid ${t.type === 'success' ? 'fa-circle-check' : t.type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-info'}`}></i>
            {t.message}
          </div>
        ))}
      </div>
    </>
  );
}
