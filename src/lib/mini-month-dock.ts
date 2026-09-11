const KEY = "denta-mini-month-dock";
const SIZE = 44;

export type MiniDock = { x: number; y: number };

export function defaultMiniDock(parentW: number, parentH: number): MiniDock {
  return {
    x: Math.max(8, parentW - SIZE - 8),
    y: 8,
  };
}

export function clampMiniDock(pos: MiniDock, parentW: number, parentH: number): MiniDock {
  const maxX = Math.max(8, parentW - SIZE - 8);
  const maxY = Math.max(8, parentH - SIZE - 8);
  return {
    x: Math.min(maxX, Math.max(8, pos.x)),
    y: Math.min(maxY, Math.max(8, pos.y)),
  };
}

export function loadMiniDock(parentW: number, parentH: number): MiniDock {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultMiniDock(parentW, parentH);
    const p = JSON.parse(raw) as Partial<MiniDock>;
    if (typeof p.x !== "number" || typeof p.y !== "number") return defaultMiniDock(parentW, parentH);
    return clampMiniDock({ x: p.x, y: p.y }, parentW, parentH);
  } catch {
    return defaultMiniDock(parentW, parentH);
  }
}

export function saveMiniDock(pos: MiniDock, parentW: number, parentH: number) {
  try {
    localStorage.setItem(KEY, JSON.stringify(clampMiniDock(pos, parentW, parentH)));
  } catch {
    /* ignore */
  }
}

export const MINI_SIZE = SIZE;
