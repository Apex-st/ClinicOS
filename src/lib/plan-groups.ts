import { planTotals } from "./discounts";
import { formatDate, fullName, money } from "./format";
import type { Patient, PlanItem, Settings, TreatmentPlan } from "./types";
import { uid } from "./utils";

export type PlanGroup = {
  key: string;
  toothFdi?: number;
  diagnosis: string;
  diagnosisId?: string;
  note: string;
  items: PlanItem[];
  subtotal: number;
};

export function emptyPlanItem(toothFdi?: number): PlanItem {
  return {
    id: uid("pli"),
    toothFdi,
    diagnosis: "",
    serviceName: "",
    qty: 1,
    price: 0,
    discount: 0,
    note: "",
  };
}

export function groupPlanItems(items: PlanItem[]): PlanGroup[] {
  const order: string[] = [];
  const map = new Map<string, PlanItem[]>();
  for (const it of items) {
    const key = it.toothFdi != null ? `t${it.toothFdi}` : "general";
    if (!map.has(key)) {
      order.push(key);
      map.set(key, []);
    }
    map.get(key)!.push(it);
  }
  const ranked = [...order.filter((k) => k !== "general"), ...order.filter((k) => k === "general")];
  return ranked.map((key) => {
    const list = map.get(key) ?? [];
    const withDx = list.find((i) => i.diagnosis.trim() || i.diagnosisId);
    const withNote = list.find((i) => (i.note || "").trim());
    const subtotal = list.reduce((s, i) => s + Math.max(0, i.price * i.qty - i.discount), 0);
    return {
      key,
      toothFdi: key === "general" ? undefined : Number(key.slice(1)),
      diagnosis: withDx?.diagnosis ?? "",
      diagnosisId: withDx?.diagnosisId,
      note: withNote?.note ?? "",
      items: list,
      subtotal,
    };
  });
}

export function patchGroup(
  items: PlanItem[],
  toothFdi: number | undefined,
  patch: Partial<Pick<PlanItem, "diagnosis" | "diagnosisId" | "note">>,
): PlanItem[] {
  return items.map((it) => {
    const same = toothFdi == null ? it.toothFdi == null : it.toothFdi === toothFdi;
    return same ? { ...it, ...patch } : it;
  });
}

export function planDocumentText(plan: TreatmentPlan, patient: Patient, settings: Settings) {
  const groups = groupPlanItems(plan.items);
  const totals = planTotals(plan.items, plan.discount);
  const lines: string[] = [
    "ПЛАН ЛЕЧЕНИЯ",
    "",
    `Пациент: ${fullName(patient)}`,
    `Врач: ${plan.doctorName || settings.doctorName}`,
    `Дата: ${formatDate(plan.date)}`,
    patient.cardNumber ? `Карта: ${patient.cardNumber}` : "",
    "",
  ];
  for (const g of groups) {
    lines.push(g.toothFdi != null ? `ЗУБ ${g.toothFdi}` : "ОБЩИЕ УСЛУГИ");
    lines.push("");
    if (g.diagnosis.trim()) {
      lines.push("Диагноз:");
      lines.push(g.diagnosis.trim());
      lines.push("");
    }
    const named = g.items.filter((i) => i.serviceName.trim());
    if (named.length) {
      lines.push(g.toothFdi != null ? "План лечения:" : "Услуги:");
      lines.push("");
      named.forEach((it, i) => {
        const sum = Math.max(0, it.price * it.qty - it.discount);
        const qty = it.qty > 1 ? ` × ${it.qty}` : "";
        lines.push(`${i + 1}. ${it.serviceName}${qty} — ${money(sum)}`);
      });
      lines.push("");
    }
    if (g.toothFdi != null) {
      lines.push(`Стоимость: ${money(g.subtotal)}`);
      lines.push("");
    }
  }
  lines.push(`ИТОГО: ${money(totals.total)}`);
  return lines.filter((l, i, arr) => !(l === "" && arr[i - 1] === "")).join("\n");
}
