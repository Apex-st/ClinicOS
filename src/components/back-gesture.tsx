import { useRouter, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

const EDGE = 32;
const MIN_DX = 56;
const SECOND_MS = 1800;

function atHistoryRoot() {
  const state = window.history.state;
  return Boolean(state && typeof state === "object" && (state as { __grokPreviewBridgeRoot?: boolean }).__grokPreviewBridgeRoot);
}

function locKey(pathname: string, hash: string) {
  const h = hash.replace(/^#/, "");
  return h ? `${pathname}#${h}` : pathname;
}

function closeOpenOverlay() {
  const dlg = document.querySelector('[role="dialog"][data-state="open"], [role="dialog"]:not([aria-hidden="true"])');
  if (!dlg) return false;
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  return true;
}

export function BackGesture() {
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const hash = useRouterState({ select: (s) => s.location.hash ?? "" });
  const startX = useRef<number | null>(null);
  const startY = useRef(0);
  const tracking = useRef(false);
  const lastRootSwipe = useRef(0);
  const key = locKey(pathname, hash);
  const stack = useRef<string[]>([key]);
  const goBackRef = useRef<() => boolean>(() => false);

  useEffect(() => {
    const cur = stack.current;
    if (cur[cur.length - 1] !== key) cur.push(key);
    if (cur.length > 48) cur.splice(0, cur.length - 48);
  }, [key]);

  useEffect(() => {
    goBackRef.current = () => {
      if (closeOpenOverlay()) return true;

      const cur = stack.current;
      if (cur.length > 1) {
        cur.pop();
        const prev = cur[cur.length - 1] || "/";
        router.history.push(prev);
        return true;
      }

      const h = (hash || "").replace(/^#/, "");
      if (h) {
        router.history.push(pathname);
        return true;
      }

      if (pathname !== "/") {
        router.history.push("/");
        return true;
      }

      if (!atHistoryRoot()) {
        try {
          router.history.back();
          return true;
        } catch {
          /* stay */
        }
      }

      const now = Date.now();
      if (now - lastRootSwipe.current < SECOND_MS) {
        lastRootSwipe.current = 0;
        void import("@capacitor/app")
          .then(({ App }) => (typeof App.minimizeApp === "function" ? App.minimizeApp() : App.exitApp()))
          .catch(() => undefined);
        return true;
      }
      lastRootSwipe.current = now;
      toast.message("Ещё раз с края — свернуть. Сейчас это «назад».");
      return true;
    };
  }, [pathname, hash, router]);

  useEffect(() => {
    let removeNative: (() => void) | undefined;
    void import("@capacitor/app")
      .then(async ({ App }) => {
        const { Capacitor } = await import("@capacitor/core");
        if (!Capacitor.isNativePlatform()) return;
        const sub = await App.addListener("backButton", () => {
          goBackRef.current();
        });
        removeNative = () => {
          void sub.remove();
        };
      })
      .catch(() => undefined);

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      if (t.clientX > EDGE) {
        tracking.current = false;
        startX.current = null;
        return;
      }
      tracking.current = true;
      startX.current = t.clientX;
      startY.current = t.clientY;
    };

    const onMove = (e: TouchEvent) => {
      if (!tracking.current || startX.current == null) return;
      const t = e.touches[0];
      const dx = t.clientX - startX.current;
      const dy = Math.abs(t.clientY - startY.current);
      if (dx > 16 && dx > dy) {
        e.preventDefault();
      }
    };

    const onEnd = (e: TouchEvent) => {
      if (!tracking.current || startX.current == null) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - startX.current;
      const dy = Math.abs(t.clientY - startY.current);
      tracking.current = false;
      startX.current = null;
      if (dx < MIN_DX || dy > dx) return;
      goBackRef.current();
    };

    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      removeNative?.();
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
    };
  }, []);

  return null;
}
