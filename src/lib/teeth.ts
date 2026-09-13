import type { ToothState, ToothStatus, ToothStatusDef, ToothSurface } from "./types";

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

/** Молочные в смешанном прикусе стоят под постоянными 5–1, слоты 8–6 пустые. */
export function padPrimaryRow(row: readonly number[]): Array<number | null> {
  return [null, null, null, ...row.slice(0, 5), ...row.slice(5), null, null, null];
}

export const MIXED_PRIMARY_UPPER = padPrimaryRow([...PRIMARY_UPPER_RIGHT, ...PRIMARY_UPPER_LEFT]);
export const MIXED_PRIMARY_LOWER = padPrimaryRow([...PRIMARY_LOWER_RIGHT, ...PRIMARY_LOWER_LEFT]);

export const PALMER_PERM = [8, 7, 6, 5, 4, 3, 2, 1, 1, 2, 3, 4, 5, 6, 7, 8] as const;
export const PALMER_PRIM = [5, 4, 3, 2, 1, 1, 2, 3, 4, 5] as const;

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

export function suggestDentition(age: number | null | undefined): DentitionMode {
  if (age == null || !Number.isFinite(age)) return "permanent";
  if (age < 6) return "primary";
  if (age < 13) return "mixed";
  return "permanent";
}

export function parseDentition(value: unknown): DentitionMode | undefined {
  if (value === "permanent" || value === "primary" || value === "mixed") return value;
  return undefined;
}

export const TOOTH_STATUS_LABEL: Record<string, string> = {
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

export const TOOTH_STATUS_COLOR: Record<string, string> = {
  healthy: "#f6f0e4",
  caries: "#c45c4a",
  filling: "#5b6e7a",
  pulpitis: "#9b3a3a",
  periodontitis: "#b45309",
  crown: "#8a7a62",
  veneer: "#d9cfc0",
  implant: "#1f5c52",
  root: "#c4a07a",
  missing: "#e7e1d6",
  extracted: "#d3ccc0",
  bridge: "#6b6358",
};

const SURFACE_STATUSES = new Set(["caries", "filling", "pulpitis", "periodontitis"]);

export function defaultToothStatuses(): ToothStatusDef[] {
  return TOOTH_STATUS_ORDER.map((id) => ({
    id,
    label: TOOTH_STATUS_LABEL[id],
    color: TOOTH_STATUS_COLOR[id],
    usesSurfaces: SURFACE_STATUSES.has(id),
    builtin: true,
  }));
}

export function resolveToothStatuses(saved?: ToothStatusDef[] | null): ToothStatusDef[] {
  const defaults = defaultToothStatuses();
  if (!saved?.length) return defaults;
  const byId = new Map(saved.map((d) => [d.id, d]));
  const out: ToothStatusDef[] = defaults.map((d) => {
    const s = byId.get(d.id);
    if (!s) return d;
    return {
      ...d,
      label: (s.label ?? "").trim() || d.label,
      color: s.color || d.color,
      usesSurfaces: typeof s.usesSurfaces === "boolean" ? s.usesSurfaces : d.usesSurfaces,
      hidden: Boolean(s.hidden),
    };
  });
  for (const s of saved) {
    if (!s?.id || defaults.some((d) => d.id === s.id)) continue;
    const label = (s.label ?? "").trim();
    if (!label) continue;
    out.push({
      id: s.id,
      label,
      color: s.color || "#6b6358",
      usesSurfaces: Boolean(s.usesSurfaces),
      builtin: false,
      hidden: Boolean(s.hidden),
    });
  }
  return out;
}

export function visibleToothStatuses(saved?: ToothStatusDef[] | null): ToothStatusDef[] {
  return resolveToothStatuses(saved).filter((d) => !d.hidden);
}

export function toothStatusDef(id: string, saved?: ToothStatusDef[] | null): ToothStatusDef {
  return (
    resolveToothStatuses(saved).find((d) => d.id === id) ?? {
      id,
      label: TOOTH_STATUS_LABEL[id] || id,
      color: TOOTH_STATUS_COLOR[id] || "#6b6358",
      usesSurfaces: SURFACE_STATUSES.has(id),
    }
  );
}

export function toothStatusLabel(id: string, saved?: ToothStatusDef[] | null): string {
  return toothStatusDef(id, saved).label;
}

export function toothStatusColor(id: string, saved?: ToothStatusDef[] | null): string {
  return toothStatusDef(id, saved).color;
}

export function statusInk(color: string): string {
  const raw = color.replace("#", "");
  const hex = raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw;
  const n = Number.parseInt(hex, 16);
  if (!Number.isFinite(n)) return "#1c1915";
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 158 ? "#1c1915" : "#f7f3ec";
}

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
  if (s === "L") return isUpper(fdi) ? "Нёбная" : "Язычная";
  return TOOTH_SURFACE_LABEL[s];
}

/** Состояния, для которых указывают поверхность. Коронка, имплант, отсутствие — весь зуб. */
export function statusUsesSurfaces(status: ToothStatus, saved?: ToothStatusDef[] | null) {
  return toothStatusDef(status, saved).usesSurfaces;
}

export function normalizeTooth(t?: Partial<ToothState> | null): ToothState {
  const raw = typeof t?.status === "string" ? t.status.trim() : "";
  const status = raw || "healthy";
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
