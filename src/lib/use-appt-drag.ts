import { useEffect, useRef, useState, type MouseEvent, type PointerEvent as ReactPointerEvent } from "react";

export type DragGhost = {
  x: number;
  y: number;
  w: number;
  h: number;
  ox: number;
  oy: number;
};

export function slotFromPoint(x: number, y: number) {
  const stack = document.elementsFromPoint(x, y);
  for (const node of stack) {
    if (!(node instanceof Element)) continue;
    const el = node.closest("[data-slot-date]");
    if (el instanceof HTMLElement && el.dataset.slotDate) {
      return {
        date: el.dataset.slotDate,
        time: el.dataset.slotTime || undefined,
      };
    }
  }
  return null;
}

function preventMenu(e: Event) {
  e.preventDefault();
}

/** Долгое нажатие — перенос. Короткое движение — календарь едет вместе с пальцем. */
export function useApptDrag(onDrop: (date: string, time?: string) => void, onBusy?: (busy: boolean) => void) {
  const timer = useRef(0);
  const start = useRef({ x: 0, y: 0 });
  const last = useRef({ x: 0, y: 0 });
  const dragging = useRef(false);
  const skippedClick = useRef(false);
  const target = useRef<HTMLElement | null>(null);
  const winBound = useRef(false);
  const onDropRef = useRef(onDrop);
  const onBusyRef = useRef(onBusy);
  onDropRef.current = onDrop;
  onBusyRef.current = onBusy;
  const [ghost, setGhost] = useState<DragGhost | null>(null);

  const api = useRef({
    clearTimer() {
      window.clearTimeout(timer.current);
    },
    finish(_x: number, _y: number) {},
    onWinPointerMove(e: PointerEvent) {
      if (!dragging.current) return;
      last.current = { x: e.clientX, y: e.clientY };
      setGhost((g) => (g ? { ...g, x: e.clientX, y: e.clientY } : g));
    },
    onWinPointerUp(e: PointerEvent) {
      api.current.finish(e.clientX, e.clientY);
    },
    onWinTouchMove(e: TouchEvent) {
      if (!dragging.current) return;
      const t = e.touches[0];
      if (!t) return;
      e.preventDefault();
      last.current = { x: t.clientX, y: t.clientY };
      setGhost((g) => (g ? { ...g, x: t.clientX, y: t.clientY } : g));
    },
    onWinTouchEnd(e: TouchEvent) {
      if (e.touches.length > 0) return;
      api.current.finish(last.current.x, last.current.y);
    },
    bindWin() {
      if (winBound.current) return;
      winBound.current = true;
      window.addEventListener("pointermove", api.current.onWinPointerMove);
      window.addEventListener("pointerup", api.current.onWinPointerUp);
      window.addEventListener("touchmove", api.current.onWinTouchMove, { passive: false, capture: true });
      window.addEventListener("touchend", api.current.onWinTouchEnd, { capture: true });
      window.addEventListener("contextmenu", preventMenu, { capture: true });
    },
    unbindWin() {
      if (!winBound.current) return;
      winBound.current = false;
      window.removeEventListener("pointermove", api.current.onWinPointerMove);
      window.removeEventListener("pointerup", api.current.onWinPointerUp);
      window.removeEventListener("touchmove", api.current.onWinTouchMove, { capture: true });
      window.removeEventListener("touchend", api.current.onWinTouchEnd, { capture: true });
      window.removeEventListener("contextmenu", preventMenu, { capture: true });
    },
  });

  api.current.finish = (x: number, y: number) => {
    api.current.clearTimer();
    api.current.unbindWin();
    const was = dragging.current;
    dragging.current = false;
    onBusyRef.current?.(false);
    setGhost(null);
    if (!was) return;
    const hit = slotFromPoint(x, y);
    if (hit?.date) onDropRef.current(hit.date, hit.time);
  };

  function onPointerDown(e: ReactPointerEvent) {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement | null)?.closest("[data-resize]")) return;
    start.current = { x: e.clientX, y: e.clientY };
    last.current = { x: e.clientX, y: e.clientY };
    dragging.current = false;
    skippedClick.current = false;
    const card = (e.currentTarget as HTMLElement).closest("[data-appt]");
    target.current = card instanceof HTMLElement ? card : (e.currentTarget as HTMLElement);
    const handle = e.currentTarget as HTMLElement;
    const cx = e.clientX;
    const cy = e.clientY;
    const pointerId = e.pointerId;
    timer.current = window.setTimeout(() => {
      dragging.current = true;
      skippedClick.current = true;
      onBusyRef.current?.(true);
      const rect = target.current?.getBoundingClientRect();
      setGhost({
        x: last.current.x,
        y: last.current.y,
        w: rect?.width ?? 160,
        h: rect?.height ?? 40,
        ox: rect ? cx - rect.left : 40,
        oy: rect ? cy - rect.top : 16,
      });
      try {
        navigator.vibrate?.(15);
      } catch {
        /* ignore */
      }
      try {
        handle.setPointerCapture(pointerId);
      } catch {
        /* ignore */
      }
      api.current.bindWin();
    }, 280);
  }

  function onPointerMove(e: ReactPointerEvent) {
    last.current = { x: e.clientX, y: e.clientY };
    const dx = e.clientX - start.current.x;
    const dy = e.clientY - start.current.y;
    if (!dragging.current && Math.hypot(dx, dy) > 10) {
      api.current.clearTimer();
      return;
    }
    if (dragging.current) {
      e.preventDefault();
      setGhost((g) => (g ? { ...g, x: e.clientX, y: e.clientY } : g));
    }
  }

  function onPointerUp(e: ReactPointerEvent) {
    api.current.finish(e.clientX, e.clientY);
  }

  function onPointerCancel() {
    // Android WebView шлёт cancel на системный long-press. Карточку не сбрасываем.
    if (dragging.current) api.current.bindWin();
  }

  function onClickCapture(e: MouseEvent) {
    if (!skippedClick.current) return;
    e.preventDefault();
    e.stopPropagation();
    skippedClick.current = false;
  }

  function onContextMenu(e: MouseEvent) {
    e.preventDefault();
  }

  useEffect(
    () => () => {
      api.current.clearTimer();
      api.current.unbindWin();
    },
    [],
  );

  return {
    ghost,
    dragging: Boolean(ghost),
    bind: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      onClickCapture,
      onContextMenu,
    },
  };
}
