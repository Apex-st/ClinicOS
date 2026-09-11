import { addDays, addMonths, addWeeks, addYears, format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import { isVoided } from "./clinic";
import { fullName, todayISO } from "./format";
import type {
  Appointment,
  BudgetCadence,
  BudgetCategory,
  BudgetKind,
  BudgetOp,
  BudgetPlan,
  BudgetRecurring,
  BudgetVendor,
  Doctor,
  Patient,
  Service,
  Visit,
} from "./types";

/** Целые рубли. Никаких 100.00000001. */
export function rubles(n: unknown): number {
  const x = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.round(x);
}

export const SYS_INCOME_TREATMENT = "inc_treatment";
export const SYS_INCOME_OTHER = "inc_other";
export const SYS_EXPENSE_OTHER = "exp_other";

export function seedBudgetCategories(): BudgetCategory[] {
  const income: Array<[string, string, boolean]> = [
    [SYS_INCOME_TREATMENT, "Лечение пациентов", true],
    [SYS_INCOME_OTHER, "Другие поступления", false],
  ];
  const expense: Array<[string, string]> = [
    ["exp_materials", "Материалы"],
    ["exp_consumables", "Расходные материалы"],
    ["exp_disinfect", "Дезинфекция и стерилизация"],
    ["exp_equipment", "Оборудование"],
    ["exp_repair", "Ремонт оборудования"],
    ["exp_rent", "Аренда"],
    ["exp_utils", "Коммунальные услуги"],
    ["exp_software", "Программное обеспечение"],
    ["exp_ads", "Реклама и маркетинг"],
    ["exp_net", "Связь и интернет"],
    ["exp_salary", "Зарплата"],
    ["exp_train", "Обучение"],
    ["exp_tax", "Налоги"],
    ["exp_transport", "Транспорт"],
    [SYS_EXPENSE_OTHER, "Прочее"],
  ];
  const list: BudgetCategory[] = [];
  income.forEach(([id, name, locked], i) => {
    list.push({ id, kind: "income", name, locked, sort: i });
  });
  expense.forEach(([id, name], i) => {
    list.push({ id, kind: "expense", name, sort: i });
  });
  return list;
}

export const BASE_PAY_METHODS = [
  { id: "cash", label: "Наличные" },
  { id: "card", label: "Карта" },
  { id: "transfer", label: "Перевод" },
  { id: "other", label: "Другой способ" },
] as const;

export function payMethodLabel(id: string, custom: string[] = []) {
  const base = BASE_PAY_METHODS.find((m) => m.id === id);
  if (base) return base.label;
  if (custom.includes(id)) return id;
  return id || "Не указан";
}

export function allPayMethods(custom: string[] = []) {
  return [...BASE_PAY_METHODS.map((m) => ({ id: m.id, label: m.label })), ...custom.map((c) => ({ id: c, label: c }))];
}

export const CADENCE_LABEL: Record<BudgetCadence, string> = {
  day: "Ежедневно",
  week: "Еженедельно",
  month: "Ежемесячно",
  year: "Ежегодно",
};

export type BudgetPeriod = "today" | "week" | "month" | "year" | "custom";

export const BUDGET_PERIODS: Array<{ id: BudgetPeriod; label: string }> = [
  { id: "today", label: "Сегодня" },
  { id: "week", label: "Неделя" },
  { id: "month", label: "Месяц" },
  { id: "year", label: "Год" },
  { id: "custom", label: "Свой период" },
];

export function budgetRange(key: BudgetPeriod, from?: string, to?: string, now = new Date()) {
  const end = format(now, "yyyy-MM-dd");
  if (key === "custom") return { from: from || end, to: to || end };
  if (key === "today") return { from: end, to: end };
  if (key === "week") return { from: format(addDays(now, -6), "yyyy-MM-dd"), to: end };
  if (key === "year") return { from: format(addYears(now, -1), "yyyy-MM-dd"), to: end };
  return { from: format(now, "yyyy-MM-01"), to: end };
}

export function inBudgetRange(iso: string, from: string, to: string) {
  const day = (iso || "").slice(0, 10);
  return day >= from && day <= to;
}

export function periodTitle(from: string, to: string, key: BudgetPeriod) {
  try {
    if (key === "today") return format(parseISO(from), "d MMMM yyyy", { locale: ru });
    if (key === "month" && from.slice(0, 7) === to.slice(0, 7)) {
      return format(parseISO(from), "LLLL yyyy", { locale: ru });
    }
    return `${format(parseISO(from), "d MMM", { locale: ru })} — ${format(parseISO(to), "d MMM yyyy", { locale: ru })}`;
  } catch {
    return `${from} — ${to}`;
  }
}

export type LedgerSource = "visit" | "manual" | "recurring";

export interface LedgerOp {
  id: string;
  kind: BudgetKind;
  amount: number;
  date: string;
  categoryId: string;
  method: string;
  title: string;
  note: string;
  patientId?: string;
  vendorId?: string;
  source: LedgerSource;
  visitId?: string;
  doctorId?: string;
  serviceHint?: string;
  locked: boolean;
  createdBy?: string;
}

function visitServiceHint(visit: Visit, services: Service[]) {
  const names = visit.items
    .map((it) => services.find((s) => s.id === it.serviceId)?.name)
    .filter(Boolean) as string[];
  if (!names.length) return "";
  if (names.length === 1) return names[0];
  return `${names[0]} и ещё ${names.length - 1}`;
}

export function visitLedgerOps(
  visits: Visit[],
  patients: Patient[],
  services: Service[],
  appointments: Appointment[],
): LedgerOp[] {
  const out: LedgerOp[] = [];
  for (const v of visits) {
    if (isVoided(v)) continue;
    const paid = rubles(v.paid);
    if (paid <= 0) continue;
    const p = patients.find((x) => x.id === v.patientId);
    out.push({
      id: `visit:${v.id}`,
      kind: "income",
      amount: paid,
      date: v.date,
      categoryId: SYS_INCOME_TREATMENT,
      method: v.paymentMethod || "cash",
      title: p ? `Оплата · ${fullName(p)}` : "Оплата пациента",
      note: v.notes || "",
      patientId: v.patientId,
      source: "visit",
      visitId: v.id,
      doctorId: v.doctorId || appointments.find((a) => a.id === v.appointmentId)?.doctorId,
      serviceHint: visitServiceHint(v, services),
      locked: true,
    });
  }
  return out;
}

export function manualLedgerOps(ops: BudgetOp[]): LedgerOp[] {
  return ops.map((o) => ({
    id: o.id,
    kind: o.kind,
    amount: rubles(o.amount),
    date: o.date,
    categoryId: o.categoryId,
    method: o.method,
    title: o.title,
    note: o.note,
    patientId: o.patientId,
    vendorId: o.vendorId,
    source: o.recurringId ? "recurring" : "manual",
    locked: false,
    createdBy: o.createdBy,
  }));
}

export function buildLedger(
  visits: Visit[],
  ops: BudgetOp[],
  patients: Patient[],
  services: Service[],
  appointments: Appointment[],
): LedgerOp[] {
  const list = [...visitLedgerOps(visits, patients, services, appointments), ...manualLedgerOps(ops)];
  list.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  return list;
}

export function filterLedger(
  list: LedgerOp[],
  opts: {
    from: string;
    to: string;
    kind?: "all" | BudgetKind;
    categoryId?: string;
    method?: string;
    patientId?: string;
    vendorId?: string;
    q?: string;
    patients?: Patient[];
    vendors?: BudgetVendor[];
    categories?: BudgetCategory[];
  },
) {
  const q = (opts.q || "").trim().toLowerCase();
  return list.filter((op) => {
    if (!inBudgetRange(op.date, opts.from, opts.to)) return false;
    if (opts.kind && opts.kind !== "all" && op.kind !== opts.kind) return false;
    if (opts.categoryId && op.categoryId !== opts.categoryId) return false;
    if (opts.method && op.method !== opts.method) return false;
    if (opts.patientId && op.patientId !== opts.patientId) return false;
    if (opts.vendorId && op.vendorId !== opts.vendorId) return false;
    if (!q) return true;
    const p = op.patientId ? opts.patients?.find((x) => x.id === op.patientId) : undefined;
    const v = op.vendorId ? opts.vendors?.find((x) => x.id === op.vendorId) : undefined;
    const c = opts.categories?.find((x) => x.id === op.categoryId);
    const hay = [op.title, op.note, op.serviceHint, c?.name, v?.name, p ? fullName(p) : ""]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}

export interface BudgetTotals {
  income: number;
  expense: number;
  profit: number;
  opening: number;
  balance: number;
  incomeAll: number;
  expenseAll: number;
}

export function budgetTotals(
  ledger: LedgerOp[],
  range: { from: string; to: string },
  openingBalance: number,
  openingDate: string,
): BudgetTotals {
  const openDay = (openingDate || "2000-01-01").slice(0, 10);
  let income = 0;
  let expense = 0;
  let incomeAll = 0;
  let expenseAll = 0;
  for (const op of ledger) {
    const day = op.date.slice(0, 10);
    const amt = rubles(op.amount);
    if (day >= openDay) {
      if (op.kind === "income") incomeAll += amt;
      else expenseAll += amt;
    }
    if (day >= range.from && day <= range.to) {
      if (op.kind === "income") income += amt;
      else expense += amt;
    }
  }
  return {
    income,
    expense,
    profit: income - expense,
    opening: rubles(openingBalance),
    balance: rubles(openingBalance) + incomeAll - expenseAll,
    incomeAll,
    expenseAll,
  };
}

export function monthlySeries(ledger: LedgerOp[], months = 6, now = new Date()) {
  const keys: string[] = [];
  for (let i = months - 1; i >= 0; i--) {
    keys.push(format(addMonths(now, -i), "yyyy-MM"));
  }
  return keys.map((month) => {
    let income = 0;
    let expense = 0;
    for (const op of ledger) {
      if (!op.date.startsWith(month)) continue;
      if (op.kind === "income") income += rubles(op.amount);
      else expense += rubles(op.amount);
    }
    return {
      month,
      label: format(parseISO(`${month}-01`), "LLL", { locale: ru }),
      income,
      expense,
      profit: income - expense,
    };
  });
}

export function categoryShare(ledger: LedgerOp[], categories: BudgetCategory[], kind: BudgetKind, from: string, to: string) {
  const sums = new Map<string, number>();
  let total = 0;
  for (const op of ledger) {
    if (op.kind !== kind) continue;
    if (!inBudgetRange(op.date, from, to)) continue;
    const amt = rubles(op.amount);
    total += amt;
    sums.set(op.categoryId, (sums.get(op.categoryId) ?? 0) + amt);
  }
  const rows = [...sums.entries()]
    .map(([id, amount]) => ({
      id,
      name: categories.find((c) => c.id === id)?.name || id,
      amount,
      pct: total > 0 ? Math.round((amount * 100) / total) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
  return { total, rows };
}

export function incomeByDoctor(
  ledger: LedgerOp[],
  doctors: Doctor[],
  from: string,
  to: string,
) {
  const sums = new Map<string, number>();
  for (const op of ledger) {
    if (op.kind !== "income" || op.source !== "visit") continue;
    if (!inBudgetRange(op.date, from, to)) continue;
    const id = op.doctorId || "_none";
    sums.set(id, (sums.get(id) ?? 0) + rubles(op.amount));
  }
  return [...sums.entries()]
    .map(([id, amount]) => {
      const d = doctors.find((x) => x.id === id);
      return { id, name: d ? `${d.lastName} ${d.firstName?.[0] ?? ""}.`.trim() : "Без врача", amount };
    })
    .sort((a, b) => b.amount - a.amount);
}

export function incomeByService(visits: Visit[], services: Service[], from: string, to: string) {
  const sums = new Map<string, number>();
  for (const v of visits) {
    if (isVoided(v) || rubles(v.paid) <= 0) continue;
    if (!inBudgetRange(v.date, from, to)) continue;
    const paid = rubles(v.paid);
    const itemSum = v.items.reduce((s, it) => s + rubles(it.price) * (it.qty || 1), 0);
    if (itemSum <= 0) {
      sums.set("_other", (sums.get("_other") ?? 0) + paid);
      continue;
    }
    let given = 0;
    v.items.forEach((it, i) => {
      const part = rubles(it.price) * (it.qty || 1);
      const share = i === v.items.length - 1 ? paid - given : Math.round((paid * part) / itemSum);
      given += share;
      const sid = it.serviceId || "_other";
      sums.set(sid, (sums.get(sid) ?? 0) + share);
    });
  }
  return [...sums.entries()]
    .map(([id, amount]) => ({
      id,
      name: services.find((s) => s.id === id)?.name || "Прочее",
      amount,
    }))
    .sort((a, b) => b.amount - a.amount);
}

export function nextAfter(date: string, cadence: BudgetCadence) {
  const d = parseISO(date);
  if (cadence === "day") return format(addDays(d, 1), "yyyy-MM-dd");
  if (cadence === "week") return format(addWeeks(d, 1), "yyyy-MM-dd");
  if (cadence === "month") return format(addMonths(d, 1), "yyyy-MM-dd");
  return format(addYears(d, 1), "yyyy-MM-dd");
}

export function dueRecurring(list: BudgetRecurring[], today = todayISO()) {
  return list.filter((r) => r.active && r.nextDate && r.nextDate <= today);
}

export function upcomingRecurring(list: BudgetRecurring[], today = todayISO()) {
  return list.filter((r) => {
    if (!r.active || !r.nextDate) return false;
    if (r.notifyDays <= 0) return false;
    const fire = format(addDays(parseISO(r.nextDate), -r.notifyDays), "yyyy-MM-dd");
    return fire <= today && r.nextDate >= today;
  });
}

export function categoryUsed(ops: BudgetOp[], plans: BudgetPlan[], recurring: BudgetRecurring[], id: string) {
  if (ops.some((o) => o.categoryId === id)) return true;
  if (recurring.some((r) => r.categoryId === id)) return true;
  if (plans.some((p) => p.items.some((it) => it.categoryId === id))) return true;
  return false;
}

export function planVsFact(
  plan: BudgetPlan | undefined,
  ledger: LedgerOp[],
  categories: BudgetCategory[],
  month: string,
) {
  const items = plan?.items ?? [];
  return items.map((it) => {
    const fact = ledger
      .filter((o) => o.kind === "expense" && o.categoryId === it.categoryId && o.date.startsWith(month))
      .reduce((s, o) => s + rubles(o.amount), 0);
    const limit = rubles(it.amount);
    return {
      categoryId: it.categoryId,
      name: categories.find((c) => c.id === it.categoryId)?.name || it.categoryId,
      plan: limit,
      fact,
      left: limit - fact,
      over: fact > limit && limit > 0,
    };
  });
}

export function emptyBudgetOp(kind: BudgetKind): Omit<BudgetOp, "id" | "createdAt"> {
  return {
    kind,
    amount: 0,
    date: todayISO(),
    categoryId: kind === "income" ? SYS_INCOME_OTHER : SYS_EXPENSE_OTHER,
    method: "cash",
    title: "",
    note: "",
  };
}
