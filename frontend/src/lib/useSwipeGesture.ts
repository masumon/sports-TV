"use client";
import { useEffect, useRef } from "react";

type SwipeDir = "left" | "right" | "up" | "down";

export function useSwipeGesture(
  ref: React.RefObject<HTMLElement | null>,
  onSwipe: (dir: SwipeDir) => void,
  minDistance = 60,
  maxVerticalRatio = 0.5
) {
  const startX = useRef(0);
  const startY = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    function onTouchStart(e: TouchEvent) {
      const t = e.touches[0];
      if (!t) return;
      startX.current = t.clientX;
      startY.current = t.clientY;
    }

    function onTouchEnd(e: TouchEvent) {
      const t = e.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - startX.current;
      const dy = t.clientY - startY.current;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);
      if (absDx < minDistance && absDy < minDistance) return;
      if (absDx >= absDy && absDy / absDx < maxVerticalRatio) {
        onSwipe(dx > 0 ? "right" : "left");
      } else if (absDy > absDx && absDx / absDy < maxVerticalRatio) {
        onSwipe(dy > 0 ? "down" : "up");
      }
    }

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [ref, onSwipe, minDistance, maxVerticalRatio]);
}
