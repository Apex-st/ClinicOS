import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { PeriodSwitch } from "@/components/period-switch";
import { Field, Select } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { VISIT_KIND_LABEL, VISIT_KIND_ORDER } from "@/lib/diary";
import { formatDate, fullName, money } from "@/lib/format";
import {
  buildClinicStats,
  PERIOD_OPTIONS,
  periodRange,
  statsToCsv,
  type PeriodKey,
} from "@/lib/stats";
import { useClinic } from "@/lib/store";
import type { VisitKind } from "@/lib/types";
import { downloadBlob } from "@/lib/utils";

export const Route = createFileRoute("/stats")({ component: StatsPage });

function StatsPage() {
  const visits = useClinic((s) => s.visits);
  const patients = useClinic((s) => s.patients);
  const services = useClinic((s) => s.services);
  const doctors = useClinic((s) => s.doctors);
  const diagnoses = useClinic((s) => s.diagnoses);
  const [period, setPeriod] = useState<PeriodKey>("month");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [doctorId, setDoctorId] = useState("");

  const range = useMemo(() => periodRange(period, from, to), [period, from, to]);
  const stats = useMemo(
    () => buildClinicStats(visits, patients, services, range, doctorId || undefined, diagnoses),
    [visits, patients, services, range, doctorId, diagnoses],
  );

  const kindMax = Math.max(1, ...VISIT_KIND_ORDER.map((k) => stats.byKind[k]));

  return (
    <div className="flex flex-col gap-5 print:gap-3">
      <header className="flex flex-col gap-3">
        <PeriodSwitch value={period} onChange={setPeriod} options={PERIOD_OPTIONS} />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <h1 className="font-display text-3xl">Статистика</h1>
          <div className="flex flex-wrap gap-2 print:hidden">
            <Button
              variant="outline"
              type="button"
              onClick={() =>
                downloadBlob(new Blob([statsToCsv(stats)], { type: "text/csv;charset=utf-8" }), `denta-stat-${stats.from}-${stats.to}.csv`)
              }
            >
              CSV
            </Button>
            <Button variant="secondary" type="button" onClick={() => window.print()}>
              Печать / PDF
            </Button>
          </div>
        </div>
      </header>

      <section className="flex flex-col gap-3 rounded-xl bg-surface p-4 shadow-[var(--shadow-card)] print:shadow-none">
        {period === "custom" ? (
          <div className="grid max-w-md grid-cols-2 gap-3">
            <Field label="С">
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </Field>
            <Field label="По">
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </Field>
          </div>
        ) : null}
        {doctors.length > 1 ? (
          <Field label="Врач" className="max-w-xs">
            <Select value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
              <option value="">Все врачи</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {fullName(d)}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Пациенты в картотеке" value={String(stats.patientsTotal)} />
        <Tile label="Новых за период" value={String(stats.newPatients)} />
        <Tile label="Приёмов" value={String(stats.visitsTotal)} />
        <Tile label="Пациентов на приёме" value={String(stats.uniquePatients)} />
        <Tile label="Первичных" value={String(stats.byKind.primary)} />
        <Tile label="Повторных" value={String(stats.byKind.repeat)} />
        <Tile label="Контрольных" value={String(stats.byKind.control)} />
        <Tile label="Экстренных" value={String(stats.byKind.emergency)} />
      </section>

      <Card title="Откуда пришли новые пациенты">
        {stats.bySource.length === 0 ? (
          <Empty hint="За период новых карточек нет — или источник не указан." />
        ) : (
          stats.bySource.map((d) => (
            <Bar key={d.id} label={d.name} value={d.count} max={stats.bySource[0]?.count ?? 1} />
          ))
        )}
      </Card>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Кариес, зубов" value={String(stats.diagnoses.find((d) => d.id === "caries")?.count ?? 0)} />
        <Tile label="Пульпит, зубов" value={String(stats.diagnoses.find((d) => d.id === "pulpitis")?.count ?? 0)} />
        <Tile label="Периодонтит, зубов" value={String(stats.diagnoses.find((d) => d.id === "periodontitis")?.count ?? 0)} />
        <Tile label="Касса" value={money(stats.finance.paid)} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card title="Приёмы по типу">
          {VISIT_KIND_ORDER.map((k: VisitKind) => (
            <Bar key={k} label={VISIT_KIND_LABEL[k]} value={stats.byKind[k]} max={kindMax} />
          ))}
        </Card>
        <Card title="Финансы">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <Row k="Оказано" v={money(stats.finance.rendered)} />
            <Row k="Оплачено" v={money(stats.finance.paid)} />
            <Row k="Долг" v={money(stats.finance.debt)} />
            <Row k="Средний чек" v={money(stats.finance.avgCheck)} />
            <Row k="Оплат" v={String(stats.finance.payments)} />
          </dl>
        </Card>
      </section>

      <Card title="Диагнозы (зубы)">
        {stats.diagnoses.length === 0 ? (
          <Empty hint="Появятся, когда в дневнике укажете диагноз на зуб." />
        ) : (
          stats.diagnoses.map((d) => (
            <Bar key={d.id} label={d.name} value={d.count} max={stats.diagnoses[0]?.count ?? 1} />
          ))
        )}
      </Card>

      <Card title="Выполненные процедуры">
        {stats.treatments.length === 0 ? (
          <Empty hint="Отметьте лечение в дневнике — попадёт сюда." />
        ) : (
          stats.treatments.map((d) => (
            <Bar key={d.id} label={d.name} value={d.count} max={stats.treatments[0]?.count ?? 1} />
          ))
        )}
      </Card>

      <Card title="Услуги прайса">
        {stats.services.length === 0 ? (
          <Empty hint="Нет оказанных услуг за период." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[12px] text-muted">
                <th className="py-1 font-medium">Услуга</th>
                <th className="py-1 font-medium">Кол-во</th>
                <th className="py-1 text-right font-medium">Сумма</th>
              </tr>
            </thead>
            <tbody>
              {stats.services.map((s) => (
                <tr key={s.id} className="border-t border-line">
                  <td className="py-2">{s.name}</td>
                  <td className="py-2 tabular-nums">{s.count}</td>
                  <td className="py-2 text-right tabular-nums">{money(s.amount ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card title="Зубы, которые лечили чаще">
        {stats.teeth.length === 0 ? (
          <Empty hint="Укажите номер зуба в дневнике или услуге." />
        ) : (
          stats.teeth.slice(0, 16).map((d) => (
            <Bar key={d.id} label={d.name} value={d.count} max={stats.teeth[0]?.count ?? 1} />
          ))
        )}
      </Card>

      <Card title="По месяцам">
        {stats.monthly.length === 0 ? (
          <Empty hint="Нет приёмов в этом периоде." />
        ) : (
          stats.monthly.map((m) => (
            <div key={m.month} className="grid grid-cols-[88px_1fr_auto] items-center gap-2 py-1">
              <span className="text-[13px] text-muted">{m.month}</span>
              <Bar bare value={m.visits} max={Math.max(1, ...stats.monthly.map((x) => x.visits))} />
              <span className="text-right text-[12px] tabular-nums text-muted">
                {m.visits} пр. · {m.patients} пац. · {money(m.paid)}
              </span>
            </div>
          ))
        )}
      </Card>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface px-4 py-3 shadow-[var(--shadow-card)]">
      <p className="text-[12px] text-muted">{label}</p>
      <p className="mt-1 font-display text-2xl tabular-nums">{value}</p>
    </div>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl bg-surface p-4 shadow-[var(--shadow-card)]">
      <h2 className="mb-3 font-display text-lg">{title}</h2>
      {children}
    </section>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-[12px] text-muted">{k}</dt>
      <dd className="font-medium tabular-nums">{v}</dd>
    </div>
  );
}

function Empty({ hint }: { hint: string }) {
  return <p className="text-sm text-muted">{hint}</p>;
}

function Bar({ label, value, max, bare }: { label?: string; value: number; max: number; bare?: boolean }) {
  const w = Math.round((value / Math.max(1, max)) * 100);
  const bar = (
    <div className="h-2 overflow-hidden rounded-full bg-surface-2">
      <div className="h-2 rounded-full bg-primary" style={{ width: `${w}%` }} />
    </div>
  );
  if (bare) return bar;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_2.5rem] items-center gap-2 py-1">
      <div className="min-w-0">
        <div className="flex justify-between gap-2 text-[13px]">
          <span className="truncate">{label}</span>
        </div>
        {bar}
      </div>
      <span className="text-right text-sm tabular-nums">{value}</span>
    </div>
  );
}
