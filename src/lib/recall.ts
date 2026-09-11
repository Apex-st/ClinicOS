import { differenceInDays, differenceInMonths, parseISO } from "date-fns";
import type { Appointment, Patient, RecallStatus, Visit } from "./types";

export function lastVisitDate(
  patientId: string,
  visits: Visit[],
  appointments: Appointment[],
): string | null {
  const dates: string[] = [];
  for (const v of visits) if (v.patientId === patientId) dates.push(v.date);
  for (const a of appointments) {
    if (a.patientId === patientId && a.status === "done") dates.push(a.date);
  }
  if (dates.length === 0) return null;
  return dates.sort().at(-1) ?? null;
}

export function daysSinceLastVisit(last: string | null, today = new Date()) {
  if (!last) return null;
  try {
    return Math.max(0, differenceInDays(today, parseISO(last)));
  } catch {
    return null;
  }
}

export function monthsSinceLastVisit(last: string | null, today = new Date()) {
  if (!last) return null;
  try {
    return Math.max(0, differenceInMonths(today, parseISO(last)));
  } catch {
    return null;
  }
}

export function lastVisitReason(
  patientId: string,
  visits: Visit[],
  services: Array<{ id: string; name: string }>,
) {
  const list = visits.filter((v) => v.patientId === patientId).sort((a, b) => b.date.localeCompare(a.date));
  const v = list[0];
  if (!v) return "—";
  const names = v.items
    .map((it) => services.find((s) => s.id === it.serviceId)?.name)
    .filter(Boolean);
  return names[0] ?? (v.notes || "Приём");
}

export function needsRecall(
  patient: Patient,
  visits: Visit[],
  appointments: Appointment[],
  minDays: number,
) {
  const last = lastVisitDate(patient.id, visits, appointments);
  if (!last) return true;
  const days = daysSinceLastVisit(last);
  return days != null && days >= minDays;
}

export const RECALL_STATUS_LABEL: Record<RecallStatus, string> = {
  none: "Не связывались",
  contacted: "Связались",
  interested: "Заинтересован",
  booked: "Записан",
  refused: "Отказался",
  no_answer: "Не отвечает",
  call_later: "Перезвонить позже",
};

export const FOLLOW_TODAY: RecallStatus[] = ["call_later", "no_answer"];
