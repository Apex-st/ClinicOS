import {
  addMonths,
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
import { CalendarDays } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";

export function DateJump({
  value,
  onChange,
  label,
  compact,
  className,
}: {
  value: string;
  onChange: (iso: string) => void;
  label?: string;
  compact?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(value);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) setCursor(value);
  }, [open, value]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: PointerEvent) {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const day = parseISO(cursor || value || todayISO());
  const start = startOfWeek(startOfMonth(day), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(day), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start, end });
  const caption = label ?? format(parseISO(value), "d MMMM yyyy", { locale: ru });

  return (
    <div ref={root} className={cn("relative", className)}>
      {compact ? (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex h-7 min-w-0 max-w-full items-center gap-1 truncate text-left text-[13px] font-medium capitalize"
          aria-label="Выбрать дату"
        >
          <span className="truncate">{caption}</span>
        </button>
      ) : (
        <Button type="button" variant="secondary" size="sm" onClick={() => setOpen((o) => !o)}>
          <CalendarDays className="size-4" />
          {caption}
        </Button>
      )}
      {open ? (
        <div className="absolute top-full left-0 z-30 mt-2 w-[280px] rounded-xl bg-surface p-3 shadow-[var(--shadow-lift)]">
          <div className="mb-2 flex items-center justify-between gap-2">
            <button type="button" className="text-sm text-primary" onClick={() => setCursor(format(addMonths(day, -1), "yyyy-MM-dd"))}>
              ←
            </button>
            <p className="text-sm font-medium capitalize">{format(day, "LLLL yyyy", { locale: ru })}</p>
            <button type="button" className="text-sm text-primary" onClick={() => setCursor(format(addMonths(day, 1), "yyyy-MM-dd"))}>
              →
            </button>
          </div>
          <div className="mb-2 grid grid-cols-2 gap-2">
            <select
              className="h-9 rounded-md border border-line bg-bg px-2 text-sm"
              value={day.getMonth()}
              onChange={(e) => setCursor(format(new Date(day.getFullYear(), Number(e.target.value), 1), "yyyy-MM-dd"))}
            >
              {Array.from({ length: 12 }, (_, m) => (
                <option key={m} value={m}>
                  {format(new Date(2020, m, 1), "LLLL", { locale: ru })}
                </option>
              ))}
            </select>
            <select
              className="h-9 rounded-md border border-line bg-bg px-2 text-sm"
              value={day.getFullYear()}
              onChange={(e) => setCursor(format(new Date(Number(e.target.value), day.getMonth(), 1), "yyyy-MM-dd"))}
            >
              {Array.from({ length: 11 }, (_, i) => day.getFullYear() - 5 + i).map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-muted">
            {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {days.map((d) => {
              const iso = format(d, "yyyy-MM-dd");
              const on = iso === value;
              const today = iso === todayISO();
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => {
                    onChange(iso);
                    setOpen(false);
                  }}
                  className={cn(
                    "grid h-9 place-items-center rounded-md text-[13px]",
                    !isSameMonth(d, day) && "text-subtle",
                    on && "bg-primary text-primary-fg",
                    !on && today && "ring-1 ring-primary",
                    !on && "hover:bg-surface-2",
                  )}
                >
                  {format(d, "d")}
                </button>
              );
            })}
          </div>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="mt-2 w-full"
            onClick={() => {
              onChange(todayISO());
              setOpen(false);
            }}
          >
            Сегодня
          </Button>
        </div>
      ) : null}
    </div>
  );
}
