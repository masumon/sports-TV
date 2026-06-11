import { useState, useCallback } from "react";

export function usePlayerControls() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolumeState] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const togglePlay = useCallback(() => setIsPlaying((p) => !p), []);
  const toggleMute = useCallback(() => setIsMuted((m) => !m), []);
  const setVolume = useCallback((v: number) => setVolumeState(Math.max(0, Math.min(1, v))), []);
  const toggleFullscreen = useCallback(() => setIsFullscreen((f) => !f), []);

  return {
    isPlaying,
    setIsPlaying,
    isMuted,
    setIsMuted,
    volume,
    setVolume,
    showControls,
    setShowControls,
    isFullscreen,
    setIsFullscreen,
    togglePlay,
    toggleMute,
    toggleFullscreen,
  };
}
