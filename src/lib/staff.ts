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

export function activeDoctors(doctors: Doctor[] | undefined): Doctor[] {
  return (doctors ?? []).filter((d) => d.active !== false);
}

export function isLastActiveAccount(doctors: Doctor[] | undefined, doctorId: string | null | undefined): boolean {
  if (!doctorId) return false;
  const active = activeDoctors(doctors);
  return active.length === 1 && active[0].id === doctorId;
}

export function hasActiveManager(doctors: Doctor[] | undefined): boolean {
  return activeDoctors(doctors).some((d) => isManagerRole(d.role));
}

/** Кто может заводить чужие профили и менять роли. Последний включённый аккаунт не блокируется. */
export function canManageStaff(opts: { requireLogin: boolean; actor?: Doctor | null; doctors?: Doctor[] }): boolean {
  if (!opts.requireLogin || !opts.actor) return true;
  if (isManagerRole(opts.actor.role)) return true;
  return isLastActiveAccount(opts.doctors, opts.actor.id);
}

/** Своя роль: менеджер, единственный включённый, либо среди включённых нет главврача/админа. */
export function canChangeOwnRole(opts: { requireLogin: boolean; actor?: Doctor | null; doctors?: Doctor[] }): boolean {
  if (canManageStaff(opts)) return true;
  if (!opts.actor) return false;
  return !hasActiveManager(opts.doctors);
}

/** Первый запуск: ещё нет ни одного врача с паролем — даже выключенного. */
export function hasPasswordAccount(doctors: Doctor[] | undefined): boolean {
  return (doctors ?? []).some((d) => Boolean(d.passwordHash));
}

export function needsFirstRun(doctors: Doctor[] | undefined): boolean {
  return !hasPasswordAccount(doctors);
}
