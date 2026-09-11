import { useState } from "react";
import { cn } from "@/lib/utils";

export function ChipToggle({
  label,
  on,
  onToggle,
}: {
  label: string;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "rounded-full px-3 py-1.5 text-left text-[13px] leading-tight transition-colors",
        on ? "bg-primary text-primary-fg" : "bg-surface-2 text-ink hover:bg-line",
      )}
    >
      {label}
    </button>
  );
}

export function ChipGroup({
  options,
  extra,
  value,
  onChange,
  onAdd,
}: {
  options: readonly (readonly [string, string])[];
  extra?: string[];
  value: string[];
  onChange: (next: string[]) => void;
  onAdd?: (label: string) => void;
}) {
  const [custom, setCustom] = useState("");
  function toggle(id: string) {
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  }
  function add() {
    const name = custom.trim();
    if (!name || !onAdd) return;
    onAdd(name);
    onChange([...value, name]);
    setCustom("");
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(([id, label]) => (
        <ChipToggle key={id} label={label} on={value.includes(id)} onToggle={() => toggle(id)} />
      ))}
      {(extra ?? []).map((label) => (
        <ChipToggle key={label} label={label} on={value.includes(label)} onToggle={() => toggle(label)} />
      ))}
      {onAdd ? (
        <span className="inline-flex items-center gap-1">
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            placeholder="+ свой"
            className="h-8 w-28 rounded-full bg-surface-2 px-3 text-[13px] outline-none"
          />
        </span>
      ) : null}
    </div>
  );
}
