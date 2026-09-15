import type { Doctor, DoctorRole } from "./types";

export const DOCTOR_ROLES: { id: DoctorRole; label: string; hint: string }[] = [
  { id: "chief", label: "Главный врач", hint: "Лечит и управляет кабинетом" },
  { id: "admin", label: "Администратор", hint: "Запись, касса, настройки" },
  { id: "doctor", label: "Врач", hint: "Ведёт приём" },
];

export function normalizeRole(role: unknown): DoctorRole {
  if (role === "admin" || role === "chief" || role === "doctor") return role;
  return "doctor";
}

export function roleLabel(role: DoctorRole | string | undefined): string {
  const id = normalizeRole(role);
  return DOCTOR_ROLES.find((r) => r.id === id)?.label ?? "Врач";
}

export function isManagerRole(role: DoctorRole | string | undefined): boolean {
  return role === "admin" || role === "chief";
}

/** Кто может заводить чужие профили и менять роли. Без пароля кабинет открыт — можно настроить всех. */
export function canManageStaff(opts: { requireLogin: boolean; actor?: Doctor | null }): boolean {
  if (!opts.requireLogin || !opts.actor) return true;
  return isManagerRole(opts.actor.role);
}

/** Первый запуск: ещё нет ни одного врача с паролем. */
export function needsFirstRun(doctors: Doctor[] | undefined): boolean {
  return !(doctors ?? []).some((d) => d.active !== false && Boolean(d.passwordHash));
}
