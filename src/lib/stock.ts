import type { StockGroup, StockItem } from "./types";

export const STOCK_UNITS = ["шт", "мл", "г", "уп", "шпр"] as const;
export type StockUnit = (typeof STOCK_UNITS)[number];

export function seedStockGroups(): StockGroup[] {
  return [
    { id: "stg_fill", name: "Пломбировочные", sort: 0 },
    { id: "stg_endo", name: "Эндодонтия", sort: 1 },
    { id: "stg_anest", name: "Анестезия", sort: 2 },
    { id: "stg_consumable", name: "Расходники", sort: 3 },
  ];
}

export function seedStockItems(): StockItem[] {
  return [
    { id: "mat_filtek_a2", groupId: "stg_fill", name: "Filtek Ultimate A2", unit: "шт", qty: 12, minQty: 3, note: "", active: true },
    { id: "mat_adhesive", groupId: "stg_fill", name: "Адгезив Single Bond", unit: "мл", qty: 8, minQty: 2, note: "", active: true },
    { id: "mat_etch", groupId: "stg_fill", name: "Протравка 37%", unit: "мл", qty: 10, minQty: 2, note: "", active: true },
    { id: "mat_gutta", groupId: "stg_endo", name: "Гуттаперчевые штифты", unit: "уп", qty: 6, minQty: 2, note: "", active: true },
    { id: "mat_sealer", groupId: "stg_endo", name: "Силер AH Plus", unit: "уп", qty: 3, minQty: 1, note: "", active: true },
    { id: "mat_temp", groupId: "stg_endo", name: "Временная пломба", unit: "шт", qty: 15, minQty: 4, note: "", active: true },
    { id: "mat_ultracain", groupId: "stg_anest", name: "Ultracain D-S", unit: "шт", qty: 20, minQty: 5, note: "", active: true },
    { id: "mat_rubber", groupId: "stg_consumable", name: "Коффердам", unit: "шт", qty: 25, minQty: 5, note: "", active: true },
  ];
}

export function materialName(items: StockItem[], id: string) {
  return items.find((m) => m.id === id)?.name ?? id;
}

export function usedMaterialIds(diary?: { materialIds?: string[]; findings?: Array<{ materialIds?: string[] }> } | null) {
  const ids = [...(diary?.materialIds ?? [])];
  for (const f of diary?.findings ?? []) ids.push(...(f.materialIds ?? []));
  return [...new Set(ids.filter(Boolean))];
}

export function sortedStockGroups(groups: StockGroup[]) {
  return groups.slice().sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name, "ru"));
}

/** Активные материалы для кнопок дневника и шаблонов, включая без группы. */
export function materialsForDiary(items: StockItem[], groups: StockGroup[]) {
  const active = items.filter((m) => m.active);
  const sorted = sortedStockGroups(groups);
  const used = new Set<string>();
  const buckets: Array<{ id: string; name: string; items: StockItem[] }> = [];
  for (const g of sorted) {
    const list = active.filter((m) => m.groupId === g.id);
    if (!list.length) continue;
    buckets.push({ id: g.id, name: g.name, items: list });
    for (const m of list) used.add(m.id);
  }
  const rest = active.filter((m) => !used.has(m.id));
  if (rest.length) buckets.push({ id: "_other", name: "Другие", items: rest });
  return buckets;
}
