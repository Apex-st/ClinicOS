import type { DiscountKind, DiscountType } from "./types";

export function computeDiscountAmount(kind: DiscountKind, value: number, subtotal: number) {
  if (subtotal <= 0 || value <= 0) return 0;
  if (kind === "percent") return Math.min(subtotal, Math.round((subtotal * value) / 100));
  return Math.min(subtotal, Math.round(value));
}

export function amountForType(type: DiscountType | undefined, subtotal: number) {
  if (!type || !type.active) return 0;
  return computeDiscountAmount(type.kind, type.value, subtotal);
}

export function describeDiscount(type: DiscountType) {
  return type.kind === "percent" ? `${type.value}%` : `${type.value.toLocaleString("ru-RU")} ₽`;
}

export function planTotals(items: Array<{ price: number; qty: number; discount: number }>, planDiscount: number) {
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const lineDiscount = items.reduce((s, i) => s + i.discount, 0);
  const afterLines = Math.max(0, subtotal - lineDiscount);
  const plan = Math.min(afterLines, Math.max(0, planDiscount));
  const total = Math.max(0, afterLines - plan);
  return { subtotal, lineDiscount, planDiscount: plan, total };
}
