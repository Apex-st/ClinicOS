import type { CSSProperties } from "react";
import type { Appointment, WorkDay } from "./types";
import { dayAppointments, isBlocking } from "./clinic";
import { minutesOf, todayISO } from "./format";

export type ScheduleScale = "day" | "week" | "month" | "year";

export const SCHEDULE_SCALES: Array<{ id: ScheduleScale; label: string }> = [
  { id: "day", label: "День" },
  { id: "week", label: "Неделя" },
  { id: "month", label: "Месяц" },
  { id: "year", label: "Год" },
];

const VIEW_KEY = "denta-schedule-view";

export type ScheduleViewState = {
  date: string;
  scale: ScheduleScale;
  doctorFilter: string;
  monthZoom: number;
  yearZoom: number;
  dragLocked: boolean;
  /** null — автоматически: свёрнут, если есть записи. После щипка — выбранный режим. */
  timeCompact: boolean | null;
};

const VIEW_REV = 23;

export function loadScheduleView(): ScheduleViewState {
  const fallback: ScheduleViewState = {
    date: todayISO(),
    scale: "week",
    doctorFilter: "all",
    monthZoom: 1,
    yearZoom: 1,
    dragLocked: true,
    timeCompact: null,
  };
  try {
    const raw = sessionStorage.getItem(VIEW_KEY);
    if (!raw) return fallback;
    const p = JSON.parse(raw) as Partial<ScheduleViewState> & { viewRev?: number };
    const scale = SCHEDULE_SCALES.some((s) => s.id === p.scale) ? (p.scale as ScheduleScale) : "week";
    const monthZoom = typeof p.monthZoom === "number" ? Math.min(2.8, Math.max(1, p.monthZoom)) : 1;
    const yearZoom = typeof p.yearZoom === "number" ? Math.min(2.8, Math.max(1, p.yearZoom)) : 1;
    const migrated = p.viewRev === VIEW_REV;
    return {
      date: typeof p.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(p.date) ? p.date : todayISO(),
      scale,
      doctorFilter: typeof p.doctorFilter === "string" ? p.doctorFilter : "all",
      monthZoom,
      yearZoom,
      dragLocked: migrated ? p.dragLocked === true : true,
      timeCompact: typeof p.timeCompact === "boolean" ? p.timeCompact : null,
    };
  } catch {
    return fallback;
  }
}

export function saveScheduleView(state: ScheduleViewState) {
  try {
    sessionStorage.setItem(VIEW_KEY, JSON.stringify({ ...state, viewRev: VIEW_REV }));
  } catch {
    /* ignore */
  }
}

export function busyTimes(appointments: Appointment[], slots: string[], slotMinutes: number) {
  if (appointments.length === 0) return slots;
  const busy = new Set<string>();
  for (const a of appointments) {
    if (a.status === "cancelled" || a.status === "no_show") continue;
    const a0 = minutesOf(a.start);
    const a1 = a0 + a.durationMin;
    for (const t of slots) {
      const t0 = minutesOf(t);
      if (t0 < a1 && t0 + slotMinutes > a0) busy.add(t);
    }
  }
  const out = slots.filter((t) => busy.has(t));
  return out.length ? out : slots;
}

export function compactIndex(time: string, compactSlots: string[], slotMinutes: number) {
  const m = minutesOf(time);
  for (let i = 0; i < compactSlots.length; i++) {
    if (m < minutesOf(compactSlots[i]) + slotMinutes) return i;
  }
  return Math.max(0, compactSlots.length - 1);
}

export function compactSpan(start: string, durationMin: number, compactSlots: string[], slotMinutes: number) {
  const a0 = minutesOf(start);
  const a1 = a0 + durationMin;
  let n = 0;
  for (const t of compactSlots) {
    const t0 = minutesOf(t);
    if (t0 < a1 && t0 + slotMinutes > a0) n += 1;
  }
  return Math.max(1, n);
}

export function appointmentNewPath(p: { date?: string; start?: string; doctorId?: string; patientId?: string }) {
  const q = new URLSearchParams();
  if (p.date) q.set("date", p.date);
  if (p.start) q.set("start", p.start);
  if (p.doctorId) q.set("doctorId", p.doctorId);
  if (p.patientId) q.set("patientId", p.patientId);
  const s = q.toString();
  return s ? `/schedule/new?${s}` : "/schedule/new";
}

export function appointmentEditPath(id: string) {
  return `/schedule/${encodeURIComponent(id)}`;
}

export function dayCapacityMin(workHours: Record<number, WorkDay>, iso: string) {
  const d = new Date(`${iso}T12:00:00`);
  const hours = workHours[d.getDay()] ?? { start: "09:00", end: "18:00", off: false };
  if (hours.off) return 0;
  return Math.max(0, minutesOf(hours.end) - minutesOf(hours.start));
}

export function dayUsedMin(appointments: Appointment[], iso: string) {
  return dayAppointments(appointments, iso)
    .filter((a) => isBlocking(a.status))
    .reduce((s, a) => s + Math.max(0, a.durationMin), 0);
}

export function dayFill(appointments: Appointment[], workHours: Record<number, WorkDay>, iso: string) {
  const d = new Date(`${iso}T12:00:00`);
  const hours = workHours[d.getDay()] ?? { start: "09:00", end: "18:00", off: false };
  if (hours.off) return { pct: 0, off: true, used: 0, cap: 0 };
  const cap = Math.max(0, minutesOf(hours.end) - minutesOf(hours.start));
  const used = dayUsedMin(appointments, iso);
  if (cap <= 0) return { pct: 0, off: false, used, cap: 0 };
  return { pct: Math.max(0, Math.min(100, Math.round((used / cap) * 100))), off: false, used, cap };
}

const EMPTY_FILL: CSSProperties = {};

/** Пустой день — как все остальные. Есть запись: зелёный → красный по занятости. */
export function fillStyle(pct: number, off?: boolean, used?: number): CSSProperties {
  if (off) {
    return { background: "var(--color-surface-2)", color: "var(--color-subtle)" };
  }
  const empty = used !== undefined ? used <= 0 : pct <= 0;
  if (empty) return EMPTY_FILL;
  const t = Math.max(0, Math.min(100, pct)) / 100;
  const h = 128 * (1 - t);
  const s = 46 + t * 22;
  const l = 44 - t * 8;
  const darkText = t < 0.58;
  return {
    background: `hsl(${h} ${s}% ${l}%)`,
    color: darkText ? "var(--color-ink)" : "var(--color-primary-fg)",
  };
}

export function fillCaption(fill: { pct: number; off: boolean; used: number }) {
  if (fill.off) return "вых";
  if (fill.used <= 0) return "";
  return `${fill.pct}%`;
}

export type ScheduleLayout = {
  occupancy: boolean;
  fillColors: boolean;
  miniMonth: boolean;
  dayTime: boolean;
  visitKind: boolean;
};

export function scheduleLayout(s: {
  scheduleShowOccupancy?: boolean;
  scheduleShowFillColors?: boolean;
  scheduleShowMiniMonth?: boolean;
  scheduleShowDayTime?: boolean;
  scheduleShowVisitKind?: boolean;
}): ScheduleLayout {
  return {
    occupancy: s.scheduleShowOccupancy !== false,
    fillColors: s.scheduleShowFillColors !== false,
    miniMonth: s.scheduleShowMiniMonth !== false,
    dayTime: s.scheduleShowDayTime !== false,
    visitKind: s.scheduleShowVisitKind !== false,
  };
}

export function snapMinutes(n: number, slot: number) {
  const step = Math.max(5, slot || 30);
  return Math.max(step, Math.round(n / step) * step);
}
