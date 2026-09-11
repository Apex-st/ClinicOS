import { differenceInMinutes } from "date-fns";
import { appointmentWhen } from "./calendar-ics";
import { formatSoon, fullName } from "./format";
import type { Appointment, Patient, Service } from "./types";

const FIRED_KEY = "denta-reminder-fired";
const SW_PATH = "/sw.js";

export function loadFired(): Set<string> {
  try {
    const raw = localStorage.getItem(FIRED_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

export function markFired(id: string) {
  const set = loadFired();
  set.add(id);
  const keep = [...set].slice(-200);
  localStorage.setItem(FIRED_KEY, JSON.stringify(keep));
}

export interface ReminderItem {
  id: string;
  appointmentId: string;
  at: Date;
  title: string;
  body: string;
  minutesLeft: number;
}

export function upcomingReminders(
  appointments: Appointment[],
  patients: Patient[],
  services: Service[],
  reminderMinutes: number,
  now = new Date(),
): ReminderItem[] {
  const list: ReminderItem[] = [];
  for (const a of appointments) {
    if (a.status === "cancelled" || a.status === "no_show" || a.status === "done") continue;
    const start = appointmentWhen(a);
    const mins = differenceInMinutes(start, now);
    if (mins < -5 || mins > 180 * 24 * 60) continue;
    const p = patients.find((x) => x.id === a.patientId);
    const svc = services.find((s) => s.id === a.serviceId);
    const who = p ? fullName(p) : "Пациент";
    list.push({
      id: `${a.id}:${a.date}:${a.start}`,
      appointmentId: a.id,
      at: start,
      title: mins <= 0 ? "Пациент уже должен быть" : `Приём через ${formatSoon(mins)}`,
      body: `${who}${svc ? ` · ${svc.name}` : ""} · ${a.start}`,
      minutesLeft: mins,
    });
  }
  return list.sort((a, b) => a.minutesLeft - b.minutesLeft);
}

export function dueNow(items: ReminderItem[], reminderMinutes: number) {
  return items.filter((it) => it.minutesLeft <= reminderMinutes);
}

export function notifySupported() {
  return typeof window !== "undefined" && "Notification" in window;
}

export function isStandaloneApp() {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || window.matchMedia("(display-mode: standalone)").matches;
}

export function isIosDevice() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export async function ensureServiceWorker() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register(SW_PATH);
  } catch {
    return null;
  }
}

export async function notify(title: string, body: string, tag = "denta", url = "/schedule") {
  try {
    if (!notifySupported()) return false;
    if (Notification.permission !== "granted") return false;
    const options: NotificationOptions = {
      body,
      tag,
      lang: "ru",
      icon: "/__grok/icon-180.png",
      badge: "/favicon.svg",
      requireInteraction: true,
      silent: false,
      data: { url },
    };
    const reg = await navigator.serviceWorker?.ready.catch(() => undefined);
    if (reg?.showNotification) {
      await reg.showNotification(title, options);
      return true;
    }
    new Notification(title, options);
    return true;
  } catch {
    return false;
  }
}

export async function ensureNotifyPermission() {
  if (!notifySupported()) return "unsupported" as const;
  if (Notification.permission === "granted") {
    await ensureServiceWorker();
    return "granted" as const;
  }
  if (Notification.permission === "denied") return "denied" as const;
  const res = await Notification.requestPermission();
  if (res === "granted") {
    await ensureServiceWorker();
    return "granted" as const;
  }
  return "denied" as const;
}
