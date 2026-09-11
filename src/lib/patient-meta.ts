import type { MedicalFlag, Patient, PatientSourceKind, PatientTag } from "./types";

export const SOURCE_KIND_ORDER: PatientSourceKind[] = [
  "none",
  "patient",
  "social",
  "internet",
  "nearby",
  "search",
  "ads",
  "family",
  "other",
];

export const SOURCE_KIND_LABEL: Record<PatientSourceKind, string> = {
  none: "Не указано",
  patient: "Другой пациент",
  social: "Социальные сети",
  internet: "Интернет",
  nearby: "Проходил рядом",
  search: "Поиск",
  ads: "Реклама",
  family: "Рекомендация родственника",
  other: "Другое",
};

export const DEFAULT_SOCIALS = ["Instagram", "Telegram", "VK", "YouTube"];

export const MEDICAL_FLAG_ORDER: MedicalFlag[] = ["allergy", "infection", "coagulation", "other"];

export const MEDICAL_FLAG_LABEL: Record<string, string> = {
  allergy: "Аллергия",
  infection: "Инфекционное заболевание",
  coagulation: "Нарушение свёртываемости крови",
  other: "Другие важные особенности",
};

export function seedTags(): PatientTag[] {
  return [
    { id: "tag_regular", name: "Постоянные", color: "ok" },
    { id: "tag_vip", name: "VIP", color: "primary" },
    { id: "tag_family", name: "Семья", color: "warn" },
    { id: "tag_staff", name: "Коллеги", color: "muted" },
  ];
}

export function sourceLabel(
  p: Patient,
  patients: Patient[],
  extraSocials: string[] = [],
) {
  if (p.sourceKind === "patient" || p.referredById) {
    const who = patients.find((x) => x.id === p.referredById);
    return who ? `Пациент: ${who.lastName} ${who.firstName}` : SOURCE_KIND_LABEL.patient;
  }
  if (p.sourceKind === "social") {
    return p.sourceSocial || extraSocials[0] || "Социальные сети";
  }
  if (p.sourceKind === "other" && p.sourceNote) return p.sourceNote;
  return SOURCE_KIND_LABEL[p.sourceKind || "none"];
}

export function sourceStatKey(p: Patient) {
  if (p.sourceKind === "social" && p.sourceSocial) return p.sourceSocial;
  if (p.sourceKind === "patient" || p.referredById) return "Рекомендации";
  if (p.sourceKind === "search") return "Поиск";
  if (!p.sourceKind || p.sourceKind === "none") return "Не указано";
  return SOURCE_KIND_LABEL[p.sourceKind];
}

export function patientHasAlert(p: Patient) {
  const flags = p.medicalFlags ?? [];
  if (flags.length > 0) return true;
  return Boolean((p.allergies || "").trim() || (p.chronic || "").trim() || (p.medicalNote || "").trim());
}

export function alertSummary(p: Patient, extra: { id: string; name: string }[] = []) {
  const parts: string[] = [];
  for (const f of p.medicalFlags ?? []) {
    const custom = extra.find((x) => x.id === f);
    parts.push(custom?.name || MEDICAL_FLAG_LABEL[f] || f);
  }
  if ((p.allergies || "").trim() && !parts.some((x) => x.toLowerCase().includes("аллерг"))) {
    parts.push(`Аллергия: ${p.allergies}`);
  }
  if ((p.chronic || "").trim()) parts.push(p.chronic);
  const note = (p.medicalNote || "").trim();
  if (note) parts.push(note);
  return parts;
}

export function fileSafe(s: string) {
  return s
    .replace(/[\\/:*?"<>|]+/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 40);
}
