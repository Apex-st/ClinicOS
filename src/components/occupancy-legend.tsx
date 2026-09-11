import type { CSSProperties } from "react";
import { fillStyle } from "@/lib/schedule";
import { cn } from "@/lib/utils";

const ITEMS: Array<{ label: string; style?: CSSProperties; empty?: boolean }> = [
  { label: "никто не записан", empty: true },
  { label: "мало записей", style: fillStyle(20, false, 1) },
  { label: "день занят", style: fillStyle(100, false, 1) },
];

export function OccupancyLegend({ className }: { className?: string }) {
  return (
    <ul className={cn("flex flex-col gap-2.5 text-sm text-ink", className)}>
      {ITEMS.map((item) => (
        <li key={item.label} className="flex items-center gap-2.5">
          <span
            className={cn("size-4 shrink-0 rounded-sm", item.empty && "bg-surface shadow-[var(--shadow-card)]")}
            style={item.style}
            aria-hidden
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}
