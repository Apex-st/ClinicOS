import { differenceInYears, format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import type {
  AppointmentStatus,
  DiscountCategory,
  Doctor,
  Patient,
  PaymentMethod,
  PhotoCategory,
  ServiceGroup,
} from "./types";

export function fullName(p: Pick<Patient, "lastName" | "firstName" | "middleName">) {
  return [p.lastName, p.firstName, p.middleName].filter(Boolean).join(" ");
}

export function doctorShort(d: Pick<Doctor, "lastName" | "firstName" | "middleName">) {
  return shortName(d);
}

export function shortName(p: Pick<Patient, "lastName" | "firstName" | "middleName">) {
  const i = p.firstName ? `${p.firstName[0]}.` : "";
  const m = p.middleName ? `${p.middleName[0]}.` : "";
  return `${p.lastName} ${i}${m}`.trim();
}

export function initials(p: Pick<Patient, "lastName" | "firstName">) {
  return `${p.lastName[0] ?? ""}${p.firstName[0] ?? ""}`.toUpperCase();
}

export function ageYears(birthDate: string) {
  if (!birthDate) return null;
  try {
    return differenceInYears(new Date(), parseISO(birthDate));
  } catch {
    return null;
  }
}

export function pluralYears(n: number) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} год`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return `${n} года`;
  return `${n} лет`;
}

export function money(n: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatDate(iso: string, pattern = "d MMMM yyyy") {
  try {
    return format(parseISO(iso), pattern, { locale: ru });
  } catch {
    return iso;
  }
}

export function formatTime(hhmm: string) {
  return hhmm;
}

export function minutesOf(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function fromMinutes(total: number) {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function pluralRu(n: number, one: string, few: string, many: string) {
  const abs = Math.abs(Math.round(n));
  const n10 = abs % 10;
  const n100 = abs % 100;
  if (n10 === 1 && n100 !== 11) return one;
  if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return few;
  return many;
}

/** Минуты / часы / дни / месяцы — как в жизни, не «4320 мин». */
export function formatSoon(minutesLeft: number): string {
  if (!Number.isFinite(minutesLeft) || minutesLeft <= 0) return "сейчас";
  if (minutesLeft < 60) {
    const m = Math.round(minutesLeft);
    return `${m} ${pluralRu(m, "минута", "минуты", "минут")}`;
  }
  if (minutesLeft < 24 * 60) {
    const h = Math.max(1, Math.round(minutesLeft / 60));
    return `${h} ${pluralRu(h, "час", "часа", "часов")}`;
  }
  const days = Math.max(1, Math.round(minutesLeft / (24 * 60)));
  if (days < 45) {
    return `${days} ${pluralRu(days, "день", "дня", "дней")}`;
  }
  const months = Math.max(1, Math.round(days / 30));
  return `${months} ${pluralRu(months, "месяц", "месяца", "месяцев")}`;
}

export function timeGreeting(date = new Date()) {
  const h = date.getHours();
  if (h < 12) return "Доброе утро";
  if (h < 18) return "Добрый день";
  return "Добрый вечер";
}

/** Заголовок вкладки «Сегодня». {фио} / {имя} — полное ФИО выбранного врача. */
export function greetingDoctorName(
  settings: { doctorName: string; welcomeDoctorId?: string },
  doctors: Array<{ id: string; lastName: string; firstName: string; middleName: string; active?: boolean }>,
  sessionDoctorId?: string | null,
) {
  const byId = (id?: string | null) => (id ? doctors.find((d) => d.id === id) : undefined);
  const chosen =
    byId(settings.welcomeDoctorId) ||
    byId(sessionDoctorId) ||
    doctors.find((d) => d.active !== false) ||
    doctors[0];
  if (chosen) return fullName(chosen);
  return (settings.doctorName || "").trim();
}

export function todayHeadline(
  settings: { welcomeMode?: "auto" | "custom"; welcomeText?: string; doctorName: string; welcomeDoctorId?: string },
  doctorFio?: string,
) {
  const fio = (doctorFio || settings.doctorName || "").trim();
  const custom = (settings.welcomeText || "").trim();
  if (settings.welcomeMode === "custom" && custom) {
    if (custom.includes("{фио}")) return custom.replaceAll("{фио}", fio);
    if (custom.includes("{имя}")) return custom.replaceAll("{имя}", fio);
    return fio ? `${custom}, ${fio}` : custom;
  }
  return fio ? `${timeGreeting()}, ${fio}` : timeGreeting();
}

export function todayISO() {
  return format(new Date(), "yyyy-MM-dd");
}

export const STATUS_LABEL: Record<AppointmentStatus, string> = {
  scheduled: "Запись",
  confirmed: "Подтверждена",
  in_chair: "В кресле",
  done: "Завершена",
  cancelled: "Отмена",
  no_show: "Не явился",
};

export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  cash: "Наличные",
  card: "Карта",
  transfer: "Перевод",
};

export const CATEGORY_LABEL: Record<string, string> = {
  diagnostics: "Диагностика",
  xray: "Рентген",
  anesthesia: "Анестезия",
  therapy: "Терапия",
  hygiene: "Гигиена",
  surgery: "Хирургия",
  prosthetics: "Ортопедия",
};

export const CATEGORY_ORDER = [
  "diagnostics",
  "xray",
  "anesthesia",
  "therapy",
  "hygiene",
  "surgery",
  "prosthetics",
];

export function groupLabel(groups: ServiceGroup[] | undefined, id: string) {
  return groups?.find((g) => g.id === id)?.name ?? CATEGORY_LABEL[id] ?? id;
}

export function sortedGroups(groups: ServiceGroup[] | undefined): ServiceGroup[] {
  if (groups?.length) return [...groups].sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name, "ru"));
  return CATEGORY_ORDER.map((id, i) => ({ id, name: CATEGORY_LABEL[id] ?? id, sort: i }));
}

export function phoneHref(phone: string) {
  const digits = phone.replace(/[^\d+]/g, "");
  return `tel:${digits}`;
}

export function phoneDigits(phone: string) {
  let d = phone.replace(/\D/g, "");
  if (d.startsWith("8") && d.length === 11) d = `7${d.slice(1)}`;
  return d;
}

export function waHref(phone: string, text = "") {
  const d = phoneDigits(phone);
  return `https://wa.me/${d}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

export function smsHref(phone: string, text = "") {
  const raw = phone.replace(/[^\d+]/g, "");
  return `sms:${raw}${text ? `?body=${encodeURIComponent(text)}` : ""}`;
}

export function mailtoHref(email: string, subject: string, body: string) {
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export const PHOTO_CATEGORY_LABEL: Record<PhotoCategory, string> = {
  before: "До лечения",
  during: "В процессе",
  after: "После лечения",
  xray: "Рентген / КЛКТ",
  teeth: "Фото зубов",
  construction: "Конструкция",
  ortho: "Ортодонтия",
  prostho: "Ортопедия",
  other: "Другое",
};

export const PHOTO_CATEGORIES: PhotoCategory[] = [
  "before",
  "during",
  "after",
  "xray",
  "teeth",
  "construction",
  "ortho",
  "prostho",
  "other",
];

export const DISCOUNT_CATEGORY_LABEL: Record<DiscountCategory, string> = {
  regular: "Обычная",
  referral: "Реферальная",
  loyalty: "Постоянный пациент",
  individual: "Индивидуальная",
  promo: "Акция",
  family: "Семейная",
  birthday: "День рождения",
  repeat: "Повторный приём",
  special: "Специальная",
  other: "Другая",
};

