import { cn } from "@/lib/utils";

export function PeriodSwitch<T extends string>({
  value,
  onChange,
  options,
  className,
  compact,
}: {
  value: T;
  onChange: (id: T) => void;
  options: ReadonlyArray<{ id: T; label: string }>;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex w-full gap-1 overflow-x-auto rounded-lg bg-surface-2 p-1",
        compact && "rounded-md p-0.5",
        className,
      )}
      role="tablist"
    >
      {options.map((o) => {
        const on = value === o.id;
        return (
          <button
            key={o.id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(o.id)}
            className={cn(
              "h-9 min-w-[4.25rem] flex-1 shrink-0 rounded-md px-3 text-sm font-medium whitespace-nowrap",
              compact && "h-7 min-w-0 px-2 text-[13px]",
              on ? "bg-surface text-ink shadow-[var(--shadow-card)]" : "text-muted",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
