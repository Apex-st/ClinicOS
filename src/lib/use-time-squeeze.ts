import { useCallback, useRef } from "react";

/** Двумя пальцами: сжать — свернуть часы, развести — развернуть. */
export function useTimeSqueeze(onCompact: (next: boolean) => void) {
  const start = useRef(0);
  const onCompactRef = useRef(onCompact);
  onCompactRef.current = onCompact;
  const clean = useRef<(() => void) | null>(null);

  const ref = useCallback((el: HTMLDivElement | null) => {
    clean.current?.();
    clean.current = null;
    if (!el) return;

    function dist(e: TouchEvent) {
      if (e.touches.length < 2) return 0;
      const a = e.touches[0];
      const b = e.touches[1];
      return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    }

    function onStart(e: TouchEvent) {
      if (e.touches.length !== 2) {
        start.current = 0;
        return;
      }
      start.current = dist(e);
    }

    function onMove(e: TouchEvent) {
      if (!start.current || e.touches.length !== 2) return;
      e.preventDefault();
      const d = dist(e);
      const delta = d - start.current;
      if (Math.abs(delta) < 28) return;
      onCompactRef.current(delta < 0);
      start.current = d;
    }

    function onEnd(e: TouchEvent) {
      if (e.touches.length < 2) start.current = 0;
    }

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onEnd);
    clean.current = () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, []);

  return { ref };
}
