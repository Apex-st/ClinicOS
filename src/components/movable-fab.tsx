import { Plus, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  clampFabDock,
  FAB_SIZE,
  loadFabDock,
  saveFabDock,
  type FabDock,
} from "@/lib/fab-dock";
import { cn } from "@/lib/utils";

const HOLD_MS = 420;

export function MovableFab({
  open,
  onPress,
  extra,
  extraH: extraHProp,
  menu,
  label,
}: {
  open?: boolean;
  onPress: () => void;
  extra?: ReactNode;
  extraH?: number;
  menu?: ReactNode;
  label: string;
}) {
  const extraH = extraHProp ?? (extra ? 48 : 0);
  const [pos, setPos] = useState<FabDock>(() =>
    typeof window === "undefined" ? { x: 16, y: 400 } : loadFabDock(extraH),
  );
  const hold = useRef(0);
  const dragging = useRef(false);
  const skipClick = useRef(false);
  const start = useRef({ x: 0, y: 0, px: 0, py: 0 });

  useEffect(() => {
    function onResize() {
      setPos((p) => {
        const next = clampFabDock(p, extraH);
        saveFabDock(next, extraH);
        return next;
      });
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [extraH]);

  useEffect(() => {
    setPos((p) => clampFabDock(p, extraH));
  }, [extraH]);

  function clearHold() {
    window.clearTimeout(hold.current);
    hold.current = 0;
  }

  function onPointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    dragging.current = false;
    skipClick.current = false;
    start.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y };
    const pointerId = e.pointerId;
    const target = e.currentTarget;
    clearHold();
    hold.current = window.setTimeout(() => {
      dragging.current = true;
      skipClick.current = true;
      try {
        target.setPointerCapture(pointerId);
      } catch {
        /* ignore */
      }
      try {
        navigator.vibrate?.(12);
      } catch {
        /* ignore */
      }
    }, HOLD_MS);
  }

  function onPointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    const dx = e.clientX - start.current.x;
    const dy = e.clientY - start.current.y;
    if (!dragging.current) {
      if (Math.hypot(dx, dy) > 12) clearHold();
      return;
    }
    e.preventDefault();
    setPos(clampFabDock({ x: start.current.px + dx, y: start.current.py + dy }, extraH));
  }

  function onPointerUp(e: React.PointerEvent<HTMLButtonElement>) {
    clearHold();
    if (dragging.current) {
      dragging.current = false;
      setPos((p) => {
        const next = clampFabDock(p, extraH);
        saveFabDock(next, extraH);
        return next;
      });
      return;
    }
    if (skipClick.current) return;
    if (Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 10) return;
    onPress();
  }

  const flipDown = pos.y < 180;
  const alignEnd = typeof window === "undefined" ? true : pos.x + FAB_SIZE / 2 > window.innerWidth / 2;

  return (
    <div className="fixed z-[45] size-14" style={{ left: pos.x, top: pos.y }} data-movable-fab>
      {extra ? (
        <div className="absolute bottom-full left-1/2 mb-2 -translate-x-1/2" data-fab-extra>{extra}</div>
      ) : null}
      {open && menu ? (
        <div
          className={cn(
            "absolute z-[46] flex w-48 flex-col gap-2",
            flipDown ? "top-full mt-2" : extra ? "bottom-[calc(100%+3.5rem)]" : "bottom-[calc(100%+0.5rem)]",
            alignEnd ? "right-0" : "left-0",
          )}
        >
          {menu}
        </div>
      ) : null}
      <button
        type="button"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          clearHold();
          if (dragging.current) {
            dragging.current = false;
            setPos((p) => {
              const next = clampFabDock(p, extraH);
              saveFabDock(next, extraH);
              return next;
            });
          }
        }}
        onContextMenu={(e) => e.preventDefault()}
        className={cn(
          "grid size-14 place-items-center rounded-full bg-primary text-primary-fg shadow-[var(--shadow-lift)]",
          "touch-none select-none [-webkit-touch-callout:none]",
        )}
        aria-label={open ? "Закрыть" : label}
        aria-expanded={open}
      >
        {open ? <X className="size-7" strokeWidth={2.2} /> : <Plus className="size-7" strokeWidth={2.2} />}
      </button>
    </div>
  );
}
