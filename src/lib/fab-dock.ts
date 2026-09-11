const KEY = "denta-fab-dock";
const SIZE = 56;

export type FabDock = { x: number; y: number };

function navBottom() {
  if (typeof window === "undefined") return 88;
  const md = window.matchMedia("(min-width: 768px)").matches;
  return md ? 32 : 84;
}

export function defaultFabDock(): FabDock {
  if (typeof window === "undefined") return { x: 16, y: 400 };
  const w = window.innerWidth;
  const h = window.innerHeight;
  return {
    x: Math.max(8, w - 16 - SIZE),
    y: Math.max(8, h - navBottom() - SIZE),
  };
}

export function loadFabDock(extraH = 0): FabDock {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultFabDock();
    const p = JSON.parse(raw) as Partial<FabDock>;
    if (typeof p.x !== "number" || typeof p.y !== "number") return defaultFabDock();
    return clampFabDock({ x: p.x, y: p.y }, extraH);
  } catch {
    return defaultFabDock();
  }
}

export function saveFabDock(pos: FabDock, extraH = 0) {
  try {
    localStorage.setItem(KEY, JSON.stringify(clampFabDock(pos, extraH)));
  } catch {
    /* ignore */
  }
}

export function clampFabDock(pos: FabDock, extraH = 0): FabDock {
  if (typeof window === "undefined") return pos;
  const w = window.innerWidth;
  const h = window.innerHeight;
  const maxX = Math.max(8, w - SIZE - 8);
  const maxY = Math.max(8, h - SIZE - navBottom() - 8);
  const minY = 8 + extraH;
  return {
    x: Math.min(maxX, Math.max(8, pos.x)),
    y: Math.min(maxY, Math.max(minY, pos.y)),
  };
}

export const FAB_SIZE = SIZE;
