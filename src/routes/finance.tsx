import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronDown, Trash2, UserRound } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PeriodSwitch } from "@/components/period-switch";
import { SwipeRow } from "@/components/swipe-row";
import { ConfirmDialog } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, Select } from "@/components/ui/field";
import { NumericInput } from "@/components/ui/numeric-input";
import { VisitDialog } from "@/components/visit-dialog";
import { patientBalance, doctorCashShare, isVoided } from "@/lib/clinic";
import {
  formatDate,
  fullName,
  money,
  PAYMENT_LABEL,
  shortName,
  todayISO,
} from "@/lib/format";
import { useLongPress } from "@/lib/long-press";
import { useClinic } from "@/lib/store";
import { useSession } from "@/lib/session";
import { usePeriodSwipe } from "@/lib/use-period-swipe";
import type { PaymentMethod, Visit } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/finance")({ component: FinancePage });

type Period = "today" | "week" | "month" | "all";

const FINANCE_PERIODS: Array<{ id: Period; label: string }> = [
  { id: "today", label: "Сегодня" },
  { id: "week", label: "Неделя" },
  { id: "month", label: "Месяц" },
  { id: "all", label: "Всё" },
];

function FinancePage() {
  const visits = useClinic((s) => s.visits);
  const patients = useClinic((s) => s.patients);
  const appointments = useClinic((s) => s.appointments);
  const doctors = useClinic((s) => s.doctors);
  const addPayment = useClinic((s) => s.addPayment);
  const deleteVisit = useClinic((s) => s.deleteVisit);
  const voidVisit = useClinic((s) => s.voidVisit);
  const settings = useClinic((s) => s.settings);
  const sessionDoctorId = useSession((s) => s.doctorId);
  const [period, setPeriod] = useState<Period>("month");
  const [payId, setPayId] = useState<string | null>(null);
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [confirm, setConfirm] = useState(false);
  const [editVisit, setEditVisit] = useState<Visit | null>(null);
  const [swipedId, setSwipedId] = useState<string | null>(null);

  const swipe = usePeriodSwipe((dir) => {
    setPeriod((cur) => {
      const i = FINANCE_PERIODS.findIndex((p) => p.id === cur);
      const next = FINANCE_PERIODS[(i + dir + FINANCE_PERIODS.length) % FINANCE_PERIODS.length];
      return next.id;
    });
  });

  const filtered = useMemo(() => {
    const today = todayISO();
    const now = new Date();
    const month = today.slice(0, 7);
    const weekAgo = new Date(now);
    weekAgo.setDate(now.getDate() - 7);
    const weekIso = weekAgo.toISOString().slice(0, 10);
    return visits.filter((v) => {
      if (isVoided(v)) return false;
      if (period === "today") return v.date === today;
      if (period === "week") return v.date >= weekIso;
      if (period === "month") return v.date.startsWith(month);
      return true;
    });
  }, [visits, period]);

  const rendered = filtered.reduce((s, v) => s + v.total, 0);
  const paid = filtered.reduce((s, v) => s + v.paid, 0);
  const debt = visits.filter((v) => !isVoided(v)).reduce((s, v) => s + Math.max(0, v.total - v.paid), 0);
  const shares = doctorCashShare(filtered, appointments, doctors);
  const doctorTake = shares.reduce((s, r) => s + r.share, 0);
  const clinicTake = paid - doctorTake;
  const doctorPct = paid > 0 ? Math.round((doctorTake / paid) * 100) : 0;
  const clinicPct = paid > 0 ? 100 - doctorPct : 0;

  const debtors = patients
    .map((p) => ({ p, bal: patientBalance(visits, p.id) }))
    .filter((r) => r.bal > 0)
    .sort((a, b) => b.bal - a.bal);

  const paying = visits.find((v) => v.id === payId);
  const actor =
    doctors.find((d) => d.id === sessionDoctorId)?.lastName ||
    settings.doctorName ||
    "Администратор";
  const voided = useMemo(
    () => visits.filter((v) => isVoided(v)).sort((a, b) => (b.voidedAt || "").localeCompare(a.voidedAt || "")),
    [visits],
  );

  const pickedSet = useMemo(() => new Set(picked), [picked]);
  const shown = useMemo(
    () => filtered.slice().sort((a, b) => b.date.localeCompare(a.date)),
    [filtered],
  );

  function toggle(id: string) {
    setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  function toggleAll() {
    if (picked.length === shown.length) setPicked([]);
    else setPicked(shown.map((v) => v.id));
  }

  function stopSelect() {
    setSelecting(false);
    setPicked([]);
    setSwipedId(null);
  }

  return (
    <div className="flex flex-col gap-5" {...swipe}>
      <header className="flex flex-col gap-3">
        <PeriodSwitch value={period} onChange={setPeriod} options={FINANCE_PERIODS} />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <h1 className="font-display text-3xl">Касса</h1>
          <Link to="/budget">
            <Button type="button" variant="secondary">
              Бюджет
            </Button>
          </Link>
        </div>
      </header>

      <section className="rounded-xl bg-surface px-1 py-3 shadow-[var(--shadow-card)] sm:px-2 sm:py-4">
        <div className="grid grid-cols-3 divide-x divide-line">
          <Cell label="Оказано" value={money(rendered)} />
          <Cell label="Получено" value={money(paid)} />
          <Cell label="Долги" value={money(debt)} danger={debt > 0} />
        </div>
        <div className="mt-3 grid grid-cols-2 divide-x divide-line border-t border-line pt-3">
          <Cell
            label="Доля врача"
            value={money(doctorTake)}
            hint={
              shares.length === 1
                ? `${shares[0].percent}% от полученного`
                : paid > 0
                  ? `${doctorPct}% от кассы`
                  : "по проценту каждого врача"
            }
          />
          <Cell
            label="Кабинету"
            value={money(clinicTake)}
            hint={paid > 0 ? `${clinicPct}% от кассы` : "касса минус доля врача"}
          />
        </div>
      </section>

      {shares.some((r) => r.paid > 0) && doctors.length > 0 ? (
        <FoldSection title="Расчёт с врачом">
          <ul className="flex flex-col overflow-hidden rounded-xl bg-surface shadow-[var(--shadow-card)]">
            {shares.map((r, i) => (
              <li
                key={r.doctor.id}
                className={`flex flex-wrap items-baseline justify-between gap-2 px-4 py-3 ${i ? "border-t border-line" : ""}`}
              >
                <div>
                  <p className="text-sm font-medium">{shortName(r.doctor)}</p>
                  <p className="text-[12px] text-muted">{r.percent}% от {money(r.paid)}</p>
                </div>
                <p className="text-sm tabular-nums">{money(r.share)}</p>
              </li>
            ))}
          </ul>
        </FoldSection>
      ) : null}

      <FoldSection
        title="Приёмы"
        extra={
          selecting ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" type="button" size="sm" onClick={toggleAll}>
                {picked.length === shown.length ? "Снять все" : "Выбрать все"}
              </Button>
              <Button
                variant="danger"
                type="button"
                size="sm"
                disabled={picked.length === 0}
                onClick={() => setConfirm(true)}
              >
                <Trash2 className="size-4" />
                Удалить ({picked.length})
              </Button>
              <Button variant="ghost" type="button" size="sm" onClick={stopSelect}>
                Сброс
              </Button>
            </div>
          ) : shown.length > 0 ? (
            <Button
              variant="ghost"
              type="button"
              size="sm"
              onClick={() => {
                setSelecting(true);
                setPicked([]);
              }}
            >
              Выбрать
            </Button>
          ) : null
        }
      >
        {shown.length === 0 ? (
          <p className="text-sm text-muted">Нет операций за период</p>
        ) : (
          <ul className="flex flex-col overflow-hidden rounded-xl bg-surface shadow-[var(--shadow-card)]">
            {shown.map((v, i) => {
              const p = patients.find((x) => x.id === v.patientId);
              const due = v.total - v.paid;
              return (
                <VisitRow
                  key={v.id}
                  visit={v}
                  name={p ? fullName(p) : "Пациент"}
                  due={due}
                  first={i === 0}
                  selecting={selecting}
                  picked={pickedSet.has(v.id)}
                  swiped={swipedId === v.id}
                  onSwipe={(open) => setSwipedId(open ? v.id : null)}
                  onToggle={() => toggle(v.id)}
                  onStartSelect={() => {
                    setSelecting(true);
                    setPicked((cur) => (cur.includes(v.id) ? cur : [...cur, v.id]));
                  }}
                  onPay={() => {
                    setPayId(v.id);
                    setAmount(due);
                  }}
                  onEdit={() => setEditVisit(v)}
                />
              );
            })}
          </ul>
        )}
      </FoldSection>

      <FoldSection title="Долги">
        {debtors.length === 0 ? (
          <p className="text-sm text-muted">Все счета закрыты</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {debtors.map(({ p, bal }) => (
              <li
                key={p.id}
                className="flex items-center justify-between rounded-lg bg-surface px-4 py-3 shadow-[var(--shadow-card)]"
              >
                <Link to="/patients/$id" params={{ id: p.id }} className="truncate text-sm hover:text-primary">
                  {fullName(p)}
                </Link>
                <span className="text-sm tabular-nums text-danger">{money(bal)}</span>
              </li>
            ))}
          </ul>
        )}
      </FoldSection>

      {voided.length > 0 ? (
        <FoldSection title="Аннулированные счета" defaultOpen={false}>
          <ul className="flex flex-col overflow-hidden rounded-xl bg-surface shadow-[var(--shadow-card)]">
            {voided.map((v, i) => {
              const p = patients.find((x) => x.id === v.patientId);
              return (
                <li key={v.id} className={`px-4 py-3 text-sm ${i ? "border-t border-line" : ""}`}>
                  <p className="font-medium text-muted line-through">
                    {p ? fullName(p) : "Пациент"} · {money(v.total)}
                  </p>
                  <p className="text-[12px] text-muted">
                    {formatDate(v.voidedAt || v.date, "d MMM yyyy, HH:mm")} · {v.voidedBy || "—"}
                    {v.voidReason ? ` · ${v.voidReason}` : ""}
                  </p>
                </li>
              );
            })}
          </ul>
        </FoldSection>
      ) : null}

      <Dialog open={Boolean(paying)} onOpenChange={(o) => !o && setPayId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Принять оплату</DialogTitle>
          </DialogHeader>
          <Field label="Сумма, ₽">
            <NumericInput min={0} value={amount} onValue={setAmount} />
          </Field>
          <Field label="Способ">
            <Select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
              <option value="cash">Наличные</option>
              <option value="card">Карта</option>
              <option value="transfer">Перевод</option>
            </Select>
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setPayId(null)}>
              Отмена
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (!payId || amount <= 0) return;
                addPayment(payId, amount, method);
                toast.success("Оплата принята");
                setPayId(null);
              }}
            >
              Записать
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <VisitDialog
        open={Boolean(editVisit)}
        onOpenChange={(o) => !o && setEditVisit(null)}
        visit={editVisit}
        startTab="pay"
      />

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Удалить ${picked.length} счетов?`}
        description="Неоплаченные счета исчезнут. Оплаченные будут аннулированы и не войдут в кассу. Это нельзя отменить."
        confirmLabel="Удалить"
        danger
        onConfirm={() => {
          let removed = 0;
          let voidedN = 0;
          for (const id of picked) {
            const v = visits.find((x) => x.id === id);
            if (!v) continue;
            if (v.paid > 0) {
              if (voidVisit(id, "Удалено из кассы", actor)) voidedN += 1;
            } else if (deleteVisit(id)) {
              removed += 1;
            }
          }
          toast.success(
            [removed ? `удалено ${removed}` : "", voidedN ? `аннулировано ${voidedN}` : ""]
              .filter(Boolean)
              .join(", ") || "Готово",
          );
          stopSelect();
        }}
      />
    </div>
  );
}

function FoldSection({
  title,
  defaultOpen = true,
  extra,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  extra?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 items-center gap-2 text-left"
          aria-expanded={open}
        >
          <ChevronDown
            className={cn("size-5 shrink-0 text-muted transition-transform duration-150", !open && "-rotate-90")}
          />
          <h2 className="font-display text-lg">{title}</h2>
        </button>
        {open ? extra : null}
      </div>
      {open ? children : null}
    </section>
  );
}

function VisitRow({
  visit,
  name,
  due,
  first,
  selecting,
  picked,
  swiped,
  onSwipe,
  onToggle,
  onStartSelect,
  onPay,
  onEdit,
}: {
  visit: Visit;
  name: string;
  due: number;
  first: boolean;
  selecting: boolean;
  picked: boolean;
  swiped: boolean;
  onSwipe: (open: boolean) => void;
  onToggle: () => void;
  onStartSelect: () => void;
  onPay: () => void;
  onEdit: () => void;
}) {
  const lp = useLongPress(onStartSelect);
  const body = (
    <div className="flex items-center gap-2 px-3 py-3 sm:px-4">
      {selecting ? (
        <label className="grid size-11 shrink-0 place-items-center">
          <input type="checkbox" checked={picked} onChange={onToggle} className="size-4" />
        </label>
      ) : null}
      <div
        role="button"
        tabIndex={0}
        onPointerDown={lp.onPointerDown}
        onPointerMove={lp.onPointerMove}
        onPointerUp={lp.onPointerUp}
        onPointerCancel={lp.onPointerCancel}
        onContextMenu={lp.onContextMenu}
        onClick={(e) => {
          lp.onClick(e);
          if (e.defaultPrevented) return;
          if (selecting) onToggle();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (selecting) onToggle();
            else onEdit();
          }
        }}
        className="flex min-w-0 flex-1 select-none items-center gap-3 text-left [-webkit-touch-callout:none]"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{name}</p>
          <p className="text-[12px] text-muted">
            {formatDate(visit.date, "d MMM")}
            {visit.paymentMethod ? ` · ${PAYMENT_LABEL[visit.paymentMethod]}` : ""}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm tabular-nums">{money(visit.paid)}</p>
          {due > 0 && !selecting ? (
            <span
              role="link"
              className="text-[12px] text-danger hover:underline"
              onClick={(e) => {
                e.stopPropagation();
                onPay();
              }}
            >
              долг {money(due)}
            </span>
          ) : due > 0 ? (
            <p className="text-[12px] text-danger">долг {money(due)}</p>
          ) : (
            <p className="text-[12px] text-ok">оплачено</p>
          )}
        </div>
      </div>
    </div>
  );

  if (selecting) {
    return <li className={cn(!first && "border-t border-line")}>{body}</li>;
  }

  return (
    <li className={cn(!first && "border-t border-line")}>
      <SwipeRow
        open={swiped}
        onOpenChange={onSwipe}
        onTap={onEdit}
        actions={
          <Link
            to="/patients/$id"
            params={{ id: visit.patientId }}
            className="flex h-full w-[72px] flex-col items-center justify-center bg-primary text-primary-fg"
            aria-label="Карточка пациента"
            onClick={(e) => e.stopPropagation()}
          >
            <UserRound className="size-5" />
            <span className="mt-0.5 text-[10px] leading-none">Карта</span>
          </Link>
        }
      >
        {body}
      </SwipeRow>
    </li>
  );
}

function Cell({
  label,
  value,
  hint,
  danger,
}: {
  label: string;
  value: string;
  hint?: string;
  danger?: boolean;
}) {
  return (
    <div className="min-w-0 px-3 sm:px-4">
      <p className="text-[11px] leading-tight text-muted sm:text-[12px]">{label}</p>
      <p className={`mt-1 truncate font-display text-lg tabular-nums sm:text-2xl ${danger ? "text-danger" : ""}`}>
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-[11px] leading-tight text-subtle">{hint}</p> : null}
    </div>
  );
}
