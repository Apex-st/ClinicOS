import { seedDiaryTemplates, seedDiscountTypes, seedDoctors, seedServiceGroups } from "./seed";
import { seedDiagnoses, ensureDiagnosisTemplates } from "./icd";
import { seedMessageTemplates, seedNotifyRules } from "./messages";
import { seedTags } from "./patient-meta";
import { blobToDataUrl, getPhotoBlob } from "./photos-idb";
import { mergeOrtho, mergeProstho } from "./specialty";
import type { ClinicData } from "./store";
import type { Patient } from "./types";
import { uid } from "./utils";
import { APP_VERSION } from "./version";

export const EXPORT_FORMAT = 3;

export const EXPORT_SECTIONS = [
  { id: "patients", label: "Пациенты" },
  { id: "visits", label: "История посещений и дневники" },
  { id: "appointments", label: "Расписание" },
  { id: "charts", label: "Зубные формулы" },
  { id: "plans", label: "Планы лечения" },
  { id: "photos", label: "Фотографии" },
  { id: "services", label: "Прайс-лист и группы" },
  { id: "discounts", label: "Скидки" },
  { id: "diagnoses", label: "Диагнозы МКБ" },
  { id: "diary", label: "Шаблоны дневника" },
  { id: "messages", label: "Шаблоны сообщений и уведомления" },
  { id: "tags", label: "Группы пациентов" },
  { id: "contacts", label: "История контактов" },
  { id: "doctors", label: "Врачи" },
  { id: "settings", label: "Настройки кабинета" },
  { id: "budget", label: "Бюджет: операции, категории, план" },
  { id: "stock", label: "Склад материалов" },
] as const;

export type ExportSectionId = (typeof EXPORT_SECTIONS)[number]["id"];

export type ConflictAction = "skip" | "as_new" | "replace";

export const CONFLICT_LABEL: Record<ConflictAction, string> = {
  skip: "Пропустить",
  as_new: "Как нового",
  replace: "Заменить",
};

export interface DentaExport {
  kind: "denta-export";
  version: number;
  appVersion: string;
  exportedAt: string;
  sections: ExportSectionId[];
  data: Partial<ClinicData>;
  photoFiles?: Record<string, string>;
  photoBlobs?: Record<string, Blob>;
}

export interface ImportPreview {
  ok: true;
  file: DentaExport;
  counts: Partial<Record<ExportSectionId, number>>;
  conflicts: Patient[];
  warnings: string[];
}

export interface ImportFail {
  ok: false;
  error: string;
}

export type ParseResult = ImportPreview | ImportFail;

export interface MergePlan {
  replaceAll: boolean;
  defaultAction: ConflictAction;
  patientActions: Record<string, ConflictAction>;
  sections: ExportSectionId[];
}

export interface MergeResult {
  data: ClinicData;
  photoIdMap: Record<string, string>;
}

export function allSectionIds(): ExportSectionId[] {
  return EXPORT_SECTIONS.map((s) => s.id);
}

function pick<T>(on: boolean, incoming: T | undefined, current: T): T {
  return on && incoming != null ? incoming : current;
}

export async function buildExport(
  state: ClinicData,
  sections: ExportSectionId[],
  opts?: { embedPhotos?: boolean },
): Promise<DentaExport> {
  const set = new Set(sections);
  const data: Partial<ClinicData> = {};
  if (set.has("patients")) {
    data.patients = state.patients;
    data.orthoCards = state.orthoCards ?? {};
    data.prosthoCards = state.prosthoCards ?? {};
  }
  if (set.has("visits")) data.visits = state.visits;
  if (set.has("appointments")) data.appointments = state.appointments;
  if (set.has("charts")) data.charts = state.charts;
  if (set.has("plans")) data.plans = state.plans;
  if (set.has("photos")) {
    data.photos = state.photos;
    data.albums = state.albums ?? [];
  }
  if (set.has("services")) {
    data.services = state.services;
    data.groups = state.groups;
  }
  if (set.has("discounts")) data.discounts = state.discounts;
  if (set.has("diagnoses")) data.diagnoses = state.diagnoses;
  if (set.has("diary")) data.diaryTemplates = state.diaryTemplates;
  if (set.has("messages")) {
    data.messageTemplates = state.messageTemplates;
    data.notifyRules = state.notifyRules;
  }
  if (set.has("tags")) {
    data.tags = state.tags;
    data.customSocials = state.customSocials;
    data.customMedical = state.customMedical;
  }
  if (set.has("contacts")) data.contacts = state.contacts;
  if (set.has("doctors")) data.doctors = state.doctors;
  if (set.has("settings")) data.settings = state.settings;
  if (set.has("budget")) {
    data.budgetOps = state.budgetOps ?? [];
    data.budgetCategories = state.budgetCategories ?? [];
    data.budgetVendors = state.budgetVendors ?? [];
    data.budgetRecurring = state.budgetRecurring ?? [];
    data.budgetPlans = state.budgetPlans ?? [];
  }
  if (set.has("stock")) {
    data.stockGroups = state.stockGroups ?? [];
    data.stockItems = state.stockItems ?? [];
  }

  const photoFiles: Record<string, string> = {};
  if (set.has("photos") && opts?.embedPhotos !== false) {
    for (const ph of state.photos) {
      const blob = await getPhotoBlob(ph.id);
      if (blob) photoFiles[ph.id] = await blobToDataUrl(blob);
    }
  }

  return {
    kind: "denta-export",
    version: EXPORT_FORMAT,
    appVersion: APP_VERSION,
    exportedAt: new Date().toISOString(),
    sections,
    data,
    photoFiles: Object.keys(photoFiles).length ? photoFiles : undefined,
  };
}

export function parseExportFile(raw: unknown): ParseResult {
  if (!raw || typeof raw !== "object") return { ok: false, error: "Файл пустой или повреждён." };
  const obj = raw as Record<string, unknown>;
  const legacy = !obj.kind && Array.isArray(obj.patients) && Array.isArray(obj.services);
  const modern = obj.kind === "denta-export" && obj.data && typeof obj.data === "object";
  if (!legacy && !modern) {
    return { ok: false, error: "Это не файл экспорта Денты." };
  }

  const data = (modern ? obj.data : obj) as Partial<ClinicData>;
  const version = Number(obj.version ?? (legacy ? 2 : 0));
  if (!Number.isFinite(version) || version < 2 || version > EXPORT_FORMAT) {
    return { ok: false, error: `Неподдерживаемая версия файла (${String(obj.version ?? "нет")}).` };
  }

  const file: DentaExport = {
    kind: "denta-export",
    version,
    appVersion: typeof obj.appVersion === "string" ? obj.appVersion : "",
    exportedAt: typeof obj.exportedAt === "string" ? obj.exportedAt : "",
    sections: Array.isArray(obj.sections) ? (obj.sections as ExportSectionId[]) : inferSections(data),
    data,
    photoFiles: (obj.photoFiles as Record<string, string> | undefined) ?? undefined,
  };

  const warnings: string[] = [];
  if (version < EXPORT_FORMAT) warnings.push(`Файл версии ${version}. Текущий формат — ${EXPORT_FORMAT}. Лишние поля будут пропущены.`);
  if (!data.patients?.length && file.sections.includes("patients")) warnings.push("В файле нет карточек пациентов.");
  if (file.sections.includes("photos") && !file.photoFiles) warnings.push("Фотографии отмечены, но файлы снимков в экспорте отсутствуют.");

  return {
    ok: true,
    file,
    counts: countSections(file),
    conflicts: [],
    warnings,
  };
}

function inferSections(data: Partial<ClinicData>): ExportSectionId[] {
  const out: ExportSectionId[] = [];
  if (data.patients || data.orthoCards || data.prosthoCards) out.push("patients");
  if (data.visits) out.push("visits");
  if (data.appointments) out.push("appointments");
  if (data.charts) out.push("charts");
  if (data.plans) out.push("plans");
  if (data.photos) out.push("photos");
  if (data.services || data.groups) out.push("services");
  if (data.discounts) out.push("discounts");
  if (data.diagnoses) out.push("diagnoses");
  if (data.diaryTemplates) out.push("diary");
  if (data.messageTemplates || data.notifyRules) out.push("messages");
  if (data.tags || data.customSocials || data.customMedical) out.push("tags");
  if (data.contacts) out.push("contacts");
  if (data.doctors) out.push("doctors");
  if (data.settings) out.push("settings");
  if (data.budgetOps || data.budgetCategories || data.budgetVendors || data.budgetRecurring || data.budgetPlans) {
    out.push("budget");
  }
  if (data.stockGroups || data.stockItems) out.push("stock");
  return out;
}

function countSections(file: DentaExport): Partial<Record<ExportSectionId, number>> {
  const d = file.data;
  return {
    patients: d.patients?.length,
    visits: d.visits?.length,
    appointments: d.appointments?.length,
    charts: d.charts ? Object.keys(d.charts).length : undefined,
    plans: d.plans?.length,
    photos: d.photos?.length,
    services: d.services?.length,
    discounts: d.discounts?.length,
    diagnoses: d.diagnoses?.length,
    diary: d.diaryTemplates?.length,
    messages: d.messageTemplates?.length,
    tags: d.tags?.length,
    contacts: d.contacts?.length,
    doctors: d.doctors?.length,
    settings: d.settings ? 1 : undefined,
    budget: (d.budgetOps?.length ?? 0) + (d.budgetCategories?.length ?? 0),
    stock: (d.stockItems?.length ?? 0) + (d.stockGroups?.length ?? 0),
  };
}

export function patientConflicts(current: ClinicData, file: DentaExport): Patient[] {
  const have = new Set(current.patients.map((p) => p.id));
  return (file.data.patients ?? []).filter((p) => have.has(p.id));
}

function mergeList<T extends { id: string }>(
  current: T[],
  incoming: T[] | undefined,
  enabled: boolean,
  replaceAll: boolean,
  actionFor: (item: T) => ConflictAction,
  remap: (item: T, newId: string) => T,
  idMap?: Record<string, string>,
): T[] {
  if (!enabled) return current;
  const src = incoming ?? [];
  if (replaceAll) {
    if (idMap) for (const item of src) idMap[item.id] = item.id;
    return src;
  }
  const map = new Map(current.map((x) => [x.id, x]));
  for (const item of src) {
    const exists = map.has(item.id);
    if (!exists) {
      map.set(item.id, item);
      if (idMap) idMap[item.id] = item.id;
      continue;
    }
    const action = actionFor(item);
    if (action === "skip") continue;
    if (action === "replace") {
      map.set(item.id, item);
      if (idMap) idMap[item.id] = item.id;
      continue;
    }
    const nid = uid(item.id.split("_")[0] || "id");
    map.set(nid, remap(item, nid));
    if (idMap) idMap[item.id] = nid;
  }
  return [...map.values()];
}

export function mergeExport(current: ClinicData, file: DentaExport, plan: MergePlan): MergeResult {
  const on = new Set(plan.sections);
  const now = new Date().toISOString();
  const patientIdMap: Record<string, string> = {};
  const skippedPatients = new Set<string>();
  const photoIdMap: Record<string, string> = {};

  const incomingPatients = file.data.patients ?? [];
  let patients = current.patients;
  if (on.has("patients")) {
    if (plan.replaceAll) {
      patients = incomingPatients;
      for (const p of incomingPatients) patientIdMap[p.id] = p.id;
    } else {
      const map = new Map(current.patients.map((p) => [p.id, p]));
      for (const p of incomingPatients) {
        const exists = map.has(p.id);
        if (!exists) {
          map.set(p.id, p);
          patientIdMap[p.id] = p.id;
          continue;
        }
        const action = plan.patientActions[p.id] ?? plan.defaultAction;
        if (action === "skip") {
          skippedPatients.add(p.id);
          continue;
        }
        if (action === "replace") {
          map.set(p.id, { ...p, updatedAt: now });
          patientIdMap[p.id] = p.id;
          continue;
        }
        const nid = uid("p");
        map.set(nid, { ...p, id: nid, createdAt: now, updatedAt: now });
        patientIdMap[p.id] = nid;
      }
      patients = [...map.values()];
    }
  } else {
    for (const p of current.patients) patientIdMap[p.id] = p.id;
  }

  const mapPid = (pid: string) => {
    if (skippedPatients.has(pid)) return null;
    if (patientIdMap[pid]) return patientIdMap[pid];
    if (!on.has("patients")) return pid;
    return null;
  };

  const visits = mergeList(
    current.visits,
    (file.data.visits ?? []).flatMap((v) => {
      const pid = mapPid(v.patientId);
      if (pid == null) return [];
      return [{ ...v, patientId: pid }];
    }),
    on.has("visits"),
    plan.replaceAll,
    () => plan.defaultAction,
    (v, id) => ({ ...v, id }),
  );

  const appointments = mergeList(
    current.appointments,
    (file.data.appointments ?? []).flatMap((a) => {
      const pid = mapPid(a.patientId);
      if (pid == null) return [];
      return [{ ...a, patientId: pid }];
    }),
    on.has("appointments"),
    plan.replaceAll,
    () => plan.defaultAction,
    (a, id) => ({ ...a, id }),
  );

  const plans = mergeList(
    current.plans,
    (file.data.plans ?? []).flatMap((pl) => {
      const pid = mapPid(pl.patientId);
      if (pid == null) return [];
      return [{ ...pl, patientId: pid }];
    }),
    on.has("plans"),
    plan.replaceAll,
    () => plan.defaultAction,
    (pl, id) => ({ ...pl, id }),
  );

  const contacts = mergeList(
    current.contacts,
    (file.data.contacts ?? []).flatMap((c) => {
      const pid = mapPid(c.patientId);
      if (pid == null) return [];
      return [{ ...c, patientId: pid }];
    }),
    on.has("contacts"),
    plan.replaceAll,
    () => plan.defaultAction,
    (c, id) => ({ ...c, id }),
  );

  const photos = mergeList(
    current.photos,
    (file.data.photos ?? []).flatMap((ph) => {
      const pid = mapPid(ph.patientId);
      if (pid == null) return [];
      return [{ ...ph, patientId: pid }];
    }),
    on.has("photos"),
    plan.replaceAll,
    () => plan.defaultAction,
    (ph, id) => ({ ...ph, id }),
    photoIdMap,
  );
  if (on.has("photos")) {
    for (const ph of file.data.photos ?? []) {
      if (photoIdMap[ph.id]) continue;
      const pid = mapPid(ph.patientId);
      if (pid == null) continue;
      if (plan.replaceAll) photoIdMap[ph.id] = ph.id;
    }
    for (const ph of photos) {
      const orig = (file.data.photos ?? []).find((x) => photoIdMap[x.id] === ph.id);
      if (orig && !photoIdMap[orig.id]) photoIdMap[orig.id] = ph.id;
    }
  }

  const albums = mergeList(
    current.albums ?? [],
    (file.data.albums ?? []).flatMap((a) => {
      const pid = mapPid(a.patientId);
      if (pid == null) return [];
      return [{ ...a, patientId: pid }];
    }),
    on.has("photos"),
    plan.replaceAll,
    () => plan.defaultAction,
    (a, id) => ({ ...a, id }),
  );

  let charts = current.charts;
  if (on.has("charts")) {
    if (plan.replaceAll) {
      charts = file.data.charts ?? {};
    } else {
      charts = { ...current.charts };
      for (const [pid, chart] of Object.entries(file.data.charts ?? {})) {
        const mapped = mapPid(pid);
        if (mapped == null) continue;
        const exists = Boolean(charts[mapped]);
        const action = exists ? plan.defaultAction : "replace";
        if (action === "skip") continue;
        charts[mapped] = chart;
      }
    }
  }

  const services = mergeList(
    current.services,
    file.data.services,
    on.has("services"),
    plan.replaceAll,
    () => plan.defaultAction,
    (s, id) => ({ ...s, id }),
  );
  const groups = mergeList(
    current.groups,
    file.data.groups,
    on.has("services"),
    plan.replaceAll,
    () => plan.defaultAction,
    (g, id) => ({ ...g, id }),
  );
  const discounts = mergeList(
    current.discounts.length ? current.discounts : seedDiscountTypes(),
    file.data.discounts,
    on.has("discounts"),
    plan.replaceAll,
    () => plan.defaultAction,
    (d, id) => ({ ...d, id }),
  );
  const diagnoses = ensureDiagnosisTemplates(
    mergeList(
      current.diagnoses.length ? current.diagnoses : seedDiagnoses(),
      file.data.diagnoses,
      on.has("diagnoses"),
      plan.replaceAll,
      () => plan.defaultAction,
      (d, id) => ({ ...d, id }),
    ),
  );
  const diaryTemplates = mergeList(
    current.diaryTemplates.length ? current.diaryTemplates : seedDiaryTemplates(),
    file.data.diaryTemplates,
    on.has("diary"),
    plan.replaceAll,
    () => plan.defaultAction,
    (t, id) => ({ ...t, id }),
  );
  const messageTemplates = mergeList(
    current.messageTemplates.length ? current.messageTemplates : seedMessageTemplates(),
    file.data.messageTemplates,
    on.has("messages"),
    plan.replaceAll,
    () => plan.defaultAction,
    (t, id) => ({ ...t, id }),
  );
  const notifyRules = mergeList(
    current.notifyRules.length ? current.notifyRules : seedNotifyRules(),
    file.data.notifyRules,
    on.has("messages"),
    plan.replaceAll,
    () => plan.defaultAction,
    (r, id) => ({ ...r, id }),
  );
  const tags = mergeList(
    current.tags.length ? current.tags : seedTags(),
    file.data.tags,
    on.has("tags"),
    plan.replaceAll,
    () => plan.defaultAction,
    (t, id) => ({ ...t, id }),
  );
  const doctors = mergeList(
    current.doctors.length ? current.doctors : seedDoctors(),
    file.data.doctors,
    on.has("doctors"),
    plan.replaceAll,
    () => plan.defaultAction,
    (d, id) => ({ ...d, id }),
  );
  const budgetOps = mergeList(
    current.budgetOps ?? [],
    (file.data.budgetOps ?? []).flatMap((o) => {
      const next = { ...o };
      if (o.patientId) {
        const pid = mapPid(o.patientId);
        if (pid == null) delete next.patientId;
        else next.patientId = pid;
      }
      return [next];
    }),
    on.has("budget"),
    plan.replaceAll,
    () => plan.defaultAction,
    (o, id) => ({ ...o, id }),
  );
  const budgetCategories = mergeList(
    current.budgetCategories?.length ? current.budgetCategories : [],
    file.data.budgetCategories,
    on.has("budget"),
    plan.replaceAll,
    () => plan.defaultAction,
    (c, id) => ({ ...c, id }),
  );
  const budgetVendors = mergeList(
    current.budgetVendors ?? [],
    file.data.budgetVendors,
    on.has("budget"),
    plan.replaceAll,
    () => plan.defaultAction,
    (v, id) => ({ ...v, id }),
  );
  const budgetRecurring = mergeList(
    current.budgetRecurring ?? [],
    file.data.budgetRecurring,
    on.has("budget"),
    plan.replaceAll,
    () => plan.defaultAction,
    (r, id) => ({ ...r, id }),
  );
  const budgetPlans = on.has("budget")
    ? plan.replaceAll
      ? (file.data.budgetPlans ?? [])
      : [...(current.budgetPlans ?? []).filter((p) => !(file.data.budgetPlans ?? []).some((x) => x.month === p.month)), ...(file.data.budgetPlans ?? [])]
    : current.budgetPlans ?? [];
  const stockGroups = mergeList(
    current.stockGroups?.length ? current.stockGroups : [],
    file.data.stockGroups,
    on.has("stock"),
    plan.replaceAll,
    () => plan.defaultAction,
    (g, id) => ({ ...g, id }),
  );
  const stockItems = mergeList(
    current.stockItems ?? [],
    file.data.stockItems,
    on.has("stock"),
    plan.replaceAll,
    () => plan.defaultAction,
    (m, id) => ({ ...m, id }),
  );

  const orthoCards = mergeCardMap(
    current.orthoCards ?? {},
    file.data.orthoCards,
    mapPid,
    on.has("patients"),
    plan.replaceAll,
    plan.defaultAction,
    mergeOrtho,
  );
  const prosthoCards = mergeCardMap(
    current.prosthoCards ?? {},
    file.data.prosthoCards,
    mapPid,
    on.has("patients"),
    plan.replaceAll,
    plan.defaultAction,
    mergeProstho,
  );

  return {
    data: {
      patients,
      services,
      appointments,
      visits,
      charts,
      settings: pick(on.has("settings"), file.data.settings, current.settings) ?? current.settings,
      photos,
      albums,
      plans,
      discounts,
      contacts,
      doctors,
      groups: groups.length ? groups : seedServiceGroups(),
      diaryTemplates,
      tags,
      diagnoses,
      messageTemplates,
      notifyRules,
      customSocials: on.has("tags")
        ? uniqueStrings([...(plan.replaceAll ? [] : current.customSocials), ...(file.data.customSocials ?? [])])
        : current.customSocials,
      customMedical: on.has("tags")
        ? mergeNamed(current.customMedical, file.data.customMedical, plan.replaceAll, plan.defaultAction)
        : current.customMedical,
      budgetOps,
      budgetCategories: budgetCategories.length ? budgetCategories : current.budgetCategories,
      budgetVendors,
      budgetRecurring,
      budgetPlans,
      stockGroups: stockGroups.length ? stockGroups : current.stockGroups,
      stockItems,
      orthoCards,
      prosthoCards,
    },
    photoIdMap,
  };
}

function uniqueStrings(list: string[]) {
  return [...new Set(list.map((s) => s.trim()).filter(Boolean))];
}

function mergeCardMap<T>(
  current: Record<string, T>,
  incoming: Record<string, T> | undefined,
  mapPid: (id: string) => string | null,
  enabled: boolean,
  replaceAll: boolean,
  defaultAction: ConflictAction,
  mergeFn: (pid: string, raw: T) => T,
): Record<string, T> {
  if (!enabled) return current;
  const src = incoming ?? {};
  if (replaceAll) {
    const out: Record<string, T> = {};
    for (const [pid, card] of Object.entries(src)) {
      const mapped = mapPid(pid);
      if (mapped == null) continue;
      out[mapped] = mergeFn(mapped, card);
    }
    return out;
  }
  const out: Record<string, T> = { ...current };
  for (const [pid, card] of Object.entries(src)) {
    const mapped = mapPid(pid);
    if (mapped == null) continue;
    if (out[mapped] && defaultAction === "skip") continue;
    out[mapped] = mergeFn(mapped, card);
  }
  return out;
}

function mergeNamed(
  current: { id: string; name: string }[],
  incoming: { id: string; name: string }[] | undefined,
  replaceAll: boolean,
  action: ConflictAction,
) {
  if (!incoming) return current;
  if (replaceAll) return incoming;
  const map = new Map(current.map((x) => [x.id, x]));
  for (const item of incoming) {
    if (!map.has(item.id)) {
      map.set(item.id, item);
      continue;
    }
    if (action === "skip") continue;
    if (action === "replace") map.set(item.id, item);
    if (action === "as_new") {
      const nid = uid("med");
      map.set(nid, { ...item, id: nid });
    }
  }
  return [...map.values()];
}
