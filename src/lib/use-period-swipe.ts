import { useRef, type TouchEvent as ReactTouchEvent } from "react";

const EDGE = 36;
const MIN_DX = 56;

/** Горизонтальный свайп меняет период. С края экрана не берём — это «назад». */
export function usePeriodSwipe(
  onShift: (dir: -1 | 1) => void,
  opts: { busy?: () => boolean; enabled?: () => boolean } = {},
) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const multi = useRef(false);

  function abort() {
    start.current = null;
    multi.current = true;
  }

  function blocked(target: EventTarget | null) {
    return target instanceof Element && Boolean(target.closest("[data-swipe-row], [data-movable-fab]"));
  }

  function onTouchStart(e: ReactTouchEvent) {
    if (e.touches.length !== 1) {
      abort();
      return;
    }
    if (opts.enabled && !opts.enabled()) {
      start.current = null;
      return;
    }
    if (opts.busy?.()) {
      start.current = null;
      return;
    }
    if (blocked(e.target)) {
      start.current = null;
      return;
    }
    const t = e.touches[0];
    if (t.clientX <= EDGE) {
      start.current = null;
      return;
    }
    multi.current = false;
    start.current = { x: t.clientX, y: t.clientY };
  }

  function onTouchStartCapture(e: ReactTouchEvent) {
    if (e.touches.length > 1) abort();
  }

  function onTouchMoveCapture(e: ReactTouchEvent) {
    if (e.touches.length > 1) abort();
  }

  function onTouchEnd(e: ReactTouchEvent) {
    const s = start.current;
    start.current = null;
    if (!s || multi.current) {
      if (e.touches.length === 0) multi.current = false;
      return;
    }
    if (opts.busy?.()) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - s.x;
    const dy = Math.abs(t.clientY - s.y);
    if (Math.abs(dx) < MIN_DX || Math.abs(dx) < dy * 1.15) return;
    onShift(dx < 0 ? 1 : -1);
  }

  function onTouchCancel() {
    start.current = null;
    multi.current = false;
  }

  return {
    onTouchStart,
    onTouchStartCapture,
    onTouchMoveCapture,
    onTouchEnd,
    onTouchCancel,
  };
}
