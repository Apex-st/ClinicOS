import { useRef, type MouseEvent as RE, type PointerEvent as PE } from "react";

/** Долгое нажатие (~0.5 с) или правая кнопка. После срабатывания клик глушится. */
export function useLongPress(onLong: () => void, ms = 500) {
  const timer = useRef<number | null>(null);
  const fired = useRef(false);
  const start = useRef({ x: 0, y: 0 });

  function clear() {
    if (timer.current != null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }

  function onPointerDown(e: PE<HTMLElement>) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    fired.current = false;
    start.current = { x: e.clientX, y: e.clientY };
    clear();
    timer.current = window.setTimeout(() => {
      fired.current = true;
      onLong();
    }, ms);
  }

  function onPointerMove(e: PE<HTMLElement>) {
    if (timer.current == null) return;
    if (Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 12) clear();
  }

  function onPointerUp() {
    clear();
  }

  function onClick(e: RE<HTMLElement>) {
    if (!fired.current) return;
    e.preventDefault();
    e.stopPropagation();
    fired.current = false;
  }

  function onContextMenu(e: RE<HTMLElement>) {
    e.preventDefault();
    clear();
    fired.current = true;
    onLong();
  }

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel: clear,
    onClick,
    onContextMenu,
  };
}
