import type { DiagnosisDef, DiaryTemplate, ToothStatus, Visit, VisitDiary, VisitFinding, VisitKind } from "./types";
import { diagnosisOptionLabel, findDiagnosis, sanitizeDiagnosisText } from "./icd";
import { uid } from "./utils";

export const VISIT_KIND_ORDER: VisitKind[] = ["primary", "repeat", "control", "emergency"];

export const VISIT_KIND_LABEL: Record<VisitKind, string> = {
  primary: "Первичный",
  repeat: "Повторный",
  control: "Контрольный",
  emergency: "Экстренный",
};

export const COMPLAINT_OPTIONS = [
  ["none", "Боль отсутствует"],
  ["bite", "Боль при накусывании"],
  ["spontaneous", "Самопроизвольная боль"],
  ["aching", "Ноющая боль"],
  ["acute", "Острая боль"],
  ["cold", "Реакция на холодное"],
  ["hot", "Реакция на горячее"],
  ["sweet", "Боль от сладкого"],
  ["short", "Кратковременная боль"],
  ["long", "Длительная боль"],
  ["swelling", "Отёк"],
  ["odor", "Неприятный запах"],
  ["bleeding", "Кровоточивость"],
  ["sensitivity", "Чувствительность зубов"],
  ["esthetic", "Эстетическая жалоба"],
  ["chewing", "Затруднение жевания"],
  ["other", "Другое"],
] as const;

export const ANAMNESIS_OPTIONS = [
  ["recent", "Жалобы появились недавно"],
  ["days", "Беспокоит несколько дней"],
  ["weeks", "Беспокоит несколько недель"],
  ["long", "Беспокоит длительное время"],
  ["treated", "Ранее проводилось лечение"],
  ["untreated", "Ранее зуб не лечился"],
  ["worse", "Симптомы усиливаются"],
  ["stable", "Симптомы не изменяются"],
  ["other", "Другое"],
] as const;

export const EXAM_OPTIONS = [
  ["sanitized", "Полость рта санирована"],
  ["hygiene_ok", "Гигиена удовлетворительная"],
  ["hygiene_bad", "Гигиена неудовлетворительная"],
  ["cavity", "Имеется кариозная полость"],
  ["filling", "Имеется пломба"],
  ["margin", "Нарушение краевого прилегания пломбы"],
  ["discolor", "Изменение цвета зуба"],
  ["perc_pain", "Болезненность при перкуссии"],
  ["perc_ok", "Перкуссия безболезненна"],
  ["cold_pos", "Реакция на холодное положительная"],
  ["hot_pos", "Реакция на горячее положительная"],
  ["mucosa_ok", "Слизистая без изменений"],
  ["mucosa_inf", "Имеется воспаление слизистой"],
  ["other", "Другое"],
] as const;

export const DIAGNOSIS_OPTIONS = [
  ["caries", "Кариес"],
  ["pulpitis", "Пульпит"],
  ["periodontitis", "Периодонтит"],
  ["noncarious", "Некариозное поражение"],
  ["gingivitis", "Гингивит"],
  ["periodontal", "Пародонтит"],
  ["missing", "Отсутствие зуба"],
  ["other", "Другой диагноз"],
] as const;

export const TREATMENT_OPTIONS = [
  ["anesthesia", "Анестезия"],
  ["prep", "Препарирование"],
  ["med", "Медикаментозная обработка"],
  ["rubber", "Наложение коффердама"],
  ["cavity", "Обработка кариозной полости"],
  ["liner_med", "Наложение лечебной прокладки"],
  ["liner_iso", "Наложение изолирующей прокладки"],
  ["filling", "Пломбирование"],
  ["restoration", "Реставрация"],
  ["endo", "Эндодонтическое лечение"],
  ["canal_mech", "Инструментальная обработка каналов"],
  ["canal_med", "Медикаментозная обработка каналов"],
  ["obturation", "Обтурация каналов"],
  ["temp_fill", "Временная пломба"],
  ["perm_fill", "Постоянная пломба"],
  ["extraction", "Удаление зуба"],
  ["hygiene", "Профессиональная гигиена"],
  ["crown", "Установка коронки"],
  ["implant", "Имплантация"],
  ["other", "Другое"],
] as const;

export const TOOTH_EXAM_OPTIONS = [
  ["cavity", "Кариозная полость"],
  ["loc_occl", "Окклюзионная"],
  ["loc_approx", "Апроксимальная"],
  ["loc_cerv", "Пришеечная"],
  ["depth_enamel", "В пределах эмали"],
  ["depth_dentin", "Дентин"],
  ["depth_deep", "Глубокий"],
  ["old_ok", "Пломба состоятельна"],
  ["old_bad", "Нарушение края пломбы"],
  ["perc_pain", "Перкуссия болезненна"],
  ["perc_ok", "Перкуссия безболезненна"],
  ["temp_cold", "Реакция на холод"],
  ["temp_hot", "Реакция на тепло"],
  ["gum_ok", "Десна без изменений"],
  ["gum_inf", "Воспаление десны"],
] as const;

export const RECOMMEND_OPTIONS = [
  ["no_food", "Не принимать пищу определённое время"],
  ["follow", "Соблюдать рекомендации врача"],
  ["hygiene", "Следить за гигиеной полости рта"],
  ["products", "Использовать рекомендованные средства гигиены"],
  ["return", "Явиться на повторный приём"],
  ["control", "Контрольный осмотр"],
  ["pain", "При возникновении боли обратиться к врачу"],
  ["other", "Другое"],
] as const;

export const NEXT_KIND_OPTIONS = [
  ["none", "Не требуется"],
  ["repeat", "Повторный приём"],
  ["control", "Контрольный осмотр"],
  ["continue", "Продолжение лечения"],
  ["prosthetics", "Ортопедический этап"],
  ["other", "Другое"],
] as const;

export type DiaryCatalog = "complaints" | "anamnesis" | "exam" | "treatments" | "recommendations";

const CATALOGS: Record<DiaryCatalog, readonly (readonly [string, string])[]> = {
  complaints: COMPLAINT_OPTIONS,
  anamnesis: ANAMNESIS_OPTIONS,
  exam: EXAM_OPTIONS,
  treatments: TREATMENT_OPTIONS,
  recommendations: RECOMMEND_OPTIONS,
};

export function optionLabel(
  catalog: DiaryCatalog | "diagnosis" | "kind" | "next" | "toothExam",
  id: string,
  diagnoses?: DiagnosisDef[],
) {
  if (catalog === "diagnosis") return diagnosisOptionLabel(id, diagnoses) || DIAGNOSIS_OPTIONS.find((x) => x[0] === id)?.[1] || id;
  if (catalog === "kind") return VISIT_KIND_LABEL[id as VisitKind] ?? id;
  if (catalog === "next") return NEXT_KIND_OPTIONS.find((x) => x[0] === id)?.[1] ?? id;
  if (catalog === "toothExam") return TOOTH_EXAM_OPTIONS.find((x) => x[0] === id)?.[1] ?? id;
  const row = CATALOGS[catalog].find((x) => x[0] === id);
  return row?.[1] ?? id;
}

export function emptyFinding(): VisitFinding {
  return {
    id: uid("vf"),
    toothFdi: undefined,
    diagnosisId: "",
    diagnosisText: "",
    treatments: [],
    treatmentNote: "",
    examNote: "",
    examChips: [],
    materialIds: [],
  };
}

export function emptyDiary(): VisitDiary {
  return {
    complaints: [],
    complaintsNote: "",
    anamnesis: [],
    anamnesisNote: "",
    exam: [],
    examNote: "",
    extra: "",
    findings: [],
    recommendations: [],
    recommendationsNote: "",
    materialIds: [],
    nextKind: "none",
    nextDate: "",
    nextTime: "",
    nextDurationMin: 30,
    nextNote: "",
    text: "",
  };
}

export function hasDiaryContent(d?: VisitDiary | null) {
  if (!d) return false;
  return Boolean(
    d.complaints.length ||
      d.complaintsNote.trim() ||
      d.anamnesis.length ||
      d.anamnesisNote.trim() ||
      d.exam.length ||
      d.examNote.trim() ||
      d.findings.length ||
      d.recommendations.length ||
      d.recommendationsNote.trim() ||
      (d.materialIds?.length ?? 0) ||
      d.text.trim() ||
      d.nextDate ||
      d.nextTime,
  );
}

function joinLabels(catalog: DiaryCatalog, ids: string[], extra: string[]) {
  return ids
    .map((id) => extra.includes(id) ? id : optionLabel(catalog, id))
    .filter(Boolean);
}

/** Skip a free-text note that only repeats chip labels. */
function uniqueNote(labels: string[], note: string) {
  const n = note.replace(/\s+/g, " ").trim();
  if (!n) return "";
  const blob = labels.join(" ").replace(/\s+/g, " ").toLowerCase();
  const nn = n.toLowerCase();
  if (blob && (blob.includes(nn) || (nn.includes(blob) && blob.length >= 8))) return "";
  if (labels.some((l) => {
    const ll = l.toLowerCase();
    return Boolean(ll) && (nn === ll || (nn.includes(ll) && ll.length >= 10));
  })) return "";
  return n;
}

export function diarySections(
  kind: VisitKind,
  diary: VisitDiary,
  extras?: Record<DiaryCatalog, string[]>,
  materials?: { id: string; name: string }[],
): Array<{ title: string; body: string }> {
  const extra = extras ?? { complaints: [], anamnesis: [], exam: [], treatments: [], recommendations: [] };
  const out: Array<{ title: string; body: string }> = [];
  out.push({ title: "Тип приёма", body: VISIT_KIND_LABEL[kind] });

  const complaints = joinLabels("complaints", diary.complaints, extra.complaints);
  const cNote = uniqueNote(complaints, diary.complaintsNote);
  if (complaints.length || cNote) {
    out.push({ title: "Жалобы", body: [...complaints, cNote].filter(Boolean).join(", ") });
  }
  const anam = joinLabels("anamnesis", diary.anamnesis, extra.anamnesis);
  const aNote = uniqueNote(anam, diary.anamnesisNote);
  if (anam.length || aNote) {
    out.push({ title: "Анамнез", body: [...anam, aNote].filter(Boolean).join("; ") });
  }
  const exam = joinLabels("exam", diary.exam, extra.exam);
  const eNote = uniqueNote(exam, diary.examNote);
  if (exam.length || eNote) {
    out.push({ title: "Объективно", body: [...exam, eNote].filter(Boolean).join("; ") });
  }
  if (diary.extra.trim()) out.push({ title: "Дополнительные исследования", body: diary.extra.trim() });
  const visitMats = (diary.materialIds ?? [])
    .map((id) => materials?.find((m) => m.id === id)?.name ?? "")
    .filter(Boolean);

  const findingDx: string[] = [];
  const findingTx: string[] = [];
  for (const f of diary.findings) {
    const tooth = f.toothFdi ? `Зуб ${f.toothFdi}` : "Зуб не указан";
    const dx = sanitizeDiagnosisText(f.diagnosisText.trim() || optionLabel("diagnosis", f.diagnosisId) || "");
    const tx = f.treatments.map((t) => (extra.treatments.includes(t) ? t : optionLabel("treatments", t)));
    const localExam = (f.examChips ?? []).map((id) => optionLabel("toothExam", id));
    const mats = (f.materialIds ?? [])
      .map((id) => materials?.find((m) => m.id === id)?.name ?? "")
      .filter(Boolean);
    const xNote = uniqueNote(localExam, f.examNote);
    const tNote = uniqueNote([...tx, ...localExam], f.treatmentNote);
    if (dx || localExam.length || xNote) {
      const bits = [dx ? `${tooth} — ${dx}` : tooth];
      if (localExam.length) bits.push(`осмотр: ${localExam.join(", ")}`);
      if (xNote) bits.push(xNote);
      findingDx.push(bits.join(". ") + ".");
    }
    if (tx.length || mats.length || tNote) {
      const bits = [tooth];
      if (tx.length) bits.push(`лечение: ${tx.join(", ")}`);
      if (mats.length) bits.push(`материалы: ${mats.join(", ")}`);
      if (tNote) bits.push(tNote);
      findingTx.push(bits.join(". ") + ".");
    }
  }
  if (findingDx.length) out.push({ title: "Диагноз", body: findingDx.join("\n") });
  const txBody = [...findingTx];
  if (visitMats.length) txBody.unshift(`материалы приёма: ${visitMats.join(", ")}`);
  if (txBody.length) out.push({ title: "Лечение", body: txBody.join("\n") });

  const rec = joinLabels("recommendations", diary.recommendations, extra.recommendations);
  const rNote = uniqueNote(rec, diary.recommendationsNote);
  if (rec.length || rNote) {
    out.push({ title: "Рекомендации", body: [...rec, rNote].filter(Boolean).join("; ") });
  }
  if (diary.nextKind !== "none" || diary.nextDate || diary.nextTime) {
    const next = optionLabel("next", diary.nextKind);
    const when = [diary.nextDate, diary.nextTime].filter(Boolean).join(" ");
    const body = `${next}${when ? `, ${when}` : ""}${diary.nextDurationMin ? `, ${diary.nextDurationMin} мин` : ""}${diary.nextNote.trim() ? `. ${diary.nextNote.trim()}` : ""}`;
    out.push({ title: "Следующий приём", body });
  }
  return out;
}

export function composeDiaryText(
  kind: VisitKind,
  diary: VisitDiary,
  extras?: Record<DiaryCatalog, string[]>,
  materials?: { id: string; name: string }[],
) {
  return diarySections(kind, diary, extras, materials)
    .map((s) => `${s.title}\n${s.body}`)
    .join("\n\n");
}

export function applyDiaryTemplate(
  diary: VisitDiary,
  tpl: DiaryTemplate,
  kind: VisitKind,
  extras?: Record<DiaryCatalog, string[]>,
  materials?: { id: string; name: string }[],
): VisitDiary {
  const materialIds = [...(tpl.materialIds ?? [])];
  const next: VisitDiary = {
    ...diary,
    complaints: [...(tpl.complaints ?? [])],
    complaintsNote: "",
    anamnesis: [...(tpl.anamnesis ?? [])],
    anamnesisNote: "",
    exam: [...(tpl.exam ?? [])],
    examNote: "",
    recommendations: [...(tpl.recommendations ?? [])],
    recommendationsNote: "",
    materialIds,
  };
  const hasDx = Boolean(tpl.diagnosisId || (tpl.diagnosisText ?? "").trim());
  const hasTx = Boolean(tpl.treatments.length || materialIds.length);
  if (hasDx || hasTx) {
    const f = diary.findings[0] ?? emptyFinding();
    next.findings = [
      {
        ...f,
        diagnosisId: hasDx ? (tpl.diagnosisId ?? "") : f.diagnosisId,
        diagnosisText: hasDx ? (tpl.diagnosisText ?? "") : f.diagnosisText,
        treatments: tpl.treatments.length ? [...tpl.treatments] : hasTx ? [] : f.treatments,
        treatmentNote: hasTx ? "" : f.treatmentNote,
        materialIds: materialIds.length ? [...materialIds] : hasTx ? [] : (f.materialIds ?? []),
      },
      ...diary.findings.slice(1),
    ];
  }
  next.text = composeDiaryText(kind, next, extras, materials);
  return next;
}

export function suggestVisitKind(visits: Visit[], patientId: string, ignoreVisitId?: string): VisitKind {
  const prior = visits.some((v) => v.patientId === patientId && v.id !== ignoreVisitId);
  return prior ? "repeat" : "primary";
}

export function diagnosisToTooth(diagnosisId: string, catalog?: DiagnosisDef[]): ToothStatus | undefined {
  const resolved = catalog?.length ? findDiagnosis(catalog, diagnosisId) : undefined;
  const key = resolved?.name || diagnosisId;
  switch (key) {
    case "caries":
    case "caries_enamel":
    case "caries_dentin":
    case "caries_cement":
    case "caries_arrested":
    case "caries_unspec":
      return "caries";
    case "pulpitis":
    case "pulp_necrosis":
      return "pulpitis";
    case "periodontitis":
    case "acute_apical":
    case "apical_abscess":
    case "periodontal":
      return "periodontitis";
    case "missing":
    case "retained_root":
      return "missing";
    default:
      return undefined;
  }
}

export function treatmentToTooth(treatments: string[]): ToothStatus | undefined {
  if (treatments.includes("extraction")) return "extracted";
  if (treatments.includes("implant")) return "implant";
  if (treatments.includes("crown")) return "crown";
  if (treatments.includes("perm_fill") || treatments.includes("filling") || treatments.includes("restoration")) {
    return "filling";
  }
  if (treatments.includes("temp_fill")) return "filling";
  return undefined;
}

export const DEFAULT_DIARY_TEMPLATES: DiaryTemplate[] = [
  {
    id: "tpl_primary",
    name: "Первичный терапевтический приём",
    complaints: ["cold", "short"],
    complaintsNote: "",
    anamnesis: ["recent", "untreated"],
    anamnesisNote: "",
    exam: ["cavity", "perc_ok"],
    examNote: "",
    recommendations: ["hygiene", "return"],
    recommendationsNote: "",
    treatments: [],
    materialIds: [],
  },
  {
    id: "tpl_repeat",
    name: "Повторный терапевтический приём",
    complaints: ["none"],
    complaintsNote: "",
    anamnesis: ["treated"],
    anamnesisNote: "",
    exam: ["filling"],
    examNote: "",
    recommendations: ["follow", "hygiene"],
    recommendationsNote: "",
    treatments: [],
    materialIds: [],
  },
  {
    id: "tpl_caries",
    name: "Лечение кариеса",
    complaints: ["cold", "sweet"],
    complaintsNote: "",
    anamnesis: ["days"],
    anamnesisNote: "",
    exam: ["cavity"],
    examNote: "",
    recommendations: ["no_food", "hygiene"],
    recommendationsNote: "",
    treatments: ["anesthesia", "prep", "med", "filling"],
    materialIds: ["mat_ultracain", "mat_etch", "mat_adhesive", "mat_filtek_a2"],
  },
  {
    id: "tpl_pulpitis",
    name: "Лечение пульпита",
    complaints: ["spontaneous", "acute"],
    complaintsNote: "",
    anamnesis: ["worse"],
    anamnesisNote: "",
    exam: ["cavity", "perc_pain"],
    examNote: "",
    recommendations: ["return", "pain"],
    recommendationsNote: "",
    treatments: ["anesthesia", "endo", "canal_mech", "temp_fill"],
    materialIds: ["mat_ultracain", "mat_temp"],
  },
  {
    id: "tpl_endo",
    name: "Эндодонтическое лечение",
    complaints: ["aching"],
    complaintsNote: "",
    anamnesis: ["treated"],
    anamnesisNote: "",
    exam: ["perc_pain"],
    examNote: "",
    recommendations: ["return"],
    recommendationsNote: "",
    treatments: ["endo", "canal_mech", "canal_med", "obturation"],
    materialIds: ["mat_ultracain", "mat_gutta", "mat_sealer"],
  },
  {
    id: "tpl_control",
    name: "Контрольный осмотр",
    complaints: ["none"],
    complaintsNote: "",
    anamnesis: ["treated"],
    anamnesisNote: "",
    exam: ["sanitized", "hygiene_ok"],
    examNote: "",
    recommendations: ["hygiene"],
    recommendationsNote: "",
    treatments: [],
    materialIds: [],
  },
];

export function enrichDiaryTemplates(list: DiaryTemplate[] | undefined): DiaryTemplate[] {
  if (!list?.length) return DEFAULT_DIARY_TEMPLATES.map((t) => ({ ...t }));
  const seed = new Map(DEFAULT_DIARY_TEMPLATES.map((t) => [t.id, t]));
  return list.map((t) => {
    const s = seed.get(t.id);
    const base = s ? { ...s, ...t } : t;
    return {
      ...base,
      complaints: t.complaints ?? s?.complaints ?? [],
      anamnesis: t.anamnesis ?? s?.anamnesis ?? [],
      exam: t.exam ?? s?.exam ?? [],
      recommendations: t.recommendations ?? s?.recommendations ?? [],
      treatments: t.treatments ?? s?.treatments ?? [],
      diagnosisId: t.diagnosisId ?? s?.diagnosisId ?? "",
      diagnosisText: t.diagnosisText ?? s?.diagnosisText ?? "",
      complaintsNote: "",
      anamnesisNote: "",
      examNote: "",
      recommendationsNote: "",
      materialIds: t.materialIds?.length ? t.materialIds : s?.materialIds ?? [],
    };
  });
}
