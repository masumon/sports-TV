import { useRef, useCallback } from "react";
import { downgradeHlsQuality, upgradeHlsQuality } from "@/lib/hlsPlayback";
import type Hls from "hls.js";

export function useStreamHealth() {
  const stallCountRef = useRef(0);
  const hlsRecoveryRef = useRef(0);

  const recordStall = useCallback(() => {
    stallCountRef.current += 1;
  }, []);

  const recordError = useCallback(() => {
    hlsRecoveryRef.current += 1;
  }, []);

  const downgradeQuality = useCallback((hls: Hls | null) => {
    if (hls) downgradeHlsQuality(hls);
  }, []);

  const upgradeQuality = useCallback((hls: Hls | null) => {
    if (hls) upgradeHlsQuality(hls);
  }, []);

  const reset = useCallback(() => {
    stallCountRef.current = 0;
    hlsRecoveryRef.current = 0;
  }, []);

  return {
    stallCountRef,
    hlsRecoveryRef,
    recordStall,
    recordError,
    downgradeQuality,
    upgradeQuality,
    reset,
  };
}
