import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { ChipToggle } from "@/components/chip-toggle";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatDate, fullName, todayISO } from "@/lib/format";
import { emptyMeasure, emptyStudy, emptyVisit, optLabel, STUDY_KINDS } from "@/lib/specialty";
import { useClinic } from "@/lib/store";
import type { SpecMeasure, SpecStudy, SpecVisit } from "@/lib/types";
import { cn } from "@/lib/utils";

export function nowTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function SpecSection({
  id,
  title,
  summary,
  open,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  summary?: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section id={`spec-${id}`} className="rounded-xl bg-surface shadow-[var(--shadow-card)]">
      <button
        type="button"
        onClick={onToggle}
        className="flex min-h-11 w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="min-w-0">
          <span className="font-display text-lg">{title}</span>
          {summary && !open ? (
            <span className="mt-0.5 block truncate text-[12px] text-muted">{summary}</span>
          ) : null}
        </span>
        <ChevronDown className={cn("size-4 shrink-0 text-muted transition-transform", open && "rotate-180")} />
      </button>
      {open ? <div className="flex flex-col gap-3 border-t border-line px-4 py-4">{children}</div> : null}
    </section>
  );
}

export function SpecNav({
  items,
  onJump,
}: {
  items: { id: string; label: string }[];
  onJump: (id: string) => void;
}) {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1">
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          onClick={() => onJump(it.id)}
          className="h-9 shrink-0 rounded-full bg-surface px-3 text-[13px] font-medium shadow-[var(--shadow-card)]"
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

export function RadioChips({
  options,
  value,
  onChange,
}: {
  options: readonly (readonly [string, string])[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(([id, label]) => (
        <ChipToggle key={id} label={label} on={value === id} onToggle={() => onChange(value === id ? "" : id)} />
      ))}
    </div>
  );
}

export function MultiChips({
  options,
  value,
  onChange,
}: {
  options: readonly (readonly [string, string])[];
  value: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(([id, label]) => (
        <ChipToggle
          key={id}
          label={label}
          on={value.includes(id)}
          onToggle={() => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id])}
        />
      ))}
    </div>
  );
}

export function useOpenMap(initial: string) {
  const [open, setOpen] = useState<Record<string, boolean>>({ [initial]: true });
  function toggle(id: string) {
    setOpen((s) => ({ ...s, [id]: !s[id] }));
  }
  function jump(id: string) {
    setOpen((s) => ({ ...s, [id]: true }));
    window.requestAnimationFrame(() => {
      document.getElementById(`spec-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }
  return { open, toggle, jump, isOpen: (id: string) => Boolean(open[id]) };
}

export function MeasureList({
  items,
  onChange,
}: {
  items: SpecMeasure[];
  onChange: (next: SpecMeasure[]) => void;
}) {
  function patch(id: string, next: Partial<SpecMeasure>) {
    onChange(items.map((m) => (m.id === id ? { ...m, ...next } : m)));
  }
  return (
    <div className="flex flex-col gap-2">
      {items.map((m) => (
        <div key={m.id} className="grid grid-cols-[1fr_5.5rem_3.5rem_auto] items-end gap-2">
          <Field label="Параметр">
            <Input value={m.name} onChange={(e) => patch(m.id, { name: e.target.value })} />
          </Field>
          <Field label="Значение">
            <Input value={m.value} onChange={(e) => patch(m.id, { value: e.target.value })} inputMode="decimal" />
          </Field>
          <Field label="Ед.">
            <Input value={m.unit} onChange={(e) => patch(m.id, { unit: e.target.value })} />
          </Field>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            className="mb-0.5 text-danger"
            onClick={() => onChange(items.filter((x) => x.id !== m.id))}
            aria-label="Удалить измерение"
          >
            <Trash2 />
          </Button>
        </div>
      ))}
      <Button type="button" variant="secondary" onClick={() => onChange([...items, emptyMeasure()])}>
        <Plus className="size-4" />
        Параметр
      </Button>
    </div>
  );
}

export function StudyList({
  items,
  onChange,
  extra,
}: {
  items: SpecStudy[];
  onChange: (next: SpecStudy[]) => void;
  extra?: (study: SpecStudy) => ReactNode;
}) {
  function patch(id: string, next: Partial<SpecStudy>) {
    onChange(items.map((s) => (s.id === id ? { ...s, ...next } : s)));
  }
  return (
    <div className="flex flex-col gap-3">
      {items.length === 0 ? <p className="text-sm text-muted">Исследований пока нет</p> : null}
      {items.map((s) => (
        <div key={s.id} className="rounded-lg bg-bg p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="Дата">
              <Input type="date" value={s.date} onChange={(e) => patch(s.id, { date: e.target.value })} />
            </Field>
            <Field label="Тип">
              <Select value={s.kind} onChange={(e) => patch(s.id, { kind: e.target.value })}>
                {STUDY_KINDS.map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Описание" className="sm:col-span-2">
              <Textarea rows={2} value={s.notes} onChange={(e) => patch(s.id, { notes: e.target.value })} />
            </Field>
            <Field label="Заключение" className="sm:col-span-2">
              <Textarea rows={2} value={s.conclusion} onChange={(e) => patch(s.id, { conclusion: e.target.value })} />
            </Field>
          </div>
          {extra ? extra(s) : null}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="mt-2 text-danger"
            onClick={() => onChange(items.filter((x) => x.id !== s.id))}
          >
            <Trash2 className="size-4" />
            Удалить исследование
          </Button>
        </div>
      ))}
      <Button type="button" variant="secondary" onClick={() => onChange([...items, emptyStudy()])}>
        <Plus className="size-4" />
        Исследование
      </Button>
    </div>
  );
}

export function VisitList({
  items,
  onChange,
  statusLabel = "Состояние",
}: {
  items: SpecVisit[];
  onChange: (next: SpecVisit[]) => void;
  statusLabel?: string;
}) {
  const doctors = useClinic((s) => s.doctors).filter((d) => d.active);
  function patch(id: string, next: Partial<SpecVisit>) {
    onChange(items.map((v) => (v.id === id ? { ...v, ...next } : v)));
  }
  function add() {
    const first = doctors[0];
    onChange([
      ...items,
      {
        ...emptyVisit(first?.id ?? ""),
        date: todayISO(),
        time: nowTime(),
      },
    ]);
  }
  const sorted = [...items].sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`));
  return (
    <div className="flex flex-col gap-3">
      <Button type="button" onClick={add}>
        <Plus className="size-4" />
        Новый приём
      </Button>
      {sorted.length === 0 ? <p className="text-sm text-muted">Приёмов в этой карте пока нет</p> : null}
      {sorted.map((v) => {
        const doc = doctors.find((d) => d.id === v.doctorId);
        return (
          <div key={v.id} className="rounded-lg bg-bg p-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="Дата">
                <Input type="date" value={v.date} onChange={(e) => patch(v.id, { date: e.target.value })} />
              </Field>
              <Field label="Время">
                <Input type="time" value={v.time} onChange={(e) => patch(v.id, { time: e.target.value })} />
              </Field>
              <Field label="Врач" className="sm:col-span-2">
                <Select value={v.doctorId} onChange={(e) => patch(v.id, { doctorId: e.target.value })}>
                  <option value="">{doc ? fullName(doc) : "Выберите врача"}</option>
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>
                      {fullName(d)}
                      {d.specialty ? ` · ${d.specialty}` : ""}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Жалобы" className="sm:col-span-2">
                <Textarea rows={2} value={v.complaints} onChange={(e) => patch(v.id, { complaints: e.target.value })} />
              </Field>
              <Field label="Проведённые манипуляции" className="sm:col-span-2">
                <Textarea rows={2} value={v.actions} onChange={(e) => patch(v.id, { actions: e.target.value })} />
              </Field>
              <Field label={statusLabel} className="sm:col-span-2">
                <Input value={v.status} onChange={(e) => patch(v.id, { status: e.target.value })} />
              </Field>
              <Field label="Рекомендации" className="sm:col-span-2">
                <Textarea
                  rows={2}
                  value={v.recommendations}
                  onChange={(e) => patch(v.id, { recommendations: e.target.value })}
                />
              </Field>
              <Field label="Следующий визит">
                <Input type="date" value={v.nextDate} onChange={(e) => patch(v.id, { nextDate: e.target.value })} />
              </Field>
              <Field label="Комментарий">
                <Input value={v.notes} onChange={(e) => patch(v.id, { notes: e.target.value })} />
              </Field>
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="mt-2 text-danger"
              onClick={() => onChange(items.filter((x) => x.id !== v.id))}
            >
              <Trash2 className="size-4" />
              Удалить запись
            </Button>
          </div>
        );
      })}
    </div>
  );
}

export function TimelineView({
  events,
}: {
  events: { date: string; title: string; detail?: string }[];
}) {
  if (!events.length) return <p className="text-sm text-muted">Событий пока нет — они появятся из приёмов, снимков и дат аппарата</p>;
  return (
    <ol className="flex flex-col gap-3">
      {events.map((e, i) => (
        <li key={`${e.date}-${e.title}-${i}`} className="flex gap-3">
          <span className="w-24 shrink-0 text-[13px] tabular-nums text-muted">
            {e.date ? formatDate(e.date, "d MMM yyyy") : "—"}
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-medium">{e.title}</span>
            {e.detail ? <span className="block text-[13px] text-muted">{e.detail}</span> : null}
          </span>
        </li>
      ))}
    </ol>
  );
}

export function SavedHint({ at }: { at?: string }) {
  if (!at) return <p className="text-[12px] text-muted">Данные пишутся в ту же карточку пациента сразу при изменении</p>;
  return (
    <p className="text-[12px] text-muted">
      Сохранено {formatDate(at.slice(0, 10), "d MMMM")} {at.slice(11, 16)}
    </p>
  );
}

export function studyKindLabel(kind: string) {
  return optLabel(STUDY_KINDS, kind);
}
