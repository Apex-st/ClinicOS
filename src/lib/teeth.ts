import type { ToothState, ToothStatus, ToothSurface } from "./types";

export const UPPER_RIGHT = [18, 17, 16, 15, 14, 13, 12, 11] as const;
export const UPPER_LEFT = [21, 22, 23, 24, 25, 26, 27, 28] as const;
export const LOWER_RIGHT = [48, 47, 46, 45, 44, 43, 42, 41] as const;
export const LOWER_LEFT = [31, 32, 33, 34, 35, 36, 37, 38] as const;

export const ALL_FDI = [
  ...UPPER_RIGHT,
  ...UPPER_LEFT,
  ...LOWER_RIGHT,
  ...LOWER_LEFT,
] as const;

export type Fdi = (typeof ALL_FDI)[number];

export function isUpper(fdi: number) {
  const q = Math.floor(fdi / 10);
  return q === 1 || q === 2;
}

export function toothKind(fdi: number): "incisor" | "canine" | "premolar" | "molar" {
  const n = fdi % 10;
  if (n <= 2) return "incisor";
  if (n === 3) return "canine";
  if (n <= 5) return "premolar";
  return "molar";
}

export const TOOTH_STATUS_LABEL: Record<ToothStatus, string> = {
  healthy: "Интактный",
  caries: "Кариес",
  filling: "Пломба",
  pulpitis: "Пульпит",
  periodontitis: "Периодонтит",
  crown: "Коронка",
  veneer: "Винир",
  implant: "Имплант",
  root: "Корень",
  missing: "Нет зуба",
  extracted: "Удалён",
  bridge: "Мост",
};

export const TOOTH_STATUS_ORDER: ToothStatus[] = [
  "healthy",
  "caries",
  "filling",
  "pulpitis",
  "periodontitis",
  "crown",
  "veneer",
  "implant",
  "root",
  "bridge",
  "missing",
  "extracted",
];

export type { ToothSurface };

export const TOOTH_SURFACES: ToothSurface[] = ["B", "M", "O", "D", "L"];

export const TOOTH_SURFACE_LABEL: Record<ToothSurface, string> = {
  B: "Вестибулярная",
  M: "Медиальная",
  O: "Жевательная",
  D: "Дистальная",
  L: "Оральная",
};

export function surfaceLabel(fdi: number, s: ToothSurface) {
  if (s === "O") return toothKind(fdi) === "incisor" || toothKind(fdi) === "canine" ? "Режущая" : "Жевательная";
  if (s === "B") return isUpper(fdi) ? "Вестибулярная" : "Вестибулярная";
  if (s === "L") return isUpper(fdi) ? "Нёбная" : "Язычная";
  return TOOTH_SURFACE_LABEL[s];
}

/** Состояния, для которых указывают поверхность. Коронка, имплант, отсутствие — весь зуб. */
export function statusUsesSurfaces(status: ToothStatus) {
  return status === "caries" || status === "filling" || status === "pulpitis" || status === "periodontitis";
}

export function normalizeTooth(t?: Partial<ToothState> | null): ToothState {
  const status = t?.status && t.status in TOOTH_STATUS_LABEL ? t.status : "healthy";
  const surfaces = t?.surfaces && typeof t.surfaces === "object" ? { ...t.surfaces } : undefined;
  const clean = surfaces
    ? (Object.fromEntries(
        Object.entries(surfaces).filter(([k, v]) => TOOTH_SURFACES.includes(k as ToothSurface) && v),
      ) as ToothState["surfaces"])
    : undefined;
  return {
    status,
    note: t?.note ?? "",
    surfaces: clean && Object.keys(clean).length ? clean : undefined,
  };
}

export function toothSurfaceStatus(state: ToothState, s: ToothSurface): ToothStatus {
  if (state.surfaces && Object.keys(state.surfaces).length) {
    return state.surfaces[s] ?? "healthy";
  }
  return state.status;
}
