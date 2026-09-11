import { minutesOf } from "./format";
import type { Appointment, Doctor, Visit } from "./types";

export function isVoided(visit: Visit) {
  return Boolean(visit.voidedAt);
}

export function patientBalance(visits: Visit[], patientId: string) {
  return visits
    .filter((v) => v.patientId === patientId && !isVoided(v))
    .reduce((s, v) => s + (v.total - v.paid), 0);
}

export function dayAppointments(appointments: Appointment[], date: string) {
  return appointments
    .filter((a) => a.date === date)
    .slice()
    .sort((a, b) => minutesOf(a.start) - minutesOf(b.start));
}

export function isBlocking(status: Appointment["status"]) {
  return status !== "cancelled" && status !== "no_show";
}

export function slotTaken(
  appointments: Appointment[],
  date: string,
  start: string,
  durationMin: number,
  ignoreId?: string,
) {
  const a0 = minutesOf(start);
  const a1 = a0 + durationMin;
  return appointments.some((b) => {
    if (ignoreId && b.id === ignoreId) return false;
    if (b.date !== date) return false;
    if (!isBlocking(b.status)) return false;
    const b0 = minutesOf(b.start);
    return a0 < b0 + b.durationMin && b0 < a1;
  });
}

export function statusTone(status: Appointment["status"]) {
  switch (status) {
    case "confirmed":
      return "primary" as const;
    case "in_chair":
      return "chair" as const;
    case "done":
      return "ok" as const;
    case "cancelled":
    case "no_show":
      return "danger" as const;
    default:
      return "muted" as const;
  }
}

export function clampPercent(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function doctorShare(amount: number, percent: number) {
  return Math.round((amount * clampPercent(percent)) / 100);
}

export function visitDoctorId(visit: Visit, appointments: Appointment[], fallback: string) {
  if (visit.doctorId) return visit.doctorId;
  const appt = visit.appointmentId
    ? appointments.find((a) => a.id === visit.appointmentId)
    : undefined;
  return appt?.doctorId || fallback;
}

export function doctorCashShare(
  visits: Visit[],
  appointments: Appointment[],
  doctors: Doctor[],
) {
  const fallback = doctors[0]?.id ?? "";
  const byDoctor = new Map<string, { paid: number; rendered: number }>();
  for (const v of visits) {
    if (isVoided(v)) continue;
    const id = visitDoctorId(v, appointments, fallback);
    const cur = byDoctor.get(id) ?? { paid: 0, rendered: 0 };
    cur.paid += v.paid;
    cur.rendered += v.total;
    byDoctor.set(id, cur);
  }
  return doctors.map((d) => {
    const sums = byDoctor.get(d.id) ?? { paid: 0, rendered: 0 };
    const percent = clampPercent(d.sharePercent ?? 0);
    const share = doctorShare(sums.paid, percent);
    return {
      doctor: d,
      percent,
      paid: sums.paid,
      rendered: sums.rendered,
      share,
      clinic: sums.paid - share,
    };
  });
}