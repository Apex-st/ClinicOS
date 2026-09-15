import type { DiagnosisDef } from "./types";

/** Official ICD-10 codes, chapter K00–K14 (WHO). Do not invent codes. */
export const DIAGNOSIS_CATEGORIES = [
  { id: "therapy", name: "Терапия" },
  { id: "endo", name: "Эндодонтия" },
  { id: "paro", name: "Пародонтология" },
  { id: "surgery", name: "Хирургия" },
  { id: "ortho", name: "Ортопедия / ортодонтия" },
  { id: "other", name: "Другие" },
] as const;

export const DIAGNOSIS_CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  DIAGNOSIS_CATEGORIES.map((c) => [c.id, c.name]),
);

export function defaultDiagnosisTemplate(d: Pick<DiagnosisDef, "displayName" | "code">): string {
  return d.code ? `${d.displayName} (${d.code})` : d.displayName;
}

function dx(
  id: string,
  name: string,
  displayName: string,
  code: string,
  description: string,
  category: string,
): DiagnosisDef {
  const row = { id, name, displayName, code, description, category, template: "" };
  return { ...row, template: defaultDiagnosisTemplate(row) };
}

export function seedDiagnoses(): DiagnosisDef[] {
  return [
    dx("dx_k02", "caries", "Кариес зуба", "K02", "Кариес зубов", "therapy"),
    dx("dx_k02_0", "caries_enamel", "Кариес эмали", "K02.0", "Кариес, ограниченный эмалью", "therapy"),
    dx("dx_k02_1", "caries_dentin", "Кариес дентина", "K02.1", "Кариес дентина", "therapy"),
    dx("dx_k02_2", "caries_cement", "Кариес цемента", "K02.2", "Кариес цемента", "therapy"),
    dx("dx_k02_3", "caries_arrested", "Кариес приостановившийся", "K02.3", "Приостановившийся кариес", "therapy"),
    dx("dx_k02_9", "caries_unspec", "Кариес неуточнённый", "K02.9", "Кариес зубов неуточнённый", "therapy"),
    dx("dx_k03_2", "erosion", "Эрозия зубов", "K03.2", "Эрозия зубов", "therapy"),
    dx("dx_k03_0", "attrition", "Повышенная стираемость", "K03.0", "Повышенное стирание зубов", "therapy"),
    dx("dx_k04_0", "pulpitis", "Пульпит", "K04.0", "Пульпит", "endo"),
    dx("dx_k04_1", "pulp_necrosis", "Некроз пульпы", "K04.1", "Некроз пульпы", "endo"),
    dx("dx_k04_4", "acute_apical", "Острый апикальный периодонтит", "K04.4", "Острый апикальный периодонтит пульпарного происхождения", "endo"),
    dx("dx_k04_5", "periodontitis", "Хронический апикальный периодонтит", "K04.5", "Хронический апикальный периодонтит", "endo"),
    dx("dx_k04_7", "apical_abscess", "Периапикальный абсцесс", "K04.7", "Периапикальный абсцесс без свища", "endo"),
    dx("dx_k05_0", "gingivitis_acute", "Острый гингивит", "K05.0", "Острый гингивит", "paro"),
    dx("dx_k05_1", "gingivitis", "Хронический гингивит", "K05.1", "Хронический гингивит", "paro"),
    dx("dx_k05_3", "periodontal", "Хронический пародонтит", "K05.3", "Хронический пародонтит", "paro"),
    dx("dx_k01_1", "impacted", "Ретенированный зуб", "K01.1", "Импактные зубы", "surgery"),
    dx("dx_k08_1", "missing", "Потеря зубов", "K08.1", "Потеря зубов вследствие несчастного случая, удаления или локальной болезни пародонта", "surgery"),
    dx("dx_k08_3", "retained_root", "Оставшийся корень зуба", "K08.3", "Оставшийся корень зуба", "surgery"),
    dx("dx_k07_4", "malocclusion", "Аномалия прикуса", "K07.4", "Аномалия прикуса неуточнённая", "ortho"),
    dx("dx_k00_6", "eruption", "Нарушения прорезывания", "K00.6", "Нарушения прорезывания зубов", "other"),
    dx("dx_esthetic", "esthetic", "Эстетическая проблема", "", "Внутренний шаблон без кода МКБ", "other"),
  ];
}

export function ensureDiagnosisTemplates(list: DiagnosisDef[] | undefined): DiagnosisDef[] {
  const seed = seedDiagnoses();
  if (!list?.length) return seed;
  const byId = new Map(list.map((d) => [d.id, d]));
  const byName = new Map(list.map((d) => [d.name, d]));
  const out = list.map((d) => {
    const base = {
      ...d,
      displayName: d.displayName || d.name,
      code: d.code ?? "",
      description: d.description ?? "",
      category: d.category || "other",
    };
    return { ...base, template: cleanDiagnosisTemplate(d.template, base) };
  });
  for (const s of seed) {
    if (!byId.has(s.id) && !byName.has(s.name)) out.push(s);
  }
  return out;
}

export function findDiagnosis(list: DiagnosisDef[], id: string | undefined): DiagnosisDef | undefined {
  if (!id) return undefined;
  return list.find((d) => d.id === id) || list.find((d) => d.name === id);
}

export function diagnosisLabel(d: DiagnosisDef) {
  return d.code ? `${d.displayName} (${d.code})` : d.displayName;
}

export function diagnosisOptionLabel(id: string, catalog?: DiagnosisDef[]) {
  const list = catalog?.length ? catalog : seedDiagnoses();
  const d = findDiagnosis(list, id);
  if (d) return diagnosisLabel(d);
  return id;
}

export function applyDiagnosisTemplate(
  d: DiagnosisDef,
  vars: { tooth?: number; complaints?: string; exam?: string },
) {
  const tpl = cleanDiagnosisTemplate(d.template, d);
  const filled = tpl
    .replaceAll("{Зуб}", vars.tooth != null ? String(vars.tooth) : "")
    .replaceAll("{Жалобы}", vars.complaints?.trim() || "")
    .replaceAll("{Объективные данные}", vars.exam?.trim() || "")
    .replaceAll("{Диагноз}", d.displayName);
  return sanitizeDiagnosisText(filled) || diagnosisLabel(d);
}

/** Убирает из текста диагноза «Жалобы» и «Объективно» — они живут в своих пунктах дневника. */
export function sanitizeDiagnosisText(text: string): string {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const kept: string[] = [];
  for (const line of lines) {
    if (/^(Жалобы|Объективно)\s*:/i.test(line)) continue;
    if (/^Зуб\s*:/i.test(line)) continue;
    const dx = line.match(/^Диагноз\s*:\s*(.*)$/i);
    if (dx) {
      if (dx[1].trim()) kept.push(dx[1].trim());
      continue;
    }
    kept.push(line);
  }
  return kept.join("\n").trim();
}

function cleanDiagnosisTemplate(
  template: string | undefined,
  d: Pick<DiagnosisDef, "displayName" | "code">,
): string {
  const raw = (template ?? "").trim();
  if (!raw) return defaultDiagnosisTemplate(d);
  if (/\{Жалобы\}|\{Объективные данные\}|^\s*(Жалобы|Объективно)\s*:/im.test(raw)) {
    const stripped = raw
      .split(/\r?\n/)
      .filter((line) => !/^\s*(Жалобы|Объективно)\s*:/i.test(line))
      .join("\n")
      .trim();
    if (!stripped || /^Зуб:\s*\{Зуб\}\s*\nДиагноз:\s*/i.test(stripped)) {
      return defaultDiagnosisTemplate(d);
    }
    return stripped;
  }
  return raw;
}
