import { cn } from "@/lib/utils";

export function IosSwitch({
  on,
  onChange,
  label,
}: {
  on: boolean;
  onChange: (next: boolean) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={cn(
        "relative h-7 w-11 shrink-0 rounded-full transition-colors duration-200",
        on ? "bg-primary" : "bg-surface-2 shadow-[inset_0_0_0_1px_var(--color-line)]",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 size-6 rounded-full bg-surface shadow-[var(--shadow-card)] transition-transform duration-200",
          on ? "translate-x-[1.15rem]" : "translate-x-0.5",
        )}
      />
    </button>
  );
}
