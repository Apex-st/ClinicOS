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

export const PRIMARY_UPPER_RIGHT = [55, 54, 53, 52, 51] as const;
export const PRIMARY_UPPER_LEFT = [61, 62, 63, 64, 65] as const;
export const PRIMARY_LOWER_RIGHT = [85, 84, 83, 82, 81] as const;
export const PRIMARY_LOWER_LEFT = [71, 72, 73, 74, 75] as const;

export const ALL_PRIMARY_FDI = [
  ...PRIMARY_UPPER_RIGHT,
  ...PRIMARY_UPPER_LEFT,
  ...PRIMARY_LOWER_RIGHT,
  ...PRIMARY_LOWER_LEFT,
] as const;

export const ALL_CHART_FDI = [...ALL_FDI, ...ALL_PRIMARY_FDI] as const;

export type Fdi = (typeof ALL_CHART_FDI)[number];

export type DentitionMode = "permanent" | "primary" | "mixed";

export const DENTITION_MODE_OPTIONS: readonly (readonly [DentitionMode, string])[] = [
  ["permanent", "Постоянный"],
  ["primary", "Молочный"],
  ["mixed", "Смешанный"],
];

export function isPrimary(fdi: number) {
  const q = Math.floor(fdi / 10);
  return q >= 5 && q <= 8;
}

export function isUpper(fdi: number) {
  const q = Math.floor(fdi / 10);
  return q === 1 || q === 2 || q === 5 || q === 6;
}

export function toothKind(fdi: number): "incisor" | "canine" | "premolar" | "molar" {
  const n = fdi % 10;
  if (isPrimary(fdi)) {
    if (n <= 2) return "incisor";
    if (n === 3) return "canine";
    return "molar";
  }
  if (n <= 2) return "incisor";
  if (n === 3) return "canine";
  if (n <= 5) return "premolar";
  return "molar";
}

export function toothTypeName(fdi: number): string {
  const n = fdi % 10;
  if (isPrimary(fdi)) {
    if (n === 1) return "Центральный резец";
    if (n === 2) return "Боковой резец";
    if (n === 3) return "Клык";
    if (n === 4) return "Первый моляр";
    return "Второй моляр";
  }
  if (n === 1) return "Центральный резец";
  if (n === 2) return "Боковой резец";
  if (n === 3) return "Клык";
  if (n === 4) return "Первый премоляр";
  if (n === 5) return "Второй премоляр";
  if (n === 6) return "Первый моляр";
  if (n === 7) return "Второй моляр";
  return "Третий моляр";
}

export const PERMANENT_TYPE_LEGEND: readonly { n: number; label: string; sample: number }[] = [
  { n: 1, label: "Центральный резец (1)", sample: 11 },
  { n: 2, label: "Боковой резец (2)", sample: 12 },
  { n: 3, label: "Клык (3)", sample: 13 },
  { n: 4, label: "Первый премоляр (4)", sample: 14 },
  { n: 5, label: "Второй премоляр (5)", sample: 15 },
  { n: 6, label: "Первый моляр (6)", sample: 16 },
  { n: 7, label: "Второй моляр (7)", sample: 17 },
  { n: 8, label: "Третий моляр (8)", sample: 18 },
];

export const PRIMARY_TYPE_LEGEND: readonly { n: number; label: string; sample: number }[] = [
  { n: 1, label: "Центральный резец (1)", sample: 51 },
  { n: 2, label: "Боковой резец (2)", sample: 52 },
  { n: 3, label: "Клык (3)", sample: 53 },
  { n: 4, label: "Первый моляр (4)", sample: 54 },
  { n: 5, label: "Второй моляр (5)", sample: 55 },
];

export function suggestDentition(age: number | null | undefined): DentitionMode {
  if (age == null || !Number.isFinite(age)) return "permanent";
  if (age < 6) return "primary";
  if (age < 13) return "mixed";
  return "permanent";
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

export const FDI_SELECT_GROUPS: readonly { label: string; values: readonly number[] }[] = [
  { label: "Постоянные", values: ALL_FDI },
  { label: "Молочные", values: ALL_PRIMARY_FDI },
];
