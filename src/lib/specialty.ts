import type {
  OrthoCard,
  Patient,
  ProsthoConstruction,
  ProsthoCard,
  SpecMeasure,
  SpecStudy,
  SpecVisit,
} from "./types";
import { uid } from "./utils";

export const ORTHO_COMPLAINTS = [
  ["malocclusion", "Неправильный прикус"],
  ["crowding", "Скученность зубов"],
  ["esthetic", "Эстетическая неудовлетворённость"],
  ["chewing", "Нарушение жевания"],
  ["speech", "Нарушение речи"],
  ["gaps", "Промежутки между зубами"],
  ["protruding", "Выступающие зубы"],
  ["other", "Другое"],
] as const;

export const ORTHO_ANAMNESIS = [
  ["heredity", "Наследственность"],
  ["habits", "Вредные привычки"],
  ["illness", "Заболевания"],
  ["trauma", "Травмы"],
  ["early_loss", "Преждевременная потеря зубов"],
  ["eruption", "Особенности прорезывания"],
  ["prior", "Предыдущее ортодонтическое лечение"],
] as const;

export const FACE_SYMMETRY = [
  ["ok", "Симметричное"],
  ["mild", "Лёгкая асимметрия"],
  ["marked", "Выраженная асимметрия"],
] as const;

export const FACE_PROFILE = [
  ["straight", "Прямой"],
  ["convex", "Выпуклый"],
  ["concave", "Вогнутый"],
] as const;

export const FACE_TYPE = [
  ["meso", "Мезофациальный"],
  ["brachy", "Брахифациальный"],
  ["dolicho", "Долихофациальный"],
] as const;

export const FACE_PROP = [
  ["ok", "Пропорциональное"],
  ["long", "Удлинённое"],
  ["short", "Укороченное"],
] as const;

export const FACE_LIPS = [
  ["ok", "Смыкаются свободно"],
  ["strain", "С напряжением"],
  ["open", "Не смыкаются"],
] as const;

export const FACE_CHIN = [
  ["ok", "Обычное"],
  ["forward", "Выступающий"],
  ["back", "Скошенный"],
] as const;

export const MUCOSA = [
  ["ok", "Без изменений"],
  ["inflam", "Воспаление"],
  ["scar", "Рубцы / изменения"],
] as const;

export const HYGIENE = [
  ["good", "Хорошая"],
  ["fair", "Удовлетворительная"],
  ["poor", "Плохая"],
] as const;

export const TEETH_STATE = [
  ["ok", "Интактные"],
  ["fill", "Пломбы / реставрации"],
  ["damage", "Разрушения"],
] as const;

export const PERIO = [
  ["ok", "Без патологии"],
  ["ging", "Гингивит"],
  ["perio", "Пародонтит"],
] as const;

export const ORTHO_MARKS = [
  ["crowding", "Скученность"],
  ["rotation", "Поворот"],
  ["retention", "Ретенция"],
  ["adentia", "Адентия"],
  ["supernumerary", "Сверхкомплектный"],
  ["dystopia", "Дистопия"],
  ["supra", "Супраположение"],
  ["infra", "Инфраположение"],
  ["transposition", "Транспозиция"],
  ["protrusion", "Протрузия"],
  ["retrusion", "Ретрузия"],
] as const;

export const DENTITION = [
  ["primary", "Временный"],
  ["mixed", "Сменный"],
  ["permanent", "Постоянный"],
] as const;

export const BITE_SAG = [
  ["ok", "Норма"],
  ["distal", "Дистальный"],
  ["mesial", "Мезиальный"],
] as const;

export const BITE_VERT = [
  ["ok", "Норма"],
  ["deep", "Глубокий"],
  ["open", "Открытый"],
] as const;

export const BITE_TRANS = [
  ["ok", "Норма"],
  ["cross", "Перекрёстный"],
] as const;

export const ARCH_FORM = [
  ["ok", "Правильная"],
  ["narrow", "Суженная"],
  ["wide", "Расширенная"],
  ["v", "V-образная"],
] as const;

export const ARCH_WIDTH = [
  ["ok", "Норма"],
  ["narrow", "Сужение"],
  ["wide", "Расширение"],
] as const;

export const ARCH_LEN = [
  ["ok", "Норма"],
  ["short", "Укорочение"],
  ["long", "Удлинение"],
] as const;

export const ARCH_CROWD = [
  ["none", "Нет"],
  ["mild", "Лёгкая"],
  ["mod", "Умеренная"],
  ["severe", "Выраженная"],
] as const;

export const ARCH_TREMA = [
  ["none", "Нет"],
  ["yes", "Есть"],
] as const;

export const ARCH_DIASTEMA = [
  ["none", "Нет"],
  ["yes", "Есть"],
] as const;

export const ARCH_SYM = [
  ["ok", "Симметричные"],
  ["asym", "Асимметрия"],
] as const;

export const STUDY_KINDS = [
  ["optg", "ОПТГ"],
  ["trg", "ТРГ"],
  ["ct", "КТ"],
  ["other", "Другое"],
] as const;

export const ORTHO_SHOTS = [
  ["face_front", "Фас"],
  ["face_profile", "Профиль"],
  ["smile", "Улыбка"],
  ["intra_front", "Фронтальная"],
  ["intra_right", "Правая"],
  ["intra_left", "Левая"],
  ["occl_upper", "Верхняя окклюзионная"],
  ["occl_lower", "Нижняя окклюзионная"],
] as const;

export const PHOTO_STAGES = [
  ["before", "До лечения"],
  ["during", "В процессе"],
  ["after", "После лечения"],
] as const;

export const APPLIANCE_TYPE = [
  ["braces", "Брекет-система"],
  ["aligners", "Элайнеры"],
  ["plate", "Пластинка"],
  ["functional", "Функциональный аппарат"],
  ["retainer", "Ретейнер"],
  ["other", "Другое"],
] as const;

export const RETAINER_TYPE = [
  ["fixed", "Несъёмный"],
  ["removable", "Съёмный"],
  ["both", "Комбинированный"],
  ["other", "Другое"],
] as const;

export const PROSTHO_COMPLAINTS = [
  ["missing", "Отсутствие зубов"],
  ["chewing", "Нарушение жевания"],
  ["esthetic", "Эстетическая неудовлетворённость"],
  ["pain", "Боль"],
  ["speech", "Нарушение речи"],
  ["denture", "Неудобство протеза"],
  ["break", "Поломка конструкции"],
  ["other", "Другое"],
] as const;

export const PROSTHO_MARKS = [
  ["missing", "Отсутствует"],
  ["crown", "Коронка"],
  ["bridge", "Мост"],
  ["veneer", "Винир"],
  ["inlay", "Вкладка"],
  ["stump", "Культя"],
  ["implant", "Имплантат"],
  ["temp", "Временная конструкция"],
  ["destroyed", "Разрушен"],
  ["needs", "Требует восстановления"],
] as const;

export const CONSTRUCTION_KIND = [
  ["crown", "Коронка"],
  ["bridge", "Мостовидный протез"],
  ["veneer", "Винир"],
  ["implant", "На имплантатах"],
  ["inlay", "Вкладка"],
  ["clasp", "Бюгельный протез"],
  ["partial", "Частичный съёмный"],
  ["full", "Полный съёмный"],
  ["other", "Другое"],
] as const;

export const MATERIALS = [
  ["mc", "Металлокерамика"],
  ["zirconia", "Диоксид циркония"],
  ["emax", "E.max"],
  ["ceramic", "Керамика"],
  ["metal", "Металл"],
  ["acrylic", "Пластмасса"],
  ["temp", "Временный материал"],
  ["other", "Другое"],
] as const;

export const VITA_COLORS = [
  "A1",
  "A2",
  "A3",
  "A3.5",
  "A4",
  "B1",
  "B2",
  "B3",
  "B4",
  "C1",
  "C2",
  "C3",
  "C4",
  "D2",
  "D3",
  "D4",
  "other",
] as const;

export const CONSTRUCTION_STATUS = [
  ["planned", "Планируется"],
  ["in_work", "В работе"],
  ["lab", "Передана в лабораторию"],
  ["ready", "Готова"],
  ["tryin", "Примерка"],
  ["fixed", "Зафиксирована"],
  ["done", "Завершена"],
] as const;

export const PROSTHO_STAGES = [
  "Первичный осмотр",
  "Диагностика",
  "Планирование",
  "Препарирование",
  "Сканирование / оттиск",
  "Временная конструкция",
  "Работа лаборатории",
  "Примерка",
  "Коррекция",
  "Фиксация",
  "Контрольный осмотр",
];

export const PROSTHO_SHOTS = [
  ["before", "До лечения"],
  ["prep", "Препарирование"],
  ["temp", "Временная конструкция"],
  ["tryin", "Примерка"],
  ["fix", "Фиксация"],
  ["after", "После лечения"],
] as const;

export const OCCLUSION = [
  ["ok", "Окклюзия без особенностей"],
  ["low", "Занижена"],
  ["high", "Завышена"],
  ["interfere", "Преждевременные контакты"],
] as const;

export const TMJ = [
  ["ok", "Без жалоб"],
  ["click", "Щелчки"],
  ["pain", "Боль"],
  ["limit", "Ограничение открывания"],
] as const;

export function optLabel(options: readonly (readonly [string, string])[], id: string) {
  return options.find((x) => x[0] === id)?.[1] ?? (id || "—");
}

export function emptyVisit(doctorId = ""): SpecVisit {
  return {
    id: uid("sv"),
    date: "",
    time: "",
    doctorId,
    complaints: "",
    actions: "",
    status: "",
    nextDate: "",
    notes: "",
    recommendations: "",
  };
}

export function emptyStudy(): SpecStudy {
  return { id: uid("st"), date: "", kind: "optg", notes: "", conclusion: "" };
}

export function emptyMeasure(name = ""): SpecMeasure {
  return { id: uid("ms"), name, value: "", unit: "мм" };
}

export function emptyOrthoCard(patientId: string): OrthoCard {
  return {
    patientId,
    complaints: [],
    complaintsNote: "",
    anamnesis: [],
    anamnesisNote: "",
    face: { symmetry: "", profile: "", faceType: "", proportions: "", lips: "", chin: "" },
    oral: { mucosa: "", hygiene: "", teeth: "", periodontium: "" },
    teethMarks: {},
    dentition: "",
    biteSagittal: "",
    biteVertical: "",
    biteTransverse: "",
    arches: { form: "", width: "", length: "", crowding: "", trema: "", diastema: "", symmetry: "" },
    measurements: [
      emptyMeasure("Ширина зубного ряда"),
      emptyMeasure("Длина зубного ряда"),
      emptyMeasure("Диастема"),
      emptyMeasure("Сагиттальная щель"),
      emptyMeasure("Вертикальная щель"),
    ],
    studies: [],
    diagnosisId: "",
    diagnosisText: "",
    plan: { goal: "", method: "", appliance: "", stages: "", duration: "", notes: "" },
    appliance: {
      type: "",
      bracketType: "",
      system: "",
      material: "",
      installedOn: "",
      alignerBrand: "",
      alignerTotal: "",
      alignerCurrent: "",
      notes: "",
    },
    visits: [],
    retention: { activeEnd: "", retainerType: "", installedOn: "", notes: "", recallPlan: "" },
    epicrisis: "",
    updatedAt: "",
  };
}

export function defaultProsthoStages(): ProsthoConstruction["stages"] {
  return PROSTHO_STAGES.map((name) => ({ id: uid("ps"), name, date: "", done: false }));
}

export function emptyConstruction(): ProsthoConstruction {
  return {
    id: uid("pc"),
    teeth: [],
    kind: "crown",
    material: "zirconia",
    color: "A2",
    colorOther: "",
    price: 0,
    status: "planned",
    stages: defaultProsthoStages(),
    lab: { name: "", technician: "", sentOn: "", receivedOn: "", cost: 0, notes: "" },
    notes: "",
  };
}

export function emptyProsthoCard(patientId: string): ProsthoCard {
  return {
    patientId,
    complaints: [],
    complaintsNote: "",
    anamnesis: "",
    exam: "",
    teethMarks: {},
    occlusion: "",
    tmj: "",
    studies: [],
    diagnosisId: "",
    diagnosisText: "",
    planNotes: "",
    constructions: [],
    visits: [],
    result: "",
    customMaterials: [],
    updatedAt: "",
  };
}

export function mergeOrtho(patientId: string, raw?: Partial<OrthoCard> | null): OrthoCard {
  const base = emptyOrthoCard(patientId);
  if (!raw) return base;
  return {
    ...base,
    ...raw,
    patientId,
    face: { ...base.face, ...raw.face },
    oral: { ...base.oral, ...raw.oral },
    arches: { ...base.arches, ...raw.arches },
    plan: { ...base.plan, ...raw.plan },
    appliance: { ...base.appliance, ...raw.appliance },
    retention: { ...base.retention, ...raw.retention },
    teethMarks: raw.teethMarks ?? {},
    measurements: raw.measurements?.length ? raw.measurements : base.measurements,
    studies: raw.studies ?? [],
    visits: raw.visits ?? [],
  };
}

export function mergeProstho(patientId: string, raw?: Partial<ProsthoCard> | null): ProsthoCard {
  const base = emptyProsthoCard(patientId);
  if (!raw) return base;
  return {
    ...base,
    ...raw,
    patientId,
    teethMarks: raw.teethMarks ?? {},
    studies: raw.studies ?? [],
    constructions: (raw.constructions ?? []).map((c) => ({
      ...emptyConstruction(),
      ...c,
      lab: { ...emptyConstruction().lab, ...c.lab },
      stages: c.stages?.length ? c.stages : defaultProsthoStages(),
      teeth: c.teeth ?? [],
      price: Math.round(Number(c.price) || 0),
    })),
    visits: raw.visits ?? [],
    customMaterials: raw.customMaterials ?? [],
  };
}

export function joinOpt(options: readonly (readonly [string, string])[], ids: string[], extra = "") {
  const labels = ids.map((id) => optLabel(options, id)).filter((x) => x && x !== "—");
  if (extra.trim()) labels.push(extra.trim());
  return labels.join(", ");
}

export function composeOrthoEpicrisis(card: OrthoCard, patient: Patient, doctorName: string) {
  const lines = [
    `Эпикриз ортодонтического лечения`,
    `Пациент: ${[patient.lastName, patient.firstName, patient.middleName].filter(Boolean).join(" ")}`,
    doctorName ? `Врач: ${doctorName}` : "",
    card.diagnosisText ? `Диагноз: ${card.diagnosisText}` : "",
    card.visits[0]?.date ? `Начало: ${card.visits[0].date}` : "",
    card.appliance.type ? `Аппарат: ${optLabel(APPLIANCE_TYPE, card.appliance.type)}` : "",
    card.plan.method ? `Метод: ${card.plan.method}` : "",
    card.plan.goal ? `Цель: ${card.plan.goal}` : "",
    card.retention.activeEnd ? `Окончание активного лечения: ${card.retention.activeEnd}` : "",
    card.retention.retainerType ? `Ретенция: ${optLabel(RETAINER_TYPE, card.retention.retainerType)}` : "",
    card.visits.length ? `Приёмов: ${card.visits.length}` : "",
  ];
  return lines.filter(Boolean).join("\n");
}

export type TimelineEvent = { date: string; title: string; detail?: string };

export function orthoTimeline(card: OrthoCard): TimelineEvent[] {
  const out: TimelineEvent[] = [];
  for (const v of card.visits) {
    if (v.date) out.push({ date: v.date, title: "Приём ортодонта", detail: v.actions || v.complaints });
  }
  for (const s of card.studies) {
    if (s.date) out.push({ date: s.date, title: optLabel(STUDY_KINDS, s.kind), detail: s.conclusion || s.notes });
  }
  if (card.appliance.installedOn) {
    out.push({
      date: card.appliance.installedOn,
      title: "Установка аппарата",
      detail: optLabel(APPLIANCE_TYPE, card.appliance.type),
    });
  }
  if (card.retention.installedOn) {
    out.push({ date: card.retention.installedOn, title: "Ретейнер", detail: optLabel(RETAINER_TYPE, card.retention.retainerType) });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export function prosthoTimeline(card: ProsthoCard): TimelineEvent[] {
  const out: TimelineEvent[] = [];
  for (const v of card.visits) {
    if (v.date) out.push({ date: v.date, title: "Приём ортопеда", detail: v.actions || v.complaints });
  }
  for (const s of card.studies) {
    if (s.date) out.push({ date: s.date, title: optLabel(STUDY_KINDS, s.kind), detail: s.conclusion || s.notes });
  }
  for (const c of card.constructions) {
    const kind = optLabel(CONSTRUCTION_KIND, c.kind);
    const teeth = c.teeth.length ? ` зубы ${c.teeth.join(", ")}` : "";
    for (const st of c.stages) {
      if (st.date) out.push({ date: st.date, title: `${kind}${teeth}: ${st.name}` });
    }
    if (c.lab.sentOn) out.push({ date: c.lab.sentOn, title: `${kind}: в лабораторию`, detail: c.lab.name });
    if (c.lab.receivedOn) out.push({ date: c.lab.receivedOn, title: `${kind}: из лаборатории` });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export function markLetters(marks: string[]) {
  return marks
    .map((id) => ORTHO_MARKS.find((x) => x[0] === id)?.[1]?.[0] || PROSTHO_MARKS.find((x) => x[0] === id)?.[1]?.[0] || id[0])
    .filter(Boolean)
    .join("");
}
