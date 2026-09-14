import type { Settings } from "./types";

export const PDF_DOC_IDS = ["diary", "plan", "ortho", "prostho", "budget"] as const;
export type PdfDocId = (typeof PDF_DOC_IDS)[number];
export type PdfLayout = Partial<Record<PdfDocId, string[]>>;

export type PdfField = { id: string; label: string };

export type PdfDocDef = {
  id: PdfDocId;
  title: string;
  hint: string;
  fields: PdfField[];
};

export const PDF_DOCS: PdfDocDef[] = [
  {
    id: "diary",
    title: "Дневник посещения",
    hint: "PDF из приёма",
    fields: [
      { id: "clinic", label: "Шапка клиники" },
      { id: "patient", label: "Пациент" },
      { id: "birth", label: "Дата рождения" },
      { id: "card", label: "№ карты" },
      { id: "date", label: "Дата приёма" },
      { id: "doctor", label: "Врач" },
      { id: "kind", label: "Тип приёма" },
      { id: "complaints", label: "Жалобы" },
      { id: "anamnesis", label: "Анамнез" },
      { id: "exam", label: "Объективно" },
      { id: "extra", label: "Дополнительные исследования" },
      { id: "diagnosis", label: "Диагноз" },
      { id: "treatment", label: "Лечение" },
      { id: "recommendations", label: "Рекомендации" },
      { id: "next", label: "Следующий приём" },
      { id: "services", label: "Услуги и оплата" },
      { id: "signatures", label: "Подписи" },
    ],
  },
  {
    id: "plan",
    title: "План лечения",
    hint: "PDF из карточки плана",
    fields: [
      { id: "clinic", label: "Шапка клиники" },
      { id: "patient", label: "Пациент" },
      { id: "birth", label: "Дата рождения" },
      { id: "card", label: "№ карты" },
      { id: "date", label: "Дата составления" },
      { id: "doctor", label: "Врач" },
      { id: "odontogram", label: "Зубная формула" },
      { id: "diagnosis", label: "Диагноз по зубам" },
      { id: "groups", label: "Услуги по зубам" },
      { id: "totals", label: "Итоги и скидки" },
      { id: "signatures", label: "Подписи" },
    ],
  },
  {
    id: "ortho",
    title: "Ортодонтическая карта",
    hint: "PDF из раздела ортодонтии",
    fields: [
      { id: "clinic", label: "Шапка клиники" },
      { id: "patient", label: "Пациент" },
      { id: "birth", label: "Дата рождения" },
      { id: "card", label: "№ карты" },
      { id: "doctor", label: "Врач" },
      { id: "complaints", label: "Жалобы" },
      { id: "anamnesis", label: "Анамнез" },
      { id: "face", label: "Внешний осмотр" },
      { id: "oral", label: "Полость рта" },
      { id: "bite", label: "Прикус" },
      { id: "arches", label: "Зубные ряды" },
      { id: "teeth", label: "Зубы" },
      { id: "measurements", label: "Измерения" },
      { id: "studies", label: "Диагностика" },
      { id: "diagnosis", label: "Диагноз" },
      { id: "plan", label: "План" },
      { id: "appliance", label: "Аппарат" },
      { id: "visits", label: "Дневник" },
      { id: "retention", label: "Ретенция" },
      { id: "epicrisis", label: "Эпикриз" },
    ],
  },
  {
    id: "prostho",
    title: "Ортопедическая карта",
    hint: "PDF из раздела ортопедии",
    fields: [
      { id: "clinic", label: "Шапка клиники" },
      { id: "patient", label: "Пациент" },
      { id: "birth", label: "Дата рождения" },
      { id: "card", label: "№ карты" },
      { id: "doctor", label: "Врач" },
      { id: "complaints", label: "Жалобы" },
      { id: "anamnesis", label: "Анамнез" },
      { id: "exam", label: "Осмотр" },
      { id: "occlusion", label: "Окклюзия / ВНЧС" },
      { id: "teeth", label: "Зубы" },
      { id: "diagnosis", label: "Диагноз" },
      { id: "plan", label: "План" },
      { id: "constructions", label: "Конструкции" },
      { id: "visits", label: "Дневник" },
      { id: "result", label: "Результат" },
    ],
  },
  {
    id: "budget",
    title: "Бюджет",
    hint: "Финансовый отчёт PDF",
    fields: [
      { id: "clinic", label: "Шапка клиники" },
      { id: "title", label: "Название отчёта" },
      { id: "period", label: "Период" },
      { id: "totals", label: "Доходы, расходы, прибыль" },
      { id: "categories", label: "Расходы по категориям" },
      { id: "operations", label: "Список операций" },
    ],
  },
];

export const DIARY_BODY_BY_TITLE: Record<string, string> = {
  "Тип приёма": "kind",
  Жалобы: "complaints",
  Анамнез: "anamnesis",
  Объективно: "exam",
  "Дополнительные исследования": "extra",
  Диагноз: "diagnosis",
  Лечение: "treatment",
  Рекомендации: "recommendations",
  "Следующий приём": "next",
};

export function normalizePdfLayout(raw: unknown): PdfLayout {
  if (!raw || typeof raw !== "object") return {};
  const src = raw as Record<string, unknown>;
  const out: PdfLayout = {};
  for (const id of PDF_DOC_IDS) {
    const v = src[id];
    if (Array.isArray(v)) out[id] = v.filter((x): x is string => typeof x === "string");
  }
  return out;
}

/** Поле включено, если его нет в списке скрытых. Пустой список — все поля. */
export function pdfOn(settings: Settings | undefined, doc: PdfDocId, field: string): boolean {
  const hidden = settings?.pdfLayout?.[doc];
  if (!hidden?.length) return true;
  return !hidden.includes(field);
}

export function setPdfHidden(current: PdfLayout | undefined, doc: PdfDocId, field: string, on: boolean): PdfLayout {
  const hidden = new Set(current?.[doc] ?? []);
  if (on) hidden.delete(field);
  else hidden.add(field);
  return { ...current, [doc]: [...hidden] };
}

export function resetPdfDoc(current: PdfLayout | undefined, doc: PdfDocId): PdfLayout {
  const next = { ...current };
  delete next[doc];
  return next;
}
