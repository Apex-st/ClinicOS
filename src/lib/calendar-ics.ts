import { addMinutes, parseISO } from "date-fns";
import { fullName, fromMinutes, minutesOf } from "./format";
import type { Appointment, Patient, Service, Settings } from "./types";
import { downloadBlob } from "./utils";

function stamp(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;
}

function local(date: string, time: string) {
  const [h, m] = time.split(":");
  return `${date.replace(/-/g, "")}T${(h ?? "00").padStart(2, "0")}${(m ?? "00").padStart(2, "0")}00`;
}

function esc(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

function fold(line: string) {
  const out: string[] = [];
  let rest = line;
  while (rest.length > 73) {
    out.push(rest.slice(0, 73));
    rest = " " + rest.slice(73);
  }
  out.push(rest);
  return out.join("\r\n");
}

export function appointmentEvent(
  a: Appointment,
  patient: Patient | undefined,
  settings: Settings,
  services: Service[],
  alarmMin: number,
) {
  const who = patient ? fullName(patient) : "Пациент";
  const svc = services.find((s) => s.id === a.serviceId);
  const start = local(a.date, a.start);
  const endTime = fromMinutes(minutesOf(a.start) + a.durationMin);
  const end = local(a.date, endTime);
  const summary = `${who}${svc ? ` — ${svc.name}` : ""}`;
  const desc = [svc?.name, a.notes, settings.clinicName].filter(Boolean).join("\\n");
  const lines = [
    "BEGIN:VEVENT",
    `UID:${a.id}@denta-cabinet`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    fold(`SUMMARY:${esc(summary)}`),
    fold(`DESCRIPTION:${esc(desc.replace(/\\n/g, "\n"))}`),
    settings.address ? fold(`LOCATION:${esc(settings.address)}`) : "",
    "BEGIN:VALARM",
    `TRIGGER:-PT${Math.max(5, alarmMin)}M`,
    "ACTION:DISPLAY",
    fold(`DESCRIPTION:Приём: ${esc(who)}`),
    "END:VALARM",
    "END:VEVENT",
  ].filter(Boolean);
  return lines.join("\r\n");
}

export function buildIcs(
  items: Appointment[],
  patients: Patient[],
  settings: Settings,
  services: Service[],
  alarmMin: number,
) {
  const events = items
    .filter((a) => a.status !== "cancelled" && a.status !== "no_show")
    .map((a) => appointmentEvent(a, patients.find((p) => p.id === a.patientId), settings, services, alarmMin));
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ClinicOS//Cabinet//RU",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");
}

export function icsBlob(
  items: Appointment[],
  patients: Patient[],
  settings: Settings,
  services: Service[],
  alarmMin: number,
) {
  const ics = buildIcs(items, patients, settings, services, alarmMin);
  return new Blob([ics], { type: "text/calendar;charset=utf-8" });
}

export function downloadAppointmentsIcs(
  items: Appointment[],
  patients: Patient[],
  settings: Settings,
  services: Service[],
  alarmMin: number,
  filename = "denta-raspisanie.ics",
) {
  downloadBlob(icsBlob(items, patients, settings, services, alarmMin), filename);
}

export function googleCalendarUrl(
  a: Appointment,
  patient: Patient | undefined,
  settings: Settings,
  services: Service[],
) {
  const who = patient ? fullName(patient) : "Пациент";
  const svc = services.find((s) => s.id === a.serviceId);
  const start = local(a.date, a.start);
  const end = local(a.date, fromMinutes(minutesOf(a.start) + a.durationMin));
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `${who}${svc ? ` — ${svc.name}` : ""}`,
    dates: `${start}/${end}`,
    details: [svc?.name, a.notes, settings.clinicName].filter(Boolean).join("\n"),
    location: settings.address || "",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function appointmentWhen(a: Appointment) {
  return parseISO(`${a.date}T${a.start}:00`);
}

export function appointmentEnd(a: Appointment) {
  return addMinutes(appointmentWhen(a), a.durationMin);
}

export interface ImportedEvent {
  uid: string;
  title: string;
  date: string;
  start: string;
  durationMin: number;
  notes: string;
  allDay: boolean;
}

function unfoldIcs(text: string) {
  return text.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "");
}

function icsUnesc(s: string) {
  return s.replace(/\\n/gi, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\");
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function parseIcsDate(value: string): { date: string; time: string; allDay: boolean } | null {
  const v = value.trim();
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?/);
  if (!m) return null;
  if (!m[4]) return { date: `${m[1]}-${m[2]}-${m[3]}`, time: "09:00", allDay: true };
  if (m[7] === "Z") {
    const d = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`);
    if (Number.isNaN(d.getTime())) return null;
    return {
      date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
      allDay: false,
    };
  }
  return { date: `${m[1]}-${m[2]}-${m[3]}`, time: `${m[4]}:${m[5]}`, allDay: false };
}

function durationFromIso(value: string) {
  const m = value.trim().match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i);
  if (!m) return 0;
  const days = Number(m[1] || 0);
  const hours = Number(m[2] || 0);
  const mins = Number(m[3] || 0);
  return days * 24 * 60 + hours * 60 + mins;
}

export function parseIcs(text: string): ImportedEvent[] {
  const src = unfoldIcs(text).replace(/\r\n/g, "\n");
  const blocks = src.split(/BEGIN:VEVENT/i).slice(1);
  const out: ImportedEvent[] = [];
  for (const block of blocks) {
    const body = block.split(/END:VEVENT/i)[0] ?? "";
    const field = (name: string) => {
      const re = new RegExp(`^${name}[^:]*:(.*)$`, "im");
      const hit = body.match(re);
      return hit ? hit[1].trim() : "";
    };
    const startRaw = field("DTSTART");
    if (!startRaw) continue;
    const start = parseIcsDate(startRaw);
    if (!start) continue;
    let durationMin = 30;
    const endRaw = field("DTEND");
    const durRaw = field("DURATION");
    if (durRaw) {
      durationMin = Math.max(5, durationFromIso(durRaw) || 30);
    } else if (endRaw) {
      const end = parseIcsDate(endRaw);
      if (end) {
        const a = new Date(`${start.date}T${start.time}:00`);
        const b = new Date(`${end.date}T${end.time}:00`);
        const mins = Math.round((b.getTime() - a.getTime()) / 60000);
        if (mins > 0) durationMin = Math.min(480, Math.max(5, mins));
      }
    }
    const title = icsUnesc(field("SUMMARY") || "Приём");
    out.push({
      uid: field("UID") || `ics_${out.length}`,
      title,
      date: start.date,
      start: start.time,
      durationMin,
      notes: icsUnesc([field("DESCRIPTION"), field("LOCATION")].filter(Boolean).join("\n")),
      allDay: start.allDay,
    });
  }
  return out.sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
}

export function matchImportedPatient(title: string, patients: Patient[]) {
  const parsed = nameFromEventTitle(title);
  const ln = parsed.lastName.trim().toLowerCase();
  const fn = parsed.firstName.trim().toLowerCase();
  if (!ln || !fn || fn === "б/и" || ln === "импорт") return undefined;
  return patients.find(
    (p) => p.lastName.trim().toLowerCase() === ln && p.firstName.trim().toLowerCase() === fn,
  );
}

/** ФИО из заголовка события календаря. */
export function nameFromEventTitle(title: string) {
  let t = title.replace(/\s+/g, " ").trim();
  t = t.replace(/^(приём|прием|пациент|patient|visit|appointment|запись)\s*[:\-–—]?\s*/i, "");
  t = t.split(/\s+[—–\-]\s+/)[0] ?? t;
  t = t.replace(/\s+\d{1,2}:\d{2}.*$/, "").trim();
  const parts = t.split(" ").filter(Boolean);
  if (parts.length >= 3) {
    return { lastName: parts[0], firstName: parts[1], middleName: parts.slice(2).join(" ") };
  }
  if (parts.length === 2) return { lastName: parts[0], firstName: parts[1], middleName: "" };
  if (parts.length === 1) return { lastName: parts[0], firstName: "б/и", middleName: "" };
  return { lastName: "Импорт", firstName: "календарь", middleName: "" };
}

export function importedPatientLabel(title: string) {
  const n = nameFromEventTitle(title);
  return [n.lastName, n.firstName, n.middleName].filter(Boolean).join(" ");
}


