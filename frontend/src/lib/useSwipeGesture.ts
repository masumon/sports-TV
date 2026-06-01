"use client";
import { useEffect, useRef } from "react";

type SwipeDir = "left" | "right" | "up" | "down";

/** Returns true if the element or any ancestor up to `root` is horizontally scrollable with real overflow. */
function isInsideHorizontalScroll(target: EventTarget | null, root: HTMLElement): boolean {
  let node = target as Element | null;
  while (node && node !== root) {
    if (
      node.getAttribute("data-swipe-ignore") === "true" ||
      node.scrollWidth > node.clientWidth + 2
    ) {
      const style = window.getComputedStyle(node);
      if (style.overflowX === "auto" || style.overflowX === "scroll") return true;
    }
    if (node.getAttribute("data-swipe-ignore") === "true") return true;
    node = node.parentElement;
  }
  return false;
}

export function useSwipeGesture(
  ref: React.RefObject<HTMLElement | null>,
  onSwipe: (dir: SwipeDir) => void,
  minDistance = 80,
  maxVerticalRatio = 0.45
) {
  const startX = useRef(0);
  const startY = useRef(0);
  const originTarget = useRef<EventTarget | null>(null);
  const blocked = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    function onTouchStart(e: TouchEvent) {
      const t = e.touches[0];
      if (!t) return;
      startX.current = t.clientX;
      startY.current = t.clientY;
      originTarget.current = e.target;
      blocked.current = isInsideHorizontalScroll(e.target, el!);
    }

    function onTouchEnd(e: TouchEvent) {
      if (blocked.current) return;
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
