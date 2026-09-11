import { useEffect, useRef, type PointerEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const ACTIONS = 72;
const AXIS = 8;

export function SwipeRow({
  open,
  onOpenChange,
  actions,
  children,
  className,
  onTap,
  width = ACTIONS,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actions: ReactNode;
  children: ReactNode;
  className?: string;
  onTap?: () => void;
  width?: number;
}) {
  const track = useRef<HTMLDivElement>(null);
  const startX = useRef(0);
  const startY = useRef(0);
  const origin = useRef(0);
  const axis = useRef<"x" | "y" | null>(null);
  const dragging = useRef(false);
  const lastX = useRef(0);
  const suppressClick = useRef(false);
  const snap = Math.max(24, width * 0.45);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    el.style.transition = "transform 180ms var(--ease-out)";
    el.style.transform = `translateX(${open ? -width : 0}px)`;
    lastX.current = open ? -width : 0;
  }, [open, width]);

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    dragging.current = true;
    axis.current = null;
    startX.current = e.clientX;
    startY.current = e.clientY;
    origin.current = open ? -width : 0;
    lastX.current = origin.current;
    const el = track.current;
    if (el) el.style.transition = "none";
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!dragging.current) return;
    const dx = e.clientX - startX.current;
    const dy = e.clientY - startY.current;
    if (axis.current == null) {
      if (Math.abs(dx) < AXIS && Math.abs(dy) < AXIS) return;
      if (Math.abs(dy) > Math.abs(dx)) {
        axis.current = "y";
        dragging.current = false;
        return;
      }
      axis.current = "x";
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* synthetic events / some browsers */
      }
    }
    if (axis.current !== "x") return;
    e.preventDefault();
    const next = Math.max(-width - 28, Math.min(20, origin.current + dx));
    lastX.current = next;
    if (track.current) track.current.style.transform = `translateX(${next}px)`;
  }

  function finish(e: PointerEvent<HTMLDivElement>) {
    if (!dragging.current && axis.current !== "x") {
      dragging.current = false;
      axis.current = null;
      return;
    }
    const wasX = axis.current === "x";
    dragging.current = false;
    axis.current = null;
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      /* ignore */
    }
    if (!wasX) return;
    suppressClick.current = true;
    window.setTimeout(() => {
      suppressClick.current = false;
    }, 80);
    const shouldOpen = lastX.current < -snap;
    onOpenChange(shouldOpen);
    const el = track.current;
    if (el) {
      el.style.transition = "transform 180ms var(--ease-out)";
      el.style.transform = `translateX(${shouldOpen ? -width : 0}px)`;
    }
  }

  return (
    <div data-swipe-row={open ? "open" : "closed"} className="relative overflow-hidden">
      <div className="absolute inset-y-0 right-0 flex" aria-hidden={!open} inert={!open || undefined}>
        {actions}
      </div>
      <div
        ref={track}
        className={cn("relative z-[1] touch-pan-y select-none bg-surface", className)}
        style={{ transform: `translateX(${open ? -width : 0}px)` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finish}
        onPointerCancel={finish}
        onContextMenu={(e) => {
          e.preventDefault();
          onOpenChange(true);
        }}
        onClick={() => {
          if (suppressClick.current) return;
          if (open) {
            onOpenChange(false);
            return;
          }
          onTap?.();
        }}
      >
        {children}
      </div>
    </div>
  );
}
