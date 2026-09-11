import { useEffect, useLayoutEffect, useRef, useState } from "react";

/** Щипок масштабирует через CSS transform — без перестройки сетки на каждый кадр. */
export function usePinchZoom(
  zoom: number,
  onZoom: (z: number) => void,
  opts: { min?: number; max?: number } = {},
) {
  const min = opts.min ?? 1;
  const max = opts.max ?? 2.8;
  const scroller = useRef<HTMLDivElement>(null);
  const sizer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const pinch = useRef<{
    dist: number;
    zoom: number;
    contentX: number;
    contentY: number;
  } | null>(null);
  const pan = useRef<{ x: number; y: number; sl: number; st: number } | null>(null);
  const liveZ = useRef(zoom);
  const lastScroll = useRef({ l: 0, t: 0 });
  const onZoomRef = useRef(onZoom);
  onZoomRef.current = onZoom;
  const wheelTimer = useRef<number>(0);
  const [pinching, setPinching] = useState(false);

  function clamp(z: number) {
    return Math.min(max, Math.max(min, z));
  }

  function paint(z: number, scroll?: { l: number; t: number }) {
    const sc = scroller.current;
    const sz = sizer.current;
    const inn = inner.current;
    if (!sc || !sz || !inn) return;
    sz.style.width = `${z * 100}%`;
    inn.style.width = `${100 / Math.max(0.01, z)}%`;
    inn.style.transform = `scale(${z})`;
    inn.style.transformOrigin = "0 0";
    sz.style.height = `${inn.offsetHeight * z}px`;
    const next = scroll ?? lastScroll.current;
    sc.scrollLeft = next.l;
    sc.scrollTop = next.t;
    lastScroll.current = { l: sc.scrollLeft, t: sc.scrollTop };
  }

  useLayoutEffect(() => {
    liveZ.current = zoom;
    if (!pinch.current) paint(zoom, lastScroll.current);
  }, [zoom]);

  useEffect(() => {
    const node = scroller.current;
    if (!node) return;
    const el: HTMLDivElement = node;

    el.style.touchAction = "none";

    function mid(a: Touch, b: Touch) {
      const rect = el.getBoundingClientRect();
      return {
        midX: (a.clientX + b.clientX) / 2 - rect.left,
        midY: (a.clientY + b.clientY) / 2 - rect.top,
        dist: Math.max(1, Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)),
      };
    }

    function beginPinch(e: TouchEvent) {
      const m = mid(e.touches[0], e.touches[1]);
      const z = liveZ.current;
      pinch.current = {
        dist: m.dist,
        zoom: z,
        contentX: (el.scrollLeft + m.midX) / Math.max(0.01, z),
        contentY: (el.scrollTop + m.midY) / Math.max(0.01, z),
      };
      pan.current = null;
      lastScroll.current = { l: el.scrollLeft, t: el.scrollTop };
      setPinching(true);
    }

    function commitZoom() {
      pinch.current = null;
      setPinching(false);
      lastScroll.current = { l: el.scrollLeft, t: el.scrollTop };
      paint(liveZ.current, lastScroll.current);
      onZoomRef.current(liveZ.current);
    }

    function isAppt(t: EventTarget | null) {
      return t instanceof Element && Boolean(t.closest("[data-appt], [data-resize]"));
    }

    function onTouchStart(e: TouchEvent) {
      if (e.touches.length >= 2) {
        e.preventDefault();
        e.stopPropagation();
        beginPinch(e);
        return;
      }
      if (e.touches.length === 1 && !isAppt(e.target)) {
        pan.current = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
          sl: el.scrollLeft,
          st: el.scrollTop,
        };
      }
    }

    function onTouchMove(e: TouchEvent) {
      const inside = e.target instanceof Node && el.contains(e.target);
      if (e.touches.length >= 2) {
        if (!pinch.current && !inside) return;
        e.preventDefault();
        e.stopPropagation();
        if (!pinch.current) beginPinch(e);
        const p = pinch.current;
        if (!p) return;
        const m = mid(e.touches[0], e.touches[1]);
        const z = clamp((p.zoom * m.dist) / p.dist);
        liveZ.current = z;
        const scroll = { l: p.contentX * z - m.midX, t: p.contentY * z - m.midY };
        lastScroll.current = scroll;
        paint(z, scroll);
        return;
      }
      const p = pan.current;
      if (!p || e.touches.length !== 1) return;
      if (liveZ.current > 1.02 || pinch.current) e.preventDefault();
      el.scrollLeft = p.sl - (e.touches[0].clientX - p.x);
      el.scrollTop = p.st - (e.touches[0].clientY - p.y);
      lastScroll.current = { l: el.scrollLeft, t: el.scrollTop };
    }

    function onTouchEnd(e: TouchEvent) {
      if (e.touches.length >= 2) {
        e.preventDefault();
        e.stopPropagation();
        beginPinch(e);
        return;
      }
      if (pinch.current) commitZoom();
      if (e.touches.length === 1) {
        pan.current = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
          sl: el.scrollLeft,
          st: el.scrollTop,
        };
        return;
      }
      pan.current = null;
    }

    function onWheel(e: WheelEvent) {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      e.stopPropagation();
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const z0 = liveZ.current;
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : 1);
      const z = clamp(z0 * Math.exp(-dy * 0.008));
      const contentX = (el.scrollLeft + mx) / Math.max(0.01, z0);
      const contentY = (el.scrollTop + my) / Math.max(0.01, z0);
      liveZ.current = z;
      const scroll = { l: contentX * z - mx, t: contentY * z - my };
      lastScroll.current = scroll;
      paint(z, scroll);
      window.clearTimeout(wheelTimer.current);
      wheelTimer.current = window.setTimeout(() => onZoomRef.current(liveZ.current), 80);
    }

    function blockGesture(e: Event) {
      e.preventDefault();
    }

    const listen: AddEventListenerOptions = { passive: false, capture: true };
    el.addEventListener("touchstart", onTouchStart, listen);
    el.addEventListener("touchmove", onTouchMove, listen);
    el.addEventListener("touchend", onTouchEnd, listen);
    el.addEventListener("touchcancel", onTouchEnd, listen);
    window.addEventListener("touchmove", onTouchMove, listen);
    window.addEventListener("touchend", onTouchEnd, listen);
    window.addEventListener("touchcancel", onTouchEnd, listen);
    el.addEventListener("wheel", onWheel, listen);
    el.addEventListener("gesturestart", blockGesture, listen);
    el.addEventListener("gesturechange", blockGesture, listen);
    el.addEventListener("gestureend", blockGesture, listen);

    return () => {
      window.clearTimeout(wheelTimer.current);
      el.removeEventListener("touchstart", onTouchStart, listen);
      el.removeEventListener("touchmove", onTouchMove, listen);
      el.removeEventListener("touchend", onTouchEnd, listen);
      el.removeEventListener("touchcancel", onTouchEnd, listen);
      window.removeEventListener("touchmove", onTouchMove, listen);
      window.removeEventListener("touchend", onTouchEnd, listen);
      window.removeEventListener("touchcancel", onTouchEnd, listen);
      el.removeEventListener("wheel", onWheel, listen);
      el.removeEventListener("gesturestart", blockGesture, listen);
      el.removeEventListener("gesturechange", blockGesture, listen);
      el.removeEventListener("gestureend", blockGesture, listen);
    };
  }, [min, max]);

  return { scroller, sizer, inner, pinching };
}
