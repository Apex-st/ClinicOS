import { formatDate, formatTime, fullName } from "./format";
import type { Appointment, MessageTemplate, NotifyRule, Patient, Settings } from "./types";

export const TEMPLATE_KIND_ORDER = [
  "reminder",
  "recall",
  "control",
  "unfinished",
  "plan",
  "birthday",
  "custom",
] as const;

export const TEMPLATE_KIND_LABEL: Record<MessageTemplate["kind"], string> = {
  reminder: "Напоминание о приёме",
  recall: "Повторное приглашение",
  control: "Контрольный осмотр",
  unfinished: "Незавершённое лечение",
  plan: "План лечения",
  birthday: "День рождения",
  custom: "Другое",
};

export const MESSAGE_VARS = [
  "{Имя пациента}",
  "{ФИО пациента}",
  "{Дата}",
  "{Время}",
  "{Врач}",
  "{Название клиники}",
  "{Телефон клиники}",
  "{Ссылка}",
] as const;

export function seedMessageTemplates(): MessageTemplate[] {
  return [
    {
      id: "tpl_reminder",
      name: "Напоминание о приёме",
      kind: "reminder",
      body: "Здравствуйте, {Имя пациента}! Напоминаем, что Вы записаны на приём {Дата} в {Время}. {Название клиники}, {Телефон клиники}.",
    },
    {
      id: "tpl_recall",
      name: "Приглашение на повторный приём",
      kind: "recall",
      body: "Здравствуйте, {Имя пациента}! Мы рекомендуем Вам пройти контрольный осмотр. Вы можете записаться на удобное время. {Название клиники}, {Телефон клиники}.",
    },
    {
      id: "tpl_plan",
      name: "План лечения",
      kind: "plan",
      body: "Здравствуйте, {Имя пациента}! Для Вас подготовлен план лечения. {Название клиники}.",
    },
    {
      id: "tpl_control",
      name: "Контрольный осмотр",
      kind: "control",
      body: "Здравствуйте, {Имя пациента}! Напоминаем о необходимости контрольного осмотра. {Название клиники}, {Телефон клиники}.",
    },
  ];
}

export function seedNotifyRules(): NotifyRule[] {
  return [
    { id: "nr_reminder", kind: "reminder", enabled: true, channel: "system", templateId: "tpl_reminder", minutesBefore: 60 },
    { id: "nr_recall", kind: "recall", enabled: false, channel: "whatsapp", templateId: "tpl_recall", minutesBefore: 0 },
    { id: "nr_control", kind: "control", enabled: false, channel: "sms", templateId: "tpl_control", minutesBefore: 0 },
    { id: "nr_plan", kind: "plan", enabled: false, channel: "whatsapp", templateId: "tpl_plan", minutesBefore: 0 },
    { id: "nr_birthday", kind: "birthday", enabled: false, channel: "whatsapp", templateId: "tpl_recall", minutesBefore: 0 },
    { id: "nr_unfinished", kind: "unfinished", enabled: false, channel: "sms", templateId: "tpl_recall", minutesBefore: 0 },
  ];
}

export function fillTemplate(
  body: string,
  ctx: {
    patient?: Patient | null;
    settings?: Settings;
    date?: string;
    time?: string;
    doctor?: string;
    link?: string;
  },
) {
  const p = ctx.patient;
  const s = ctx.settings;
  return body
    .replaceAll("{Имя пациента}", p?.firstName || "пациент")
    .replaceAll("{ФИО пациента}", p ? fullName(p) : "пациент")
    .replaceAll("{Дата}", ctx.date ? formatDate(ctx.date, "d MMMM yyyy") : "")
    .replaceAll("{Время}", ctx.time ? formatTime(ctx.time) : "")
    .replaceAll("{Врач}", ctx.doctor || s?.doctorName || "")
    .replaceAll("{Название клиники}", s?.clinicName || "")
    .replaceAll("{Телефон клиники}", s?.phone || "")
    .replaceAll("{Ссылка}", ctx.link || "");
}

export function reminderContext(patient: Patient, appt: Appointment, settings: Settings, doctorName: string) {
  return fillTemplate(seedMessageTemplates()[0]!.body, {
    patient,
    settings,
    date: appt.date,
    time: appt.start,
    doctor: doctorName,
  });
}
