import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { CalendarPlus, MessageSquare, Phone } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { formatDate, fullName, phoneHref, todayISO, waHref } from "@/lib/format";
import {
  daysSinceLastVisit,
  FOLLOW_TODAY,
  lastVisitDate,
  lastVisitReason,
  monthsSinceLastVisit,
  RECALL_STATUS_LABEL,
} from "@/lib/recall";
import { useClinic } from "@/lib/store";
import type { RecallStatus } from "@/lib/types";

export const Route = createFileRoute("/recall")({ component: RecallPage });

const PRESETS = [
  { label: "3 месяца", days: 90 },
  { label: "6 месяцев", days: 180 },
  { label: "9 месяцев", days: 270 },
  { label: "12 месяцев", days: 365 },
];

function RecallPage() {
  const patients = useClinic((s) => s.patients);
  const visits = useClinic((s) => s.visits);
  const appointments = useClinic((s) => s.appointments);
  const services = useClinic((s) => s.services);
  const settings = useClinic((s) => s.settings);
  const [days, setDays] = useState(settings.recallDays || 180);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"" | RecallStatus>("");
  const [sort, setSort] = useState<"days" | "date">("days");
  const navigate = useNavigate();

  const rows = useMemo(() => {
    const query = q.trim().toLowerCase();
    const list = patients
      .map((p) => {
        const last = lastVisitDate(p.id, visits, appointments);
        const d = daysSinceLastVisit(last);
        const m = monthsSinceLastVisit(last);
        return {
          p,
          last,
          days: d,
          months: m,
          reason: lastVisitReason(p.id, visits, services),
          due: d == null || d >= days,
        };
      })
      .filter((r) => r.due)
      .filter((r) => (status ? r.p.recallStatus === status : true))
      .filter((r) => {
        if (!query) return true;
        const hay = `${fullName(r.p)} ${r.p.phone} ${r.p.cardNumber}`.toLowerCase();
        return hay.includes(query);
      });
    list.sort((a, b) => {
      if (sort === "date") return (a.last ?? "").localeCompare(b.last ?? "");
      return (b.days ?? 99999) - (a.days ?? 99999);
    });
    return list;
  }, [patients, visits, appointments, services, days, q, status, sort]);

  return (
    <div className="flex flex-col gap-5">
      <header>
        <p className="text-[13px] text-muted">Повторный приём</p>
        <h1 className="font-display text-3xl">Пациенты для приглашения</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Кто не был {days} дней и дольше. Интервал можно сменить здесь или в настройках.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {PRESETS.map((pr) => (
          <Button key={pr.days} size="sm" variant={days === pr.days ? "default" : "secondary"} onClick={() => setDays(pr.days)}>
            {pr.label}
          </Button>
        ))}
        <label className="flex h-9 items-center gap-2 rounded-md bg-surface px-3 text-sm shadow-[var(--shadow-card)]">
          Свой
          <input
            className="w-16 bg-transparent tabular-nums outline-none"
            type="number"
            min={1}
            value={days}
            onChange={(e) => setDays(Math.max(1, Number(e.target.value) || 1))}
          />
          дн.
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Поиск">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ФИО или телефон" />
        </Field>
        <Field label="Статус контакта">
          <Select value={status} onChange={(e) => setStatus(e.target.value as "" | RecallStatus)}>
            <option value="">Все</option>
            {(Object.keys(RECALL_STATUS_LABEL) as RecallStatus[]).map((s) => (
              <option key={s} value={s}>
                {RECALL_STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Сортировка">
          <Select value={sort} onChange={(e) => setSort(e.target.value as "days" | "date")}>
            <option value="days">По дням отсутствия</option>
            <option value="date">По дате последнего визита</option>
          </Select>
        </Field>
      </div>

      <p className="text-sm text-muted">{rows.length} пациентов</p>

      <div className="overflow-x-auto rounded-xl bg-surface shadow-[var(--shadow-card)]">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="text-[12px] text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Пациент</th>
              <th className="px-3 py-3 font-medium">Телефон</th>
              <th className="px-3 py-3 font-medium">Последний приём</th>
              <th className="px-3 py-3 font-medium">Прошло</th>
              <th className="px-3 py-3 font-medium">Врач</th>
              <th className="px-3 py-3 font-medium">Причина</th>
              <th className="px-3 py-3 font-medium">Статус</th>
              <th className="px-3 py-3 font-medium">Действие</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ p, last, days: d, months: m, reason }) => (
              <tr key={p.id} className="border-t border-line">
                <td className="px-4 py-3">
                  <Link to="/patients/$id" params={{ id: p.id }} className="font-medium hover:text-primary">
                    {fullName(p)}
                  </Link>
                  <p className="text-[12px] text-muted">{p.cardNumber}</p>
                </td>
                <td className="px-3 py-3 whitespace-nowrap">{p.phone || "—"}</td>
                <td className="px-3 py-3 whitespace-nowrap">{last ? formatDate(last, "d.MM.yyyy") : "не было"}</td>
                <td className="px-3 py-3">
                  {d == null ? "нет приёмов" : `${d} дн.`}
                  {m != null && m > 0 ? <span className="text-muted"> · {m} мес.</span> : null}
                </td>
                <td className="px-3 py-3">{settings.doctorName}</td>
                <td className="max-w-[160px] truncate px-3 py-3">{reason}</td>
                <td className="px-3 py-3">
                  <Badge tone={FOLLOW_TODAY.includes(p.recallStatus) ? "warn" : "muted"}>
                    {RECALL_STATUS_LABEL[p.recallStatus]}
                  </Badge>
                </td>
                <td className="px-3 py-3">
                  <div className="flex flex-wrap gap-1">
                    {p.phone ? (
                      <a href={phoneHref(p.phone)} className="grid size-9 place-items-center rounded-md hover:bg-surface-2" aria-label="Позвонить">
                        <Phone className="size-4" />
                      </a>
                    ) : null}
                    {p.phone ? (
                      <a
                        href={waHref(p.phone, `Здравствуйте, ${p.firstName}! Напоминаем о профилактическом осмотре.`)}
                        target="_blank"
                        rel="noreferrer"
                        className="grid size-9 place-items-center rounded-md hover:bg-surface-2"
                        aria-label="Написать"
                      >
                        <MessageSquare className="size-4" />
                      </a>
                    ) : null}
                    <button
                      type="button"
                      className="grid size-9 place-items-center rounded-md hover:bg-surface-2"
                      aria-label="Записать"
                      onClick={() =>
                        void navigate({
                          to: "/schedule/new",
                          search: { date: todayISO(), start: "10:00", patientId: p.id },
                        } as never)
                      }
                    >
                      <CalendarPlus className="size-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? <p className="px-4 py-8 text-sm text-muted">Никого по этому фильтру</p> : null}
      </div>
    </div>
  );
}
