import { ChevronDown, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { fullName } from "@/lib/format";
import type { Patient } from "@/lib/types";
import { cn } from "@/lib/utils";

export function PatientPicker({
  patients,
  value,
  onChange,
  expandOnFocus = false,
}: {
  patients: Patient[];
  value: string;
  onChange: (id: string) => void;
  /** Для уже выбранного пациента список не выпадает сам — только по нажатию. */
  expandOnFocus?: boolean;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const chosen = patients.find((p) => p.id === value);

  const list = useMemo(() => {
    const n = q.trim().toLowerCase();
    const src = n
      ? patients.filter((p) => `${fullName(p)} ${p.phone} ${p.cardNumber}`.toLowerCase().includes(n))
      : patients;
    return src.slice(0, 40);
  }, [patients, q]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function openList() {
    setQ("");
    setOpen(true);
    window.setTimeout(() => inputRef.current?.focus(), 20);
  }

  if (chosen && !open) {
    return (
      <div ref={box} className="relative min-w-0 flex-1">
        <button
          type="button"
          className="flex h-11 w-full min-w-0 items-center gap-2 rounded-md bg-surface-2 px-3 text-left text-sm text-ink"
          onClick={openList}
          aria-label="Сменить пациента"
        >
          <span className="min-w-0 flex-1 truncate font-medium">{fullName(chosen)}</span>
          <ChevronDown className="size-4 shrink-0 text-muted" />
        </button>
      </div>
    );
  }

  return (
    <div ref={box} className="relative min-w-0 flex-1">
      <Search className="pointer-events-none absolute top-1/2 left-3 z-[1] size-4 -translate-y-1/2 text-subtle" />
      <Input
        ref={inputRef}
        className="pr-11 pl-10"
        placeholder="Найти по ФИО, телефону или карте"
        value={open ? q : chosen ? fullName(chosen) : q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          if (!expandOnFocus && chosen) return;
          openList();
        }}
        autoComplete="off"
        autoFocus={false}
      />
      <button
        type="button"
        className="absolute top-1/2 right-1 grid size-9 -translate-y-1/2 place-items-center rounded-md text-muted hover:bg-surface hover:text-ink"
        aria-label={open ? "Скрыть список" : "Показать список пациентов"}
        onClick={() => (open ? setOpen(false) : openList())}
      >
        <ChevronDown className={cn("size-4 transition-transform duration-150", open && "rotate-180")} />
      </button>
      {open ? (
        <ul className="absolute top-[calc(100%+4px)] z-30 max-h-56 w-full overflow-y-auto rounded-lg bg-surface py-1 shadow-[var(--shadow-lift)]">
          {list.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted">Никого не нашли</li>
          ) : (
            list.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className={cn(
                    "flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-surface-2",
                    p.id === value && "bg-surface-2",
                  )}
                  onClick={() => {
                    onChange(p.id);
                    setQ("");
                    setOpen(false);
                  }}
                >
                  <span className="truncate font-medium">{fullName(p)}</span>
                  <span className="truncate text-[12px] text-muted">
                    {[p.cardNumber, p.phone].filter(Boolean).join(" · ") || "без телефона"}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
