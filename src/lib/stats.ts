import { subDays, subMonths, format, parseISO, isValid } from "date-fns";
import { optionLabel, VISIT_KIND_LABEL, VISIT_KIND_ORDER } from "./diary";
import { todayISO } from "./format";
import { diagnosisLabel, findDiagnosis } from "./icd";
import { sourceStatKey } from "./patient-meta";
import type { DiagnosisDef, DiaryTemplate, Patient, Service, Visit, VisitKind } from "./types";

export type PeriodKey = "today" | "yesterday" | "week" | "month" | "q3" | "q6" | "year" | "all" | "custom";

export const PERIOD_OPTIONS: Array<{ id: PeriodKey; label: string }> = [
  { id: "today", label: "Сегодня" },
  { id: "yesterday", label: "Вчера" },
  { id: "week", label: "Неделя" },
  { id: "month", label: "Месяц" },
  { id: "q3", label: "3 месяца" },
  { id: "q6", label: "6 месяцев" },
  { id: "year", label: "Год" },
  { id: "all", label: "Всё время" },
  { id: "custom", label: "Свой период" },
];

export function periodRange(key: PeriodKey, customFrom?: string, customTo?: string, now = new Date()) {
  const to = format(now, "yyyy-MM-dd");
  if (key === "custom") {
    return {
      from: customFrom || "2000-01-01",
      to: customTo || to,
    };
  }
  if (key === "all") return { from: "2000-01-01", to };
  if (key === "today") return { from: to, to };
  if (key === "yesterday") {
    const y = format(subDays(now, 1), "yyyy-MM-dd");
    return { from: y, to: y };
  }
  const fromDate =
    key === "week"
      ? subDays(now, 6)
      : key === "month"
        ? subMonths(now, 1)
        : key === "q3"
          ? subMonths(now, 3)
          : key === "q6"
            ? subMonths(now, 6)
            : subMonths(now, 12);
  return { from: format(fromDate, "yyyy-MM-dd"), to };
}

export function inRange(iso: string, from: string, to: string) {
  if (!iso) return false;
  const day = iso.slice(0, 10);
  return day >= from && day <= to;
}

function countMap(add: string[]) {
  const m = new Map<string, number>();
  for (const k of add) m.set(k, (m.get(k) ?? 0) + 1);
  return m;
}

export interface NamedCount {
  id: string;
  name: string;
  count: number;
  amount?: number;
}

export interface ClinicStats {
  from: string;
  to: string;
  patientsTotal: number;
  newPatients: number;
  visitsTotal: number;
  byKind: Record<VisitKind, number>;
  uniquePatients: number;
  diagnoses: NamedCount[];
  treatments: NamedCount[];
  teeth: NamedCount[];
  services: NamedCount[];
  finance: {
    rendered: number;
    paid: number;
    debt: number;
    avgCheck: number;
    payments: number;
  };
  monthly: Array<{ month: string; visits: number; patients: number; paid: number }>;
  bySource: NamedCount[];
}

export function buildClinicStats(
  visits: Visit[],
  patients: Patient[],
  services: Service[],
  range: { from: string; to: string },
  doctorId?: string,
  diagnosesCatalog: DiagnosisDef[] = [],
): ClinicStats {
  const scoped = visits.filter((v) => {
    if (v.voidedAt) return false;
    if (!inRange(v.date, range.from, range.to)) return false;
    if (doctorId && (v.doctorId || "") !== doctorId) return false;
    return true;
  });

  const byKind: Record<VisitKind, number> = { primary: 0, repeat: 0, control: 0, emergency: 0 };
  const dx: string[] = [];
  const tx: string[] = [];
  const teeth: string[] = [];
  const svcCount = new Map<string, { count: number; amount: number }>();
  const monthMap = new Map<string, { visits: number; patients: Set<string>; paid: number }>();

  let rendered = 0;
  let paid = 0;
  let payments = 0;
  const unique = new Set<string>();

  for (const v of scoped) {
    const kind = (v.kind && byKind[v.kind] != null ? v.kind : "repeat") as VisitKind;
    byKind[kind] += 1;
    unique.add(v.patientId);
    rendered += v.total;
    paid += v.paid;
    if (v.paid > 0) payments += 1;

    const month = v.date.slice(0, 7);
    const bucket = monthMap.get(month) ?? { visits: 0, patients: new Set<string>(), paid: 0 };
    bucket.visits += 1;
    bucket.patients.add(v.patientId);
    bucket.paid += v.paid;
    monthMap.set(month, bucket);

    const visitTeeth = new Set<string>();
    for (const item of v.items) {
      const cur = svcCount.get(item.serviceId) ?? { count: 0, amount: 0 };
      cur.count += item.qty || 1;
      cur.amount += item.price * (item.qty || 1);
      svcCount.set(item.serviceId, cur);
      if (item.toothFdi) visitTeeth.add(String(item.toothFdi));
    }

    const findings = v.diary?.findings ?? [];
    for (const f of findings) {
      if (f.diagnosisId || f.diagnosisText) {
        const d = findDiagnosis(diagnosesCatalog, f.diagnosisId);
        dx.push(d?.name || f.diagnosisId || "other");
      }
      for (const t of f.treatments) tx.push(t);
      if (f.toothFdi) visitTeeth.add(String(f.toothFdi));
    }
    teeth.push(...visitTeeth);
  }

  const dxMap = countMap(dx);
  const txMap = countMap(tx);
  const toothMap = countMap(teeth);

  const diagnoses: NamedCount[] = [...dxMap.entries()]
    .map(([id, count]) => {
      const d = findDiagnosis(diagnosesCatalog, id);
      return { id, name: d ? diagnosisLabel(d) : optionLabel("diagnosis", id, diagnosesCatalog), count };
    })
    .sort((a, b) => b.count - a.count);
  const treatments: NamedCount[] = [...txMap.entries()]
    .map(([id, count]) => ({ id, name: optionLabel("treatments", id), count }))
    .sort((a, b) => b.count - a.count);
  const teethList: NamedCount[] = [...toothMap.entries()]
    .map(([id, count]) => ({ id, name: `${id} зуб`, count }))
    .sort((a, b) => b.count - a.count);

  const serviceList: NamedCount[] = [...svcCount.entries()]
    .map(([id, v]) => ({
      id,
      name: services.find((s) => s.id === id)?.name ?? "Услуга",
      count: v.count,
      amount: v.amount,
    }))
    .sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0));

  const monthly = [...monthMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({
      month,
      visits: v.visits,
      patients: v.patients.size,
      paid: v.paid,
    }));

  const newPatientsList = patients.filter((p) => inRange((p.createdAt || "").slice(0, 10) || p.createdAt, range.from, range.to));
  const newPatients = newPatientsList.length;
  const sourceMap = new Map<string, number>();
  for (const p of newPatientsList) {
    const k = sourceStatKey(p);
    sourceMap.set(k, (sourceMap.get(k) ?? 0) + 1);
  }
  const bySource: NamedCount[] = [...sourceMap.entries()]
    .map(([name, count]) => ({ id: name, name, count }))
    .sort((a, b) => b.count - a.count);

  return {
    from: range.from,
    to: range.to,
    patientsTotal: patients.length,
    newPatients,
    visitsTotal: scoped.length,
    byKind,
    uniquePatients: unique.size,
    diagnoses,
    treatments,
    teeth: teethList,
    services: serviceList,
    finance: {
      rendered,
      paid,
      debt: Math.max(0, rendered - paid),
      avgCheck: scoped.length ? Math.round(rendered / scoped.length) : 0,
      payments,
    },
    monthly,
    bySource,
  };
}

export function statsToCsv(stats: ClinicStats) {
  const lines = [
    `Период;${stats.from};${stats.to}`,
    `Всего пациентов;${stats.patientsTotal}`,
    `Новых пациентов;${stats.newPatients}`,
    ...stats.bySource.map((s) => `Источник ${s.name};${s.count}`),
    `Всего приёмов;${stats.visitsTotal}`,
    ...VISIT_KIND_ORDER.map((k) => `${VISIT_KIND_LABEL[k]};${stats.byKind[k]}`),
    "",
    "Диагнозы;зубов",
    ...stats.diagnoses.map((d) => `${d.name};${d.count}`),
    "",
    "Процедуры;количество",
    ...stats.treatments.map((d) => `${d.name};${d.count}`),
    "",
    "Услуги;количество;сумма",
    ...stats.services.map((d) => `${d.name};${d.count};${d.amount ?? 0}`),
  ];
  return "\uFEFF" + lines.join("\n");
}

export function seedDiaryTemplates(): DiaryTemplate[] {
  return [
    { id: "tpl_primary", name: "Первичный терапевтический приём", complaints: ["cold", "short"], anamnesis: ["recent", "untreated"], exam: ["cavity", "perc_ok"], recommendations: ["hygiene", "return"], treatments: [] },
    { id: "tpl_repeat", name: "Повторный терапевтический приём", complaints: ["none"], anamnesis: ["treated"], exam: ["filling"], recommendations: ["follow", "hygiene"], treatments: [] },
    { id: "tpl_caries", name: "Лечение кариеса", complaints: ["cold", "sweet"], anamnesis: ["days"], exam: ["cavity"], recommendations: ["no_food", "hygiene"], treatments: ["anesthesia", "prep", "med", "filling"] },
    { id: "tpl_pulpitis", name: "Лечение пульпита", complaints: ["spontaneous", "acute"], anamnesis: ["worse"], exam: ["cavity", "perc_pain"], recommendations: ["return", "pain"], treatments: ["anesthesia", "endo", "canal_mech", "temp_fill"] },
    { id: "tpl_endo", name: "Эндодонтическое лечение", complaints: ["aching"], anamnesis: ["treated"], exam: ["perc_pain"], recommendations: ["return"], treatments: ["endo", "canal_mech", "canal_med", "obturation"] },
    { id: "tpl_control", name: "Контрольный осмотр", complaints: ["none"], anamnesis: ["treated"], exam: ["sanitized", "hygiene_ok"], recommendations: ["hygiene"], treatments: [] },
  ];
}

export function emptyDiaryExtras() {
  return {
    complaints: [] as string[],
    anamnesis: [] as string[],
    exam: [] as string[],
    treatments: [] as string[],
    recommendations: [] as string[],
  };
}

/** unused helper kept for date sanity in custom inputs */
export function validIso(s: string) {
  try {
    return isValid(parseISO(s));
  } catch {
    return false;
  }
}

export { todayISO };
