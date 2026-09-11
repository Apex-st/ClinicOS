import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { ArrowRight, Plus, Stethoscope } from "lucide-react";
import { useState } from "react";
import { PatientDialog } from "@/components/patient-dialog";
import { ThemeToggle } from "@/components/theme-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { VisitDialog } from "@/components/visit-dialog";
import { dayAppointments, doctorCashShare, statusTone } from "@/lib/clinic";
import {
  formatDate,
  formatSoon,
  fullName,
  money,
  shortName,
  STATUS_LABEL,
  todayISO,
} from "@/lib/format";
import { daysSinceLastVisit, FOLLOW_TODAY, lastVisitDate } from "@/lib/recall";
import { upcomingReminders } from "@/lib/reminders";
import { appointmentNewPath } from "@/lib/schedule";
import { useClinic } from "@/lib/store";
import type { Appointment } from "@/lib/types";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const router = useRouter();
  const patients = useClinic((s) => s.patients);
  const appointments = useClinic((s) => s.appointments);
  const visits = useClinic((s) => s.visits);
  const services = useClinic((s) => s.services);
  const doctors = useClinic((s) => s.doctors);
  const today = todayISO();
  const list = dayAppointments(appointments, today);
  const inChair = list.find((a) => a.status === "in_chair");
  const next = list.find((a) => a.status === "scheduled" || a.status === "confirmed");

  const todayVisits = visits.filter((v) => v.date === today);
  const revenueToday = todayVisits.reduce((s, v) => s + v.paid, 0);
  const doctorToday = doctorCashShare(todayVisits, appointments, doctors).reduce((s, r) => s + r.share, 0);
  const upcoming = appointments
    .filter((a) => a.date > today && a.status !== "cancelled")
    .slice()
    .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))[0];

  const [patientOpen, setPatientOpen] = useState(false);
  const [visitFor, setVisitFor] = useState<Appointment | null>(null);

  function bookToday() {
    router.history.push(appointmentNewPath({ date: today, start: "09:00" }));
  }

  const dateTitle = format(new Date(), "EEEE, d MMMM", { locale: ru });
  const heading = dateTitle.charAt(0).toUpperCase() + dateTitle.slice(1);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl text-ink sm:text-4xl">{heading}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ThemeToggle variant="header" />
          <Button variant="secondary" onClick={() => setPatientOpen(true)}>
            Новый пациент
          </Button>
          <Button onClick={bookToday}>
            <Plus className="size-4" />
            Записать
          </Button>
        </div>
      </header>

      <section className="rounded-xl bg-surface px-1 py-3 shadow-[var(--shadow-card)] sm:px-2 sm:py-4">
        <div className="grid grid-cols-3 divide-x divide-line">
          <Stat label="Приёмов сегодня" value={String(list.filter((a) => a.status !== "cancelled").length)} />
          <Stat label="Касса за день" value={money(revenueToday)} />
          <Stat label="Доля врача" value={money(doctorToday)} />
        </div>
      </section>

      {inChair ? (
        <section className="rounded-xl bg-chair px-5 py-4 text-primary-fg">
          <p className="text-[12px] tracking-wide uppercase opacity-80">Сейчас в кресле</p>
          <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
            <p className="font-display text-2xl">
              {shortName(patients.find((p) => p.id === inChair.patientId) ?? { lastName: "—", firstName: "", middleName: "" })}
            </p>
            <Button
              variant="secondary"
              onClick={() => setVisitFor(inChair)}
            >
              <Stethoscope className="size-4" />
              Продолжить приём
            </Button>
          </div>
        </section>
      ) : next ? (
        <section className="rounded-xl bg-primary px-5 py-4 text-primary-fg">
          <p className="text-[12px] tracking-wide uppercase opacity-80">Следующий</p>
          <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="font-display text-2xl">
                {shortName(patients.find((p) => p.id === next.patientId) ?? { lastName: "—", firstName: "", middleName: "" })}
              </p>
              <p className="mt-1 text-sm text-primary-fg/80">
                {next.start} · {services.find((s) => s.id === next.serviceId)?.name ?? "Приём"}
              </p>
            </div>
            <Button variant="secondary" onClick={() => setVisitFor(next)}>
              Начать приём
            </Button>
          </div>
        </section>
      ) : (
        <section className="rounded-xl bg-surface px-5 py-8 text-center shadow-[var(--shadow-card)]">
          <p className="font-display text-xl">На сегодня записей нет</p>
          <Button className="mt-4" onClick={bookToday}>
            Записать на сегодня
          </Button>
        </section>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-xl">Журнал дня</h2>
          <Link to="/schedule" className="inline-flex items-center gap-1 text-sm text-primary">
            Расписание <ArrowRight className="size-4" />
          </Link>
        </div>
        {list.length === 0 ? (
          <p className="text-sm text-muted">Пусто</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {list.map((a) => {
              const p = patients.find((x) => x.id === a.patientId);
              const svc = services.find((s) => s.id === a.serviceId);
              return (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => {
                      if (a.status === "cancelled" || a.status === "no_show" || a.status === "done") return;
                      setVisitFor(a);
                    }}
                    className="flex w-full items-center gap-3 rounded-lg bg-surface px-3 py-3 text-left shadow-[var(--shadow-card)] sm:px-4"
                  >
                    <p className="w-14 shrink-0 font-medium tabular-nums">{a.start}</p>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{p ? fullName(p) : "Пациент"}</p>
                      <p className="truncate text-[13px] text-muted">
                        {svc?.name ?? "Приём"} · {a.durationMin} мин
                      </p>
                    </div>
                    <Badge tone={statusTone(a.status)}>{STATUS_LABEL[a.status]}</Badge>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <SoonReminders />

      <RecallAttention />

      <section className="rounded-xl bg-surface p-4 shadow-[var(--shadow-card)]">
        <h2 className="font-display text-lg">Ближайшая запись</h2>
        {upcoming ? (
          <p className="mt-2 text-sm">
            {shortName(patients.find((p) => p.id === upcoming.patientId) ?? { lastName: "—", firstName: "", middleName: "" })}
            <span className="text-muted">
              {" "}
              · {formatDate(upcoming.date, "d MMMM")} в {upcoming.start}
            </span>
          </p>
        ) : (
          <p className="mt-2 text-sm text-muted">Нет записей на следующие дни</p>
        )}
      </section>

      <PatientDialog open={patientOpen} onOpenChange={setPatientOpen} />
      <VisitDialog
        open={Boolean(visitFor)}
        onOpenChange={(o) => !o && setVisitFor(null)}
        appointment={visitFor}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 px-2 sm:px-4">
      <p className="text-[11px] leading-tight text-muted sm:text-[12px]">{label}</p>
      <p className="mt-1 truncate font-display text-lg tabular-nums sm:text-2xl">{value}</p>
    </div>
  );
}

function SoonReminders() {
  const appointments = useClinic((s) => s.appointments);
  const patients = useClinic((s) => s.patients);
  const services = useClinic((s) => s.services);
  const settings = useClinic((s) => s.settings);
  const items = upcomingReminders(appointments, patients, services, settings.reminderMinutes ?? 60).slice(0, 4);
  if (items.length === 0) return null;
  return (
    <section className="rounded-xl bg-surface p-4 shadow-[var(--shadow-card)]">
      <h2 className="font-display text-lg">Напоминания</h2>
      <ul className="mt-3 flex flex-col gap-2">
        {items.map((it) => (
          <li key={it.id} className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate">{it.body}</span>
            <span className="shrink-0 tabular-nums text-muted">
              {it.minutesLeft <= 0 ? "сейчас" : formatSoon(it.minutesLeft)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function RecallAttention() {
  const patients = useClinic((s) => s.patients);
  const visits = useClinic((s) => s.visits);
  const appointments = useClinic((s) => s.appointments);
  let over6 = 0;
  let over12 = 0;
  let today = 0;
  for (const p of patients) {
    const last = lastVisitDate(p.id, visits, appointments);
    const d = daysSinceLastVisit(last);
    if (d == null || d >= 180) over6 += 1;
    if (d == null || d >= 365) over12 += 1;
    if (FOLLOW_TODAY.includes(p.recallStatus)) today += 1;
  }
  return (
    <Link
      to="/recall"
      className="block rounded-xl bg-surface p-4 shadow-[var(--shadow-card)] transition-[box-shadow] hover:shadow-[var(--shadow-lift)]"
    >
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg">Пациенты, требующие внимания</h2>
        <ArrowRight className="size-4 text-primary" />
      </div>
      <dl className="mt-3 grid gap-2 sm:grid-cols-3 text-sm">
        <div>
          <dt className="text-[12px] text-muted">Не были более 6 месяцев</dt>
          <dd className="font-display text-2xl tabular-nums">{over6}</dd>
        </div>
        <div>
          <dt className="text-[12px] text-muted">Не были более 12 месяцев</dt>
          <dd className="font-display text-2xl tabular-nums">{over12}</dd>
        </div>
        <div>
          <dt className="text-[12px] text-muted">Связаться сегодня</dt>
          <dd className="font-display text-2xl tabular-nums">{today}</dd>
        </div>
      </dl>
    </Link>
  );
}
