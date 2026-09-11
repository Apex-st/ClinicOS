import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { snapMinutes } from "./schedule";

export type ResizeEdge = "top" | "bottom";

const HOLD_MS = 500;

export function useApptResize(
  startMin: number,
  durationMin: number,
  pxPerMin: number,
  slotMinutes: number,
  onCommit: (next: { startMin: number; durationMin: number }) => void,
  onBusy?: (busy: boolean) => void,
) {
  const origin = useRef({ y: 0, start: startMin, dur: durationMin, edge: "bottom" as ResizeEdge });
  const liveRef = useRef<{ startMin: number; durationMin: number } | null>(null);
  const armed = useRef(false);
  const holding = useRef(false);
  const timer = useRef(0);
  const winBound = useRef(false);
  const startMinRef = useRef(startMin);
  const durationRef = useRef(durationMin);
  const onCommitRef = useRef(onCommit);
  const onBusyRef = useRef(onBusy);
  startMinRef.current = startMin;
  durationRef.current = durationMin;
  onCommitRef.current = onCommit;
  onBusyRef.current = onBusy;
  const [live, setLive] = useState<{ startMin: number; durationMin: number } | null>(null);
  const step = Math.max(5, slotMinutes || 30);
  const px = Math.max(0.4, pxPerMin);

  function publish(next: { startMin: number; durationMin: number }) {
    liveRef.current = next;
    setLive(next);
  }

  const api = useRef({
    step,
    px,
    publish(_next: { startMin: number; durationMin: number }) {},
    clearTimer() {
      window.clearTimeout(timer.current);
    },
    applyDelta(clientY: number) {
      const dy = clientY - origin.current.y;
      const end = origin.current.start + origin.current.dur;
      const s = api.current.step;
      const p = api.current.px;
      if (origin.current.edge === "bottom") {
        api.current.publish({
          startMin: origin.current.start,
          durationMin: Math.max(s, origin.current.dur + dy / p),
        });
        return;
      }
      const rawStart = origin.current.start + dy / p;
      const nextStart = Math.max(0, Math.min(end - s, rawStart));
      api.current.publish({ startMin: nextStart, durationMin: Math.max(s, end - nextStart) });
    },
    commit() {},
    onWinPointerMove(e: PointerEvent) {
      if (!armed.current) {
        if (Math.abs(e.clientY - origin.current.y) > 8) api.current.clearTimer();
        return;
      }
      e.preventDefault();
      api.current.applyDelta(e.clientY);
    },
    onWinPointerUp() {
      api.current.commit();
    },
    onWinTouchMove(e: TouchEvent) {
      const t = e.touches[0];
      if (!t) return;
      if (!armed.current) {
        if (Math.abs(t.clientY - origin.current.y) > 8) api.current.clearTimer();
        return;
      }
      e.preventDefault();
      api.current.applyDelta(t.clientY);
    },
    onWinTouchEnd(e: TouchEvent) {
      if (e.touches.length > 0) return;
      api.current.commit();
    },
    bindWin() {
      if (winBound.current) return;
      winBound.current = true;
      window.addEventListener("pointermove", api.current.onWinPointerMove);
      window.addEventListener("pointerup", api.current.onWinPointerUp);
      window.addEventListener("touchmove", api.current.onWinTouchMove, { passive: false, capture: true });
      window.addEventListener("touchend", api.current.onWinTouchEnd, { capture: true });
    },
    unbindWin() {
      if (!winBound.current) return;
      winBound.current = false;
      window.removeEventListener("pointermove", api.current.onWinPointerMove);
      window.removeEventListener("pointerup", api.current.onWinPointerUp);
      window.removeEventListener("touchmove", api.current.onWinTouchMove, { capture: true });
      window.removeEventListener("touchend", api.current.onWinTouchEnd, { capture: true });
    },
  });

  api.current.step = step;
  api.current.px = px;
  api.current.publish = publish;
  api.current.commit = () => {
    api.current.clearTimer();
    api.current.unbindWin();
    holding.current = false;
    if (!armed.current) {
      liveRef.current = null;
      setLive(null);
      return;
    }
    armed.current = false;
    const next = liveRef.current;
    liveRef.current = null;
    setLive(null);
    onBusyRef.current?.(false);
    if (!next) return;
    const end = next.startMin + next.durationMin;
    const s = api.current.step;
    const snappedStart = Math.round(next.startMin / s) * s;
    const snappedEnd = Math.max(snappedStart + s, Math.round(end / s) * s);
    const committed = {
      startMin: Math.max(0, snappedStart),
      durationMin: snapMinutes(snappedEnd - snappedStart, s),
    };
    if (committed.startMin !== startMinRef.current || committed.durationMin !== durationRef.current) {
      onCommitRef.current(committed);
    }
  };

  function onHandleDown(edge: ResizeEdge) {
    return (e: ReactPointerEvent) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      origin.current = { y: e.clientY, start: startMin, dur: durationMin, edge };
      armed.current = false;
      holding.current = true;
      liveRef.current = null;
      const handle = e.currentTarget as HTMLElement;
      const pointerId = e.pointerId;
      api.current.clearTimer();
      api.current.bindWin();
      timer.current = window.setTimeout(() => {
        if (!holding.current) return;
        armed.current = true;
        publish({ startMin, durationMin });
        onBusyRef.current?.(true);
        try {
          navigator.vibrate?.(12);
        } catch {
          /* ignore */
        }
        try {
          handle.setPointerCapture(pointerId);
        } catch {
          /* ignore */
        }
      }, HOLD_MS);
    };
  }

  function onHandleMove(e: ReactPointerEvent) {
    if (!armed.current) {
      if (Math.abs(e.clientY - origin.current.y) > 8) api.current.clearTimer();
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    api.current.applyDelta(e.clientY);
  }

  function onHandleUp() {
    api.current.commit();
  }

  function onHandleCancel() {
    if (holding.current) api.current.bindWin();
  }

  useEffect(
    () => () => {
      api.current.clearTimer();
      api.current.unbindWin();
    },
    [],
  );

  const moveBind = {
    onPointerMove: onHandleMove,
    onPointerUp: onHandleUp,
    onPointerCancel: onHandleCancel,
  };

  return {
    startMin: live?.startMin ?? startMin,
    duration: live?.durationMin ?? durationMin,
    resizing: live != null,
    topBind: { onPointerDown: onHandleDown("top"), ...moveBind },
    bottomBind: { onPointerDown: onHandleDown("bottom"), ...moveBind },
  };
}
