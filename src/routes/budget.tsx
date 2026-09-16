import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ru } from "date-fns/locale";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  PieChart,
  Search,
  Wallet,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PatientPicker } from "@/components/patient-picker";
import { MovableFab } from "@/components/movable-fab";
import { PeriodSwitch } from "@/components/period-switch";
import { SaveFileDialog } from "@/components/save-file-dialog";
import { ConfirmDialog } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, Select } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NumericInput } from "@/components/ui/numeric-input";
import { Textarea } from "@/components/ui/textarea";
import {
  allPayMethods,
  BUDGET_PERIODS,
  budgetRange,
  budgetTotals,
  buildLedger,
  CADENCE_LABEL,
  categoryShare,
  categoryUsed,
  dueRecurring,
  emptyBudgetOp,
  filterLedger,
  incomeByDoctor,
  incomeByService,
  monthlySeries,
  periodTitle,
  planVsFact,
  rubles,
  SYS_EXPENSE_OTHER,
  SYS_INCOME_OTHER,
  SYS_INCOME_TREATMENT,
  upcomingRecurring,
  type BudgetPeriod,
  type LedgerOp,
} from "@/lib/budget";
import { budgetCsv, budgetPdfBlob, budgetXlsxBlob } from "@/lib/budget-export";
import { formatDate, money, todayISO } from "@/lib/format";
import { useSession } from "@/lib/session";
import { canManageStaff } from "@/lib/staff";
import { useClinic } from "@/lib/store";
import type { BudgetCadence, BudgetKind, BudgetOp } from "@/lib/types";
import { cn, shareOrDownload } from "@/lib/utils";

export const Route = createFileRoute("/budget")({ component: BudgetPage });

type Panel = "home" | "ops" | "analytics" | "more";
type MoreTab = "cats" | "vendors" | "recurring" | "plan" | "calendar" | "export";

function BudgetPage() {
  const navigate = useNavigate();
  const visits = useClinic((s) => s.visits);
  const patients = useClinic((s) => s.patients);
  const services = useClinic((s) => s.services);
  const appointments = useClinic((s) => s.appointments);
  const doctors = useClinic((s) => s.doctors);
  const settings = useClinic((s) => s.settings);
  const ops = useClinic((s) => s.budgetOps);
  const categories = useClinic((s) => s.budgetCategories);
  const vendors = useClinic((s) => s.budgetVendors);
  const recurring = useClinic((s) => s.budgetRecurring);
  const plans = useClinic((s) => s.budgetPlans);
  const addOp = useClinic((s) => s.addBudgetOp);
  const updateOp = useClinic((s) => s.updateBudgetOp);
  const deleteOp = useClinic((s) => s.deleteBudgetOp);
  const addCat = useClinic((s) => s.addBudgetCategory);
  const updateCat = useClinic((s) => s.updateBudgetCategory);
  const deleteCat = useClinic((s) => s.deleteBudgetCategory);
  const addVendor = useClinic((s) => s.addBudgetVendor);
  const updateVendor = useClinic((s) => s.updateBudgetVendor);
  const deleteVendor = useClinic((s) => s.deleteBudgetVendor);
  const addRec = useClinic((s) => s.addBudgetRecurring);
  const updateRec = useClinic((s) => s.updateBudgetRecurring);
  const deleteRec = useClinic((s) => s.deleteBudgetRecurring);
  const postDue = useClinic((s) => s.postDueRecurring);
  const setPlan = useClinic((s) => s.setBudgetPlan);
  const updateSettings = useClinic((s) => s.updateSettings);
  const sessionDoctorId = useSession((s) => s.doctorId);

  const actor = doctors.find((d) => d.id === sessionDoctorId);
  const canEdit = canManageStaff({ requireLogin: settings.requireLogin, actor, doctors });

  const [period, setPeriod] = useState<BudgetPeriod>("month");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [panel, setPanel] = useState<Panel>("home");
  const [more, setMore] = useState<MoreTab>("cats");
  const [kindFilter, setKindFilter] = useState<"all" | BudgetKind>("all");
  const [catFilter, setCatFilter] = useState("");
  const [methodFilter, setMethodFilter] = useState("");
  const [patientFilter, setPatientFilter] = useState("");
  const [vendorFilter, setVendorFilter] = useState("");
  const [q, setQ] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [formKind, setFormKind] = useState<BudgetKind>("expense");
  const [editing, setEditing] = useState<LedgerOp | null>(null);
  const [detail, setDetail] = useState<LedgerOp | null>(null);
  const [delId, setDelId] = useState<string | null>(null);
  const [calMonth, setCalMonth] = useState(todayISO().slice(0, 7));
  const [saveFile, setSaveFile] = useState<{ blob: Blob; name: string } | null>(null);

  useEffect(() => {
    if (!canEdit) return;
    const n = postDue(todayISO(), actor?.lastName || settings.doctorName || "Администратор");
    if (n > 0) toast.success(`Проведено регулярных расходов: ${n}`);
    const soon = upcomingRecurring(useClinic.getState().budgetRecurring);
    for (const r of soon) {
      toast.message(`Скоро платёж: ${r.title}`, { description: `${money(r.amount)} · ${formatDate(r.nextDate)}` });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const range = useMemo(() => budgetRange(period, from, to), [period, from, to]);
  const ledger = useMemo(
    () => buildLedger(visits, ops, patients, services, appointments),
    [visits, ops, patients, services, appointments],
  );
  const filtered = useMemo(
    () =>
      filterLedger(ledger, {
        from: range.from,
        to: range.to,
        kind: kindFilter,
        categoryId: catFilter || undefined,
        method: methodFilter || undefined,
        patientId: patientFilter || undefined,
        vendorId: vendorFilter || undefined,
        q,
        patients,
        vendors,
        categories,
      }),
    [ledger, range, kindFilter, catFilter, methodFilter, patientFilter, vendorFilter, q, patients, vendors, categories],
  );
  const totals = useMemo(
    () => budgetTotals(ledger, range, settings.openingBalance ?? 0, settings.openingDate || "2000-01-01"),
    [ledger, range, settings.openingBalance, settings.openingDate],
  );
  const months = useMemo(() => monthlySeries(ledger, 6), [ledger]);
  const expShare = useMemo(
    () => categoryShare(ledger, categories, "expense", range.from, range.to),
    [ledger, categories, range],
  );
  const doctorsIncome = useMemo(
    () => incomeByDoctor(ledger, doctors, range.from, range.to),
    [ledger, doctors, range],
  );
  const servicesIncome = useMemo(
    () => incomeByService(visits, services, range.from, range.to),
    [visits, services, range],
  );
  const monthKey = range.from.slice(0, 7);
  const planRows = useMemo(
    () => planVsFact(plans.find((p) => p.month === monthKey), ledger, categories, monthKey),
    [plans, ledger, categories, monthKey],
  );
  const payList = allPayMethods(settings.customPayMethods);
  const liveCats = categories.filter((c) => !c.archived);

  function openAdd(kind: BudgetKind) {
    if (!canEdit) return toast.error("Изменять бюджет может руководитель.");
    setFormKind(kind);
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(op: LedgerOp) {
    setDetail(null);
    if (op.locked) {
      setDetail(op);
      return;
    }
    if (!canEdit) return toast.error("Изменять бюджет может руководитель.");
    setEditing(op);
    setFormKind(op.kind);
    setFormOpen(true);
  }

  async function exportFile(kind: "csv" | "xlsx" | "pdf") {
    const name = `denta-budget-${range.from}-${range.to}`;
    try {
      if (kind === "csv") {
        const text = budgetCsv(filtered, categories, patients, vendors, settings.customPayMethods ?? []);
        await shareOrDownload(new Blob(["\uFEFF" + text], { type: "text/csv;charset=utf-8" }), `${name}.csv`);
      } else if (kind === "xlsx") {
        const blob = budgetXlsxBlob(filtered, categories, patients, vendors, settings.customPayMethods ?? []);
        await shareOrDownload(blob, `${name}.xlsx`);
      } else {
        const blob = await budgetPdfBlob({
          settings,
          from: range.from,
          to: range.to,
          totals,
          ops: filtered,
          categories,
          customPay: settings.customPayMethods ?? [],
        });
        if (!blob.size) throw new Error("PDF пустой");
        setSaveFile({ blob, name: `${name}.pdf` });
        await shareOrDownload(blob, `${name}.pdf`);
      }
      toast.success("Файл готов");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось создать файл");
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-3">
        <PeriodSwitch
          value={period}
          onChange={setPeriod}
          options={BUDGET_PERIODS}
        />
        <h1 className="font-display text-3xl">Бюджет</h1>
      </header>
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

      <nav className="flex gap-1 overflow-x-auto">
        {(
          [
            ["home", "Сводка"],
            ["ops", "Операции"],
            ["analytics", "Аналитика"],
            ["more", "Ещё"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setPanel(id)}
            className={cn(
              "h-11 shrink-0 rounded-md px-4 text-sm",
              panel === id ? "bg-primary text-primary-fg" : "bg-surface text-ink shadow-[var(--shadow-card)]",
            )}
          >
            {label}
          </button>
        ))}
      </nav>

      {panel === "home" ? (
        <Overview
          totals={totals}
          opening={settings.openingBalance ?? 0}
          openingDate={settings.openingDate || ""}
          canEdit={canEdit}
          onOpening={(balance, date) => updateSettings({ openingBalance: rubles(balance), openingDate: date })}
          planRows={planRows}
          due={dueRecurring(recurring)}
        />
      ) : null}

      {panel === "ops" ? (
        <OpsList
          ops={filtered}
          categories={categories}
          vendors={vendors}
          payList={payList}
          kindFilter={kindFilter}
          catFilter={catFilter}
          methodFilter={methodFilter}
          vendorFilter={vendorFilter}
          q={q}
          onKind={setKindFilter}
          onCat={setCatFilter}
          onMethod={setMethodFilter}
          onVendor={setVendorFilter}
          onPatient={setPatientFilter}
          onQ={setQ}
          patients={patients}
          patientFilter={patientFilter}
          onOpen={openEdit}
        />
      ) : null}

      {panel === "analytics" ? (
        <Analytics
          months={months}
          expShare={expShare}
          doctorsIncome={doctorsIncome}
          servicesIncome={servicesIncome}
          prevProfit={months.length >= 2 ? months[months.length - 2]?.profit ?? 0 : 0}
          thisProfit={totals.profit}
        />
      ) : null}

      {panel === "more" ? (
        <MorePanel
          tab={more}
          onTab={setMore}
          categories={categories}
          vendors={vendors}
          recurring={recurring}
          liveCats={liveCats}
          canEdit={canEdit}
          monthKey={monthKey}
          planRows={planRows}
          calMonth={calMonth}
          onCalMonth={setCalMonth}
          ledger={ledger}
          settings={settings}
          onAddCat={(kind, name) => {
            if (!addCat(kind, name)) toast.error("Укажите название");
          }}
          onRenameCat={(id, name) => updateCat(id, { name })}
          onArchiveCat={(id) => {
            const cat = categories.find((c) => c.id === id);
            if (!cat) return;
            if (cat.locked) return toast.error("Системную категорию нельзя удалить.");
            if (categoryUsed(ops, plans, recurring, id)) {
              deleteCat(id);
              toast.message("Категория в архиве — операции на месте.");
            } else deleteCat(id);
          }}
          onMoveDelete={(id, moveTo) => {
            deleteCat(id, moveTo);
            toast.success("Операции перенесены, категория удалена.");
          }}
          onAddVendor={(name, phone, note) => addVendor({ name, phone, note })}
          onUpdateVendor={updateVendor}
          onDeleteVendor={deleteVendor}
          onAddRec={(draft) => addRec(draft)}
          onUpdateRec={updateRec}
          onDeleteRec={deleteRec}
          onSetPlan={(items) => setPlan(monthKey, items)}
          onDay={(iso) => {
            setPeriod("custom");
            setFrom(iso);
            setTo(iso);
            setPanel("ops");
          }}
          onExport={exportFile}
          onPayMethod={(name) => {
            const n = name.trim();
            if (!n) return;
            const cur = settings.customPayMethods ?? [];
            if (cur.includes(n) || allPayMethods(cur).some((m) => m.label === n || m.id === n)) return;
            updateSettings({ customPayMethods: [...cur, n] });
          }}
        />
      ) : null}

      {canEdit ? <MovableFab label="Добавить операцию" onPress={() => openAdd("expense")} /> : null}

      <SaveFileDialog
        open={Boolean(saveFile)}
        onOpenChange={(o) => {
          if (!o) setSaveFile(null);
        }}
        blob={saveFile?.blob ?? null}
        filename={saveFile?.name ?? "denta-budget.pdf"}
        title="Бюджет"
        kind="pdf"
      />

      <OpForm
        open={formOpen}
        kind={formKind}
        editing={editing}
        categories={liveCats}
        vendors={vendors}
        patients={patients}
        payList={payList}
        onKind={setFormKind}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        onSave={(draft) => {
          if (editing) {
            if (!updateOp(editing.id, draft)) toast.error("Не удалось сохранить");
            else toast.success("Операция обновлена");
          } else {
            const id = addOp({ ...draft, createdBy: actor?.lastName || settings.doctorName });
            if (!id) toast.error("Укажите сумму больше нуля");
            else toast.success(draft.kind === "income" ? "Доход записан" : "Расход записан");
          }
          setFormOpen(false);
          setEditing(null);
        }}
        onDelete={() => {
          if (editing) {
            setDelId(editing.id);
            setFormOpen(false);
            setEditing(null);
          }
        }}
        onAddVendor={(name) => addVendor({ name, phone: "", note: "" })}
        onAddCat={(kind, name) => addCat(kind, name)}
      />

      <Dialog open={Boolean(detail)} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{detail?.kind === "income" ? "Доход из кассы" : "Операция"}</DialogTitle>
          </DialogHeader>
          {detail ? (
            <div className="flex flex-col gap-2 text-sm">
              <p className="font-medium">{detail.title}</p>
              <p>
                {detail.kind === "income" ? "+" : "−"}
                {money(detail.amount)} · {formatDate(detail.date)}
              </p>
              {detail.serviceHint ? <p className="text-muted">{detail.serviceHint}</p> : null}
              {detail.locked ? (
                <p className="rounded-md bg-surface-2 p-3 text-[13px] text-muted">
                  Эта операция создана автоматически на основании оплаты пациента. Сумму здесь менять нельзя — откройте
                  счёт в кассе.
                </p>
              ) : null}
              <div className="mt-2 flex gap-2">
                {detail.visitId ? (
                  <Button type="button" variant="secondary" onClick={() => navigate({ to: "/finance" })}>
                    Открыть кассу
                  </Button>
                ) : null}
                {detail.patientId ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate({ to: "/patients/$id", params: { id: detail.patientId! } })}
                  >
                    Карточка
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(delId)}
        onOpenChange={(o) => !o && setDelId(null)}
        title="Удалить операцию?"
        description={
          delId
            ? `Сумма: ${money(ops.find((o) => o.id === delId)?.amount ?? 0)}. Дата: ${ops.find((o) => o.id === delId)?.date ?? ""}. Оплата из кассы при этом не удаляется — кассовые доходы так стереть нельзя.`
            : ""
        }
        onConfirm={() => {
          if (delId) {
            if (!deleteOp(delId)) toast.error("Кассовую оплату удалить из бюджета нельзя.");
            else toast.success("Операция удалена");
          }
          setDelId(null);
        }}
      />
    </div>
  );
}

function Overview({
  totals,
  opening,
  openingDate,
  canEdit,
  onOpening,
  planRows,
  due,
}: {
  totals: ReturnType<typeof budgetTotals>;
  opening: number;
  openingDate: string;
  canEdit: boolean;
  onOpening: (n: number, date: string) => void;
  planRows: ReturnType<typeof planVsFact>;
  due: ReturnType<typeof dueRecurring>;
}) {
  const [openAmt, setOpenAmt] = useState(opening);
  const [openDate, setOpenDate] = useState(openingDate || todayISO());
  useEffect(() => {
    setOpenAmt(opening);
    setOpenDate(openingDate || todayISO());
  }, [opening, openingDate]);
  const cards = [
    { label: "Доходы", value: totals.income, icon: ArrowDownLeft, tone: "ok" as const },
    { label: "Расходы", value: totals.expense, icon: ArrowUpRight, tone: "danger" as const },
    { label: "Прибыль", value: totals.profit, icon: Wallet, tone: totals.profit >= 0 ? ("ok" as const) : ("danger" as const) },
    { label: "Текущий баланс", value: totals.balance, icon: PieChart, tone: totals.balance >= 0 ? ("ok" as const) : ("warn" as const) },
  ];
  return (
    <div className="flex flex-col gap-4">
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl bg-surface p-4 shadow-[var(--shadow-card)]">
            <p className="flex items-center gap-2 text-[12px] text-muted">
              <c.icon className="size-4" strokeWidth={1.7} />
              {c.label}
            </p>
            <p
              className={cn(
                "mt-2 font-display text-2xl",
                c.tone === "ok" && "text-ok",
                c.tone === "danger" && "text-danger",
                c.tone === "warn" && "text-warn",
              )}
            >
              {c.value < 0 ? "−" : ""}
              {money(Math.abs(c.value))}
            </p>
          </div>
        ))}
      </section>
      <section className="rounded-xl bg-surface p-4 text-sm shadow-[var(--shadow-card)]">
        <p className="font-medium">Баланс</p>
        <p className="mt-2 text-muted">
          Начало {money(totals.opening)} + доходы {money(totals.incomeAll)} − расходы {money(totals.expenseAll)} ={" "}
          <span className="text-ink">{money(totals.balance)}</span>
        </p>
        {canEdit ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <Field label="Начальный остаток">
              <NumericInput value={openAmt} onValue={setOpenAmt} />
            </Field>
            <Field label="С даты">
              <Input type="date" value={openDate} onChange={(e) => setOpenDate(e.target.value)} />
            </Field>
            <div className="flex items-end">
              <Button type="button" variant="secondary" onClick={() => onOpening(openAmt, openDate)}>
                Сохранить начало
              </Button>
            </div>
          </div>
        ) : null}
        <p className="mt-2 text-[12px] text-subtle">
          Оплаты пациентов до этой даты считаются уже входящими в начальный остаток — второй раз не плюсуются.
        </p>
      </section>
      {planRows.some((r) => r.over) ? (
        <section className="rounded-xl bg-surface p-4 shadow-[var(--shadow-card)]">
          <p className="font-medium text-warn">Превышен план расходов</p>
          {planRows
            .filter((r) => r.over)
            .map((r) => (
              <p key={r.categoryId} className="mt-1 text-sm text-muted">
                {r.name}: план {money(r.plan)}, факт {money(r.fact)}
              </p>
            ))}
        </section>
      ) : null}
      {due.length ? (
        <p className="text-sm text-muted">Регулярные платежи с наступившей датой проводятся при открытии вкладки.</p>
      ) : null}
    </div>
  );
}

function OpsList({
  ops,
  categories,
  vendors,
  payList,
  kindFilter,
  catFilter,
  methodFilter,
  vendorFilter,
  q,
  onKind,
  onCat,
  onMethod,
  onVendor,
  onPatient,
  onQ,
  patients,
  patientFilter,
  onOpen,
}: {
  ops: LedgerOp[];
  categories: { id: string; name: string; kind: BudgetKind; archived?: boolean }[];
  vendors: { id: string; name: string }[];
  payList: { id: string; label: string }[];
  kindFilter: "all" | BudgetKind;
  catFilter: string;
  methodFilter: string;
  vendorFilter: string;
  q: string;
  onKind: (k: "all" | BudgetKind) => void;
  onCat: (id: string) => void;
  onMethod: (id: string) => void;
  onVendor: (id: string) => void;
  onPatient: (id: string) => void;
  onQ: (q: string) => void;
  patients: Parameters<typeof PatientPicker>[0]["patients"];
  patientFilter: string;
  onOpen: (op: LedgerOp) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />
        <Input className="pl-9" placeholder="Поиск: описание, категория, пациент, поставщик" value={q} onChange={(e) => onQ(e.target.value)} />
      </div>
      <div className="flex flex-wrap gap-2">
        {(["all", "income", "expense"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => onKind(k)}
            className={cn("rounded-full px-3 py-1.5 text-[13px]", kindFilter === k ? "bg-primary text-primary-fg" : "bg-surface-2")}
          >
            {k === "all" ? "Все" : k === "income" ? "Доходы" : "Расходы"}
          </button>
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Select value={catFilter} onChange={(e) => onCat(e.target.value)}>
          <option value="">Категория</option>
          {categories.filter((c) => !c.archived).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Select value={methodFilter} onChange={(e) => onMethod(e.target.value)}>
          <option value="">Способ оплаты</option>
          {payList.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </Select>
        <Select value={vendorFilter} onChange={(e) => onVendor(e.target.value)}>
          <option value="">Поставщик</option>
          {vendors.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </Select>
        <PatientPicker patients={patients} value={patientFilter} onChange={onPatient} />
      </div>
      {ops.length === 0 ? (
        <p className="rounded-xl bg-surface p-6 text-sm text-muted shadow-[var(--shadow-card)]">
          За период нет операций. Оплаты из кассы появятся сами, расход добавляется кнопкой.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {ops.map((op) => {
            const cat = categories.find((c) => c.id === op.categoryId)?.name;
            return (
              <li key={op.id}>
                <button
                  type="button"
                  onClick={() => onOpen(op)}
                  className="flex w-full items-center gap-3 rounded-xl bg-surface p-3 text-left shadow-[var(--shadow-card)]"
                >
                  <span
                    className={cn(
                      "grid size-10 shrink-0 place-items-center rounded-md",
                      op.kind === "income" ? "bg-ok/15 text-ok" : "bg-danger/15 text-danger",
                    )}
                    aria-hidden
                  >
                    {op.kind === "income" ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {op.kind === "income" ? "Доход" : "Расход"} · {op.title}
                    </span>
                    <span className="block truncate text-[12px] text-muted">
                      {formatDate(op.date, "d MMM")} · {cat}
                      {op.source === "visit" ? " · касса" : op.source === "recurring" ? " · регулярный" : ""}
                    </span>
                  </span>
                  <span className={cn("shrink-0 font-medium", op.kind === "income" ? "text-ok" : "text-danger")}>
                    {op.kind === "income" ? "+" : "−"}
                    {money(op.amount)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Analytics({
  months,
  expShare,
  doctorsIncome,
  servicesIncome,
  prevProfit,
  thisProfit,
}: {
  months: ReturnType<typeof monthlySeries>;
  expShare: ReturnType<typeof categoryShare>;
  doctorsIncome: ReturnType<typeof incomeByDoctor>;
  servicesIncome: ReturnType<typeof incomeByService>;
  prevProfit: number;
  thisProfit: number;
}) {
  const max = Math.max(1, ...months.map((m) => Math.max(m.income, m.expense)));
  const delta = thisProfit - prevProfit;
  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-xl bg-surface p-4 shadow-[var(--shadow-card)]">
        <p className="font-medium">Доходы и расходы по месяцам</p>
        <div className="mt-4 flex items-end gap-2">
          {months.map((m) => (
            <div key={m.month} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <div className="flex h-28 w-full items-end justify-center gap-0.5">
                <div className="w-2 rounded-t bg-ok" style={{ height: `${(m.income / max) * 100}%` }} title={`Доход ${money(m.income)}`} />
                <div className="w-2 rounded-t bg-danger/70" style={{ height: `${(m.expense / max) * 100}%` }} title={`Расход ${money(m.expense)}`} />
              </div>
              <p className="text-[11px] capitalize text-muted">{m.label}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-sm text-muted">
          Прибыль периода: {money(thisProfit)}. К прошлому столбцу: {delta >= 0 ? "+" : "−"}
          {money(Math.abs(delta))}
        </p>
      </section>
      <section className="rounded-xl bg-surface p-4 shadow-[var(--shadow-card)]">
        <p className="font-medium">Расходы по категориям</p>
        {expShare.rows.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Расходов за период нет.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {expShare.rows.map((r) => (
              <li key={r.id}>
                <div className="flex justify-between text-sm">
                  <span>{r.name}</span>
                  <span>
                    {money(r.amount)} · {r.pct}%
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full bg-primary" style={{ width: `${r.pct}%` }} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="rounded-xl bg-surface p-4 shadow-[var(--shadow-card)]">
        <p className="font-medium">Доходы по врачам</p>
        {doctorsIncome.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Нет оплаченных приёмов за период.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {doctorsIncome.map((d) => (
              <li key={d.id} className="flex justify-between">
                <span>{d.name}</span>
                <span>{money(d.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="rounded-xl bg-surface p-4 shadow-[var(--shadow-card)]">
        <p className="font-medium">Доходы по услугам</p>
        {servicesIncome.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Нет оплаченных услуг за период.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {servicesIncome.slice(0, 12).map((s) => (
              <li key={s.id} className="flex justify-between gap-3">
                <span className="min-w-0 truncate">{s.name}</span>
                <span className="shrink-0">{money(s.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function MorePanel({
  tab,
  onTab,
  categories,
  vendors,
  recurring,
  liveCats,
  canEdit,
  monthKey,
  planRows,
  calMonth,
  onCalMonth,
  ledger,
  settings,
  onAddCat,
  onRenameCat,
  onArchiveCat,
  onMoveDelete,
  onAddVendor,
  onUpdateVendor,
  onDeleteVendor,
  onAddRec,
  onUpdateRec,
  onDeleteRec,
  onSetPlan,
  onDay,
  onExport,
  onPayMethod,
}: {
  tab: MoreTab;
  onTab: (t: MoreTab) => void;
  categories: ReturnType<typeof useClinic.getState>["budgetCategories"];
  vendors: ReturnType<typeof useClinic.getState>["budgetVendors"];
  recurring: ReturnType<typeof useClinic.getState>["budgetRecurring"];
  liveCats: ReturnType<typeof useClinic.getState>["budgetCategories"];
  canEdit: boolean;
  monthKey: string;
  planRows: ReturnType<typeof planVsFact>;
  calMonth: string;
  onCalMonth: (m: string) => void;
  ledger: LedgerOp[];
  settings: ReturnType<typeof useClinic.getState>["settings"];
  onAddCat: (kind: BudgetKind, name: string) => void;
  onRenameCat: (id: string, name: string) => void;
  onArchiveCat: (id: string) => void;
  onMoveDelete: (id: string, moveTo: string) => void;
  onAddVendor: (name: string, phone: string, note: string) => void;
  onUpdateVendor: (id: string, patch: { name?: string; phone?: string; note?: string }) => void;
  onDeleteVendor: (id: string) => void;
  onAddRec: (draft: Omit<import("@/lib/types").BudgetRecurring, "id">) => void;
  onUpdateRec: (id: string, patch: Partial<import("@/lib/types").BudgetRecurring>) => void;
  onDeleteRec: (id: string) => void;
  onSetPlan: (items: { categoryId: string; amount: number }[]) => void;
  onDay: (iso: string) => void;
  onExport: (kind: "csv" | "xlsx" | "pdf") => void;
  onPayMethod: (name: string) => void;
}) {
  const [newCat, setNewCat] = useState("");
  const [newKind, setNewKind] = useState<BudgetKind>("expense");
  const [vName, setVName] = useState("");
  const [vPhone, setVPhone] = useState("");
  const [payName, setPayName] = useState("");
  const [moveFrom, setMoveFrom] = useState("");
  const [moveTo, setMoveTo] = useState("");
  const expCats = liveCats.filter((c) => c.kind === "expense");
  const [planDraft, setPlanDraft] = useState<Record<string, number>>({});
  useEffect(() => {
    const next: Record<string, number> = {};
    for (const r of planRows) next[r.categoryId] = r.plan;
    setPlanDraft(next);
  }, [planRows, monthKey]);

  const tabs: Array<[MoreTab, string]> = [
    ["cats", "Категории"],
    ["vendors", "Поставщики"],
    ["recurring", "Регулярные"],
    ["plan", "План"],
    ["calendar", "Календарь"],
    ["export", "Экспорт"],
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-1.5">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => onTab(id)}
            className={cn("rounded-full px-3 py-1.5 text-[13px]", tab === id ? "bg-primary text-primary-fg" : "bg-surface-2")}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "cats" ? (
        <section className="rounded-xl bg-surface p-4 shadow-[var(--shadow-card)]">
          {canEdit ? (
            <div className="mb-4 flex flex-col gap-2 sm:flex-row">
              <Select value={newKind} onChange={(e) => setNewKind(e.target.value as BudgetKind)}>
                <option value="expense">Расход</option>
                <option value="income">Доход</option>
              </Select>
              <Input placeholder="Новая категория" value={newCat} onChange={(e) => setNewCat(e.target.value)} />
              <Button
                type="button"
                onClick={() => {
                  onAddCat(newKind, newCat);
                  setNewCat("");
                }}
              >
                Добавить
              </Button>
            </div>
          ) : null}
          <ul className="flex flex-col gap-2">
            {categories.map((c) => (
              <li key={c.id} className="flex items-center gap-2">
                <span className="w-16 shrink-0 text-[12px] text-muted">{c.kind === "income" ? "Доход" : "Расход"}</span>
                <Input
                  disabled={!canEdit || c.locked}
                  value={c.name}
                  onChange={(e) => onRenameCat(c.id, e.target.value)}
                />
                {c.archived ? <span className="text-[12px] text-subtle">архив</span> : null}
                {canEdit && !c.locked ? (
                  <Button type="button" variant="ghost" size="sm" onClick={() => onArchiveCat(c.id)}>
                    Удалить
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
          {canEdit ? (
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <Select value={moveFrom} onChange={(e) => setMoveFrom(e.target.value)}>
                <option value="">Перенести из…</option>
                {categories.filter((c) => !c.locked).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
              <Select value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
                <option value="">…в категорию</option>
                {categories
                  .filter((c) => c.id !== moveFrom)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </Select>
              <Button
                type="button"
                variant="secondary"
                disabled={!moveFrom || !moveTo}
                onClick={() => {
                  onMoveDelete(moveFrom, moveTo);
                  setMoveFrom("");
                  setMoveTo("");
                }}
              >
                Перенести и удалить
              </Button>
            </div>
          ) : null}
          <div className="mt-4 flex gap-2">
            <Input placeholder="Свой способ оплаты" value={payName} onChange={(e) => setPayName(e.target.value)} />
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                onPayMethod(payName);
                setPayName("");
              }}
            >
              Добавить способ
            </Button>
          </div>
          <p className="mt-2 text-[12px] text-subtle">Уже есть: {(settings.customPayMethods ?? []).join(", ") || "только наличные, карта, перевод, другой"}</p>
        </section>
      ) : null}

      {tab === "vendors" ? (
        <section className="rounded-xl bg-surface p-4 shadow-[var(--shadow-card)]">
          {canEdit ? (
            <div className="mb-3 grid gap-2 sm:grid-cols-3">
              <Input placeholder="Название" value={vName} onChange={(e) => setVName(e.target.value)} />
              <Input placeholder="Телефон" value={vPhone} onChange={(e) => setVPhone(e.target.value)} />
              <Button
                type="button"
                onClick={() => {
                  if (!vName.trim()) return;
                  onAddVendor(vName, vPhone, "");
                  setVName("");
                  setVPhone("");
                }}
              >
                Добавить
              </Button>
            </div>
          ) : null}
          <ul className="flex flex-col gap-2">
            {vendors.map((v) => (
              <li key={v.id} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                <Input value={v.name} disabled={!canEdit} onChange={(e) => onUpdateVendor(v.id, { name: e.target.value })} />
                <Input value={v.phone} disabled={!canEdit} onChange={(e) => onUpdateVendor(v.id, { phone: e.target.value })} />
                {canEdit ? (
                  <Button type="button" variant="ghost" onClick={() => onDeleteVendor(v.id)}>
                    Удалить
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
          {vendors.length === 0 ? <p className="text-sm text-muted">Поставщиков пока нет. Пригодятся для закупок.</p> : null}
        </section>
      ) : null}

      {tab === "recurring" ? (
        <RecurringBlock canEdit={canEdit} cats={expCats} recurring={recurring} onAdd={onAddRec} onUpdate={onUpdateRec} onDelete={onDeleteRec} />
      ) : null}

      {tab === "plan" ? (
        <section className="rounded-xl bg-surface p-4 shadow-[var(--shadow-card)]">
          <p className="font-medium">План расходов на {monthKey}</p>
          <ul className="mt-3 flex flex-col gap-2">
            {expCats.map((c) => {
              const row = planRows.find((r) => r.categoryId === c.id);
              return (
                <li key={c.id} className="grid grid-cols-[1fr_7rem] items-center gap-2">
                  <span className="text-sm">
                    {c.name}
                    {row ? (
                      <span className={cn("ml-2 text-[12px]", row.over ? "text-warn" : "text-muted")}>
                        факт {money(row.fact)}
                        {row.over ? " — превышен" : row.plan ? ` · осталось ${money(row.left)}` : ""}
                      </span>
                    ) : null}
                  </span>
                  <NumericInput
                    disabled={!canEdit}
                    value={planDraft[c.id] ?? 0}
                    onValue={(n) => setPlanDraft((p) => ({ ...p, [c.id]: n }))}
                  />
                </li>
              );
            })}
          </ul>
          {canEdit ? (
            <Button
              className="mt-3"
              type="button"
              onClick={() => onSetPlan(expCats.map((c) => ({ categoryId: c.id, amount: planDraft[c.id] ?? 0 })))}
            >
              Сохранить план
            </Button>
          ) : null}
        </section>
      ) : null}

      {tab === "calendar" ? (
        <BudgetCalendar month={calMonth} onMonth={onCalMonth} ledger={ledger} onDay={onDay} />
      ) : null}

      {tab === "export" ? (
        <section className="rounded-xl bg-surface p-4 shadow-[var(--shadow-card)]">
          <p className="font-medium">Экспорт за выбранный период</p>
          <p className="mt-1 text-sm text-muted">В файл попадают отфильтрованные операции сводки: касса + ручные.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={() => onExport("csv")}>
              CSV
            </Button>
            <Button type="button" variant="secondary" onClick={() => onExport("xlsx")}>
              XLSX
            </Button>
            <Button type="button" onClick={() => onExport("pdf")}>
              PDF
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function RecurringBlock({
  canEdit,
  cats,
  recurring,
  onAdd,
  onUpdate,
  onDelete,
}: {
  canEdit: boolean;
  cats: { id: string; name: string }[];
  recurring: ReturnType<typeof useClinic.getState>["budgetRecurring"];
  onAdd: (draft: Omit<import("@/lib/types").BudgetRecurring, "id">) => void;
  onUpdate: (id: string, patch: Partial<import("@/lib/types").BudgetRecurring>) => void;
  onDelete: (id: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState(0);
  const [categoryId, setCategoryId] = useState(cats[0]?.id || SYS_EXPENSE_OTHER);
  const [cadence, setCadence] = useState<BudgetCadence>("month");
  const [nextDate, setNextDate] = useState(todayISO());
  const [notifyDays, setNotifyDays] = useState(3);
  return (
    <section className="rounded-xl bg-surface p-4 shadow-[var(--shadow-card)]">
      {canEdit ? (
        <div className="mb-4 grid gap-2 sm:grid-cols-2">
          <Field label="Название">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Аренда" />
          </Field>
          <Field label="Сумма">
            <NumericInput value={amount} onValue={setAmount} />
          </Field>
          <Field label="Категория">
            <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              {cats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Периодичность">
            <Select value={cadence} onChange={(e) => setCadence(e.target.value as BudgetCadence)}>
              {(Object.keys(CADENCE_LABEL) as BudgetCadence[]).map((c) => (
                <option key={c} value={c}>
                  {CADENCE_LABEL[c]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Следующий платёж">
            <Input type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} />
          </Field>
          <Field label="Напомнить за, дней">
            <NumericInput value={notifyDays} onValue={setNotifyDays} />
          </Field>
          <Button
            type="button"
            onClick={() => {
              if (!title.trim() || amount <= 0) return;
              onAdd({
                title,
                amount,
                categoryId,
                method: "transfer",
                cadence,
                nextDate,
                notifyDays,
                active: true,
              });
              setTitle("");
              setAmount(0);
            }}
          >
            Добавить регулярный расход
          </Button>
        </div>
      ) : null}
      <ul className="flex flex-col gap-2">
        {recurring.map((r) => (
          <li key={r.id} className="rounded-md bg-surface-2 p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{r.title}</span>
              <span>{money(r.amount)}</span>
            </div>
            <p className="text-[12px] text-muted">
              {CADENCE_LABEL[r.cadence]} · следующее {formatDate(r.nextDate)}
              {r.active ? "" : " · выключен"}
            </p>
            {canEdit ? (
              <div className="mt-2 flex gap-2">
                <Button type="button" size="sm" variant="ghost" onClick={() => onUpdate(r.id, { active: !r.active })}>
                  {r.active ? "Выключить" : "Включить"}
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => onDelete(r.id)}>
                  Удалить
                </Button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      {recurring.length === 0 ? <p className="text-sm text-muted">Регулярных расходов нет. Аренда, интернет, зарплата.</p> : null}
    </section>
  );
}

function BudgetCalendar({
  month,
  onMonth,
  ledger,
  onDay,
}: {
  month: string;
  onMonth: (m: string) => void;
  ledger: LedgerOp[];
  onDay: (iso: string) => void;
}) {
  const cursor = parseISO(`${month}-01`);
  const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start, end });
  const byDay = new Map<string, { in: number; out: number }>();
  for (const op of ledger) {
    if (!op.date.startsWith(month)) continue;
    const cur = byDay.get(op.date) ?? { in: 0, out: 0 };
    if (op.kind === "income") cur.in += op.amount;
    else cur.out += op.amount;
    byDay.set(op.date, cur);
  }
  return (
    <section className="rounded-xl bg-surface p-4 shadow-[var(--shadow-card)]">
      <div className="mb-3 flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            const d = parseISO(`${month}-01`);
            onMonth(format(new Date(d.getFullYear(), d.getMonth() - 1, 1), "yyyy-MM"));
          }}
        >
          ←
        </Button>
        <p className="flex items-center gap-2 font-medium capitalize">
          <CalendarDays className="size-4" />
          {format(cursor, "LLLL yyyy", { locale: ru })}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            const d = parseISO(`${month}-01`);
            onMonth(format(new Date(d.getFullYear(), d.getMonth() + 1, 1), "yyyy-MM"));
          }}
        >
          →
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-muted">
        {"пн вт ср чт пт сб вс".split(" ").map((d) => (
          <div key={d}>{d}</div>
        ))}
        {days.map((d) => {
          const iso = format(d, "yyyy-MM-dd");
          const hit = byDay.get(iso);
          const inMonth = isSameMonth(d, cursor);
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onDay(iso)}
              className={cn(
                "flex min-h-12 flex-col items-center rounded-md p-1 text-[12px]",
                inMonth ? "text-ink" : "text-subtle",
                hit && "bg-surface-2",
              )}
            >
              {format(d, "d")}
              {hit ? (
                <span className="text-[9px] leading-none">
                  {hit.in ? <span className="text-ok">+</span> : null}
                  {hit.out ? <span className="text-danger">−</span> : null}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function OpForm({
  open,
  kind,
  editing,
  categories,
  vendors,
  patients,
  payList,
  onKind,
  onClose,
  onSave,
  onDelete,
  onAddVendor,
  onAddCat,
}: {
  open: boolean;
  kind: BudgetKind;
  editing: LedgerOp | null;
  categories: { id: string; kind: BudgetKind; name: string }[];
  vendors: { id: string; name: string }[];
  patients: Parameters<typeof PatientPicker>[0]["patients"];
  payList: { id: string; label: string }[];
  onKind: (k: BudgetKind) => void;
  onClose: () => void;
  onSave: (draft: Omit<BudgetOp, "id" | "createdAt">) => void;
  onDelete?: () => void;
  onAddVendor: (name: string) => string | void;
  onAddCat: (kind: BudgetKind, name: string) => string | void;
}) {
  const [draft, setDraft] = useState(emptyBudgetOp(kind));
  const [newVen, setNewVen] = useState("");
  useEffect(() => {
    if (!open) return;
    if (editing) {
      setDraft({
        kind: editing.kind,
        amount: editing.amount,
        date: editing.date,
        categoryId: editing.categoryId,
        method: editing.method,
        title: editing.title,
        note: editing.note,
        patientId: editing.patientId,
        vendorId: editing.vendorId,
      });
      onKind(editing.kind);
    } else {
      setDraft(emptyBudgetOp(kind));
    }
  }, [open, editing, kind, onKind]);

  const cats = categories.filter((c) => c.kind === draft.kind && c.id !== SYS_INCOME_TREATMENT);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Изменить операцию" : draft.kind === "income" ? "Добавить доход" : "Добавить расход"}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          {!editing ? (
            <div className="flex gap-2">
              <Button type="button" variant={draft.kind === "income" ? "default" : "secondary"} onClick={() => { onKind("income"); setDraft((d) => ({ ...d, kind: "income", categoryId: SYS_INCOME_OTHER })); }}>
                Доход
              </Button>
              <Button type="button" variant={draft.kind === "expense" ? "default" : "secondary"} onClick={() => { onKind("expense"); setDraft((d) => ({ ...d, kind: "expense", categoryId: SYS_EXPENSE_OTHER })); }}>
                Расход
              </Button>
            </div>
          ) : null}
          {draft.kind === "income" ? (
            <p className="text-[13px] text-muted">
              Оплата лечения уже есть в кассе и попадает в доходы сама. Здесь — только прочие поступления (товар, возврат).
            </p>
          ) : null}
          <Field label="Сумма, ₽">
            <NumericInput value={draft.amount} onValue={(n) => setDraft((d) => ({ ...d, amount: n }))} />
          </Field>
          <Field label="Категория">
            <Select value={draft.categoryId} onChange={(e) => setDraft((d) => ({ ...d, categoryId: e.target.value }))}>
              {cats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Дата">
            <Input type="date" value={draft.date} onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))} />
          </Field>
          <Field label="Способ оплаты">
            <Select value={draft.method} onChange={(e) => setDraft((d) => ({ ...d, method: e.target.value }))}>
              {payList.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Описание">
            <Input value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} />
          </Field>
          {draft.kind === "income" ? (
            <Field label="Пациент, если есть">
              <PatientPicker patients={patients} value={draft.patientId || ""} onChange={(id) => setDraft((d) => ({ ...d, patientId: id }))} />
            </Field>
          ) : (
            <Field label="Поставщик">
              <Select value={draft.vendorId || ""} onChange={(e) => setDraft((d) => ({ ...d, vendorId: e.target.value }))}>
                <option value="">Нет</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </Select>
              <div className="mt-2 flex gap-2">
                <Input placeholder="Новый поставщик" value={newVen} onChange={(e) => setNewVen(e.target.value)} />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    if (!newVen.trim()) return;
                    const id = onAddVendor(newVen.trim());
                    if (typeof id === "string" && id) setDraft((d) => ({ ...d, vendorId: id }));
                    setNewVen("");
                  }}
                >
                  Добавить
                </Button>
              </div>
            </Field>
          )}
          <Field label="Комментарий">
            <Textarea value={draft.note} onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))} />
          </Field>
          <div className="flex justify-end gap-2">
            {editing && onDelete ? (
              <Button type="button" variant="danger" className="mr-auto" onClick={onDelete}>
                Удалить
              </Button>
            ) : null}
            <Button type="button" variant="ghost" onClick={onClose}>
              Отмена
            </Button>
            <Button type="button" onClick={() => onSave(draft)}>
              Сохранить
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
