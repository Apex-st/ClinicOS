import { Fragment, useMemo, useState } from "react";
import { ChipToggle } from "@/components/chip-toggle";
import { ToothGlyph, STATUS_CLASS } from "@/components/tooth-glyph";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Field, Select } from "./ui/field";
import { Textarea } from "./ui/textarea";
import {
  ALL_FDI,
  ALL_PRIMARY_FDI,
  DENTITION_MODE_OPTIONS,
  LOWER_LEFT,
  LOWER_RIGHT,
  MIXED_PRIMARY_LOWER,
  MIXED_PRIMARY_UPPER,
  PALMER_PERM,
  PALMER_PRIM,
  PRIMARY_LOWER_LEFT,
  PRIMARY_LOWER_RIGHT,
  PRIMARY_UPPER_LEFT,
  PRIMARY_UPPER_RIGHT,
  TOOTH_SURFACES,
  UPPER_LEFT,
  UPPER_RIGHT,
  isPrimary,
  isUpper,
  normalizeTooth,
  parseDentition,
  statusUsesSurfaces,
  suggestDentition,
  surfaceLabel,
  toothStatusLabel,
  toothTypeName,
  visibleToothStatuses,
  type DentitionMode,
} from "@/lib/teeth";
import { markLetters } from "@/lib/specialty";
import { useClinic } from "@/lib/store";
import type { Chart, ToothState, ToothStatus, ToothStatusDef, ToothSurface } from "@/lib/types";
import { cn } from "@/lib/utils";

export { STATUS_CLASS };

export function ToothFdiOptions() {
  return (
    <>
      <optgroup label="Постоянные">
        {ALL_FDI.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </optgroup>
      <optgroup label="Молочные">
        {ALL_PRIMARY_FDI.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </optgroup>
    </>
  );
}

function ToothButton({
  fdi,
  state,
  picked,
  badge,
  defs,
  size,
  onClick,
}: {
  fdi: number;
  state: ToothState;
  picked?: boolean;
  badge?: string;
  defs?: ToothStatusDef[] | null;
  size?: "sm" | "md";
  onClick: () => void;
}) {
  const upper = isUpper(fdi);
  return (
    <button
      type="button"
      data-tooth={fdi}
      data-tooth-status={state.status}
      onClick={onClick}
      title={`${fdi} · ${toothTypeName(fdi)} · ${toothStatusLabel(state.status, defs)}${badge ? ` · ${badge}` : ""}`}
      className="flex w-9 shrink-0 flex-col items-center gap-0.5 rounded-sm px-px py-0.5 transition-transform duration-150 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 sm:w-11"
    >
      {upper ? <span className="font-mono text-[9px] tabular-nums text-muted sm:text-[10px]">{fdi}</span> : null}
      <span className="relative">
        <ToothGlyph fdi={fdi} state={state} picked={picked} size={size ?? "md"} defs={defs} />
        {badge ? (
          <span className="absolute -right-0.5 -top-1 rounded bg-primary px-0.5 font-mono text-[8px] leading-tight text-primary-fg">
            {badge}
          </span>
        ) : null}
      </span>
      {!upper ? <span className="font-mono text-[9px] tabular-nums text-muted sm:text-[10px]">{fdi}</span> : null}
    </button>
  );
}

function Midline() {
  return <span aria-hidden className="mx-0.5 w-px shrink-0 self-stretch bg-ink/25" />;
}

function Slot({
  fdi,
  chart,
  picked,
  marks,
  defs,
  size,
  onSelect,
}: {
  fdi: number | null;
  chart: Chart;
  picked?: Set<number>;
  marks?: Record<string, string[]>;
  defs?: ToothStatusDef[] | null;
  size?: "sm" | "md";
  onSelect: (fdi: number) => void;
}) {
  if (fdi == null) {
    return <span className="w-9 shrink-0 sm:w-11" aria-hidden />;
  }
  return (
    <ToothButton
      fdi={fdi}
      state={normalizeTooth(chart[fdi])}
      picked={picked?.has(fdi)}
      badge={markLetters(marks?.[String(fdi)] ?? [])}
      defs={defs}
      size={size}
      onClick={() => onSelect(fdi)}
    />
  );
}

function JawRow({
  teeth,
  chart,
  picked,
  marks,
  defs,
  size,
  onSelect,
  align,
}: {
  teeth: ReadonlyArray<number | null>;
  chart: Chart;
  picked?: Set<number>;
  marks?: Record<string, string[]>;
  defs?: ToothStatusDef[] | null;
  size?: "sm" | "md";
  onSelect: (fdi: number) => void;
  align?: "end" | "start";
}) {
  const split = teeth.length / 2;
  return (
    <div className={cn("flex justify-center gap-px sm:gap-0.5", align === "end" ? "items-end" : "items-start")}>
      {teeth.map((fdi, i) => (
        <Fragment key={fdi ?? `empty-${i}`}>
          {i === split ? <Midline /> : null}
          <Slot fdi={fdi} chart={chart} picked={picked} marks={marks} defs={defs} size={size} onSelect={onSelect} />
        </Fragment>
      ))}
    </div>
  );
}

function PalmerRuler({ values }: { values: readonly number[] }) {
  const split = values.length / 2;
  return (
    <div className="flex justify-center gap-px sm:gap-0.5">
      {values.map((n, i) => (
        <Fragment key={`${n}-${i}`}>
          {i === split ? <span className="mx-0.5 w-px shrink-0" /> : null}
          <span className="w-9 shrink-0 text-center font-mono text-[10px] tabular-nums text-subtle sm:w-11">{n}</span>
        </Fragment>
      ))}
    </div>
  );
}

function SideLabels() {
  return (
    <div className="mb-1 grid grid-cols-2 px-1 text-center text-[11px] font-medium text-muted">
      <span>Правая сторона</span>
      <span>Левая сторона</span>
    </div>
  );
}

export function Odontogram({
  chart,
  onChange,
  readOnly,
  mode = "edit",
  picked,
  onPick,
  title,
  hint,
  marks,
  markOptions,
  onMarksChange,
  patientAge,
  defaultDentition,
  dentition: dentitionProp,
  onDentitionChange,
}: {
  chart: Chart;
  onChange?: (fdi: number, status: ToothStatus, note: string, surfaces?: ToothState["surfaces"]) => void;
  readOnly?: boolean;
  mode?: "edit" | "pick";
  picked?: number[];
  onPick?: (fdi: number) => void;
  title?: string;
  hint?: string;
  marks?: Record<string, string[]>;
  markOptions?: readonly (readonly [string, string])[];
  onMarksChange?: (fdi: number, marks: string[]) => void;
  patientAge?: number | null;
  defaultDentition?: DentitionMode;
  dentition?: DentitionMode;
  onDentitionChange?: (mode: DentitionMode) => void;
}) {
  const saved = useClinic((s) => s.settings.toothStatuses);
  const defs = useMemo(() => visibleToothStatuses(saved), [saved]);
  const suggested = defaultDentition ?? suggestDentition(patientAge);
  const [innerDentition, setInnerDentition] = useState<DentitionMode>(() => dentitionProp ?? suggested);
  const dentition = parseDentition(dentitionProp) ?? innerDentition;
  const [fdi, setFdi] = useState<number | null>(null);
  const current = fdi != null ? normalizeTooth(chart[fdi]) : null;
  const [status, setStatus] = useState<ToothStatus>("healthy");
  const [note, setNote] = useState("");
  const [surfaces, setSurfaces] = useState<ToothSurface[]>([]);
  const [markSel, setMarkSel] = useState<string[]>([]);
  const pickedSet = picked ? new Set(picked) : undefined;

  const statusOptions = useMemo(() => {
    const list = [...defs];
    if (status && !list.some((d) => d.id === status)) {
      const extra = visibleToothStatuses(saved)
        .concat(saved?.filter((d) => d.id === status) ?? [])
        .find((d) => d.id === status);
      if (extra) list.push(extra);
      else list.push({ id: status, label: toothStatusLabel(status, saved), color: "#6b6358", usesSurfaces: false });
    }
    return list;
  }, [defs, status, saved]);

  function setMode(next: DentitionMode) {
    setInnerDentition(next);
    onDentitionChange?.(next);
  }

  function open(next: number) {
    if (mode === "pick") {
      onPick?.(next);
      return;
    }
    if (readOnly) return;
    const t = normalizeTooth(chart[next]);
    setFdi(next);
    setStatus(t.status);
    setNote(t.note);
    setSurfaces(t.surfaces ? (Object.keys(t.surfaces) as ToothSurface[]) : []);
    setMarkSel(marks?.[String(next)] ?? []);
  }

  function toggleSurface(s: ToothSurface) {
    setSurfaces((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));
  }

  function save() {
    if (fdi == null) return;
    if (onChange) {
      const nextSurfaces =
        statusUsesSurfaces(status, saved) && surfaces.length
          ? (Object.fromEntries(surfaces.map((s) => [s, status])) as ToothState["surfaces"])
          : undefined;
      onChange(fdi, status, note, nextSurfaces);
    }
    onMarksChange?.(fdi, markSel);
    setFdi(null);
  }

  const liveState: ToothState = {
    status,
    note,
    surfaces:
      statusUsesSurfaces(status, saved) && surfaces.length
        ? (Object.fromEntries(surfaces.map((s) => [s, status])) as ToothState["surfaces"])
        : undefined,
  };

  const permUpper = [...UPPER_RIGHT, ...UPPER_LEFT];
  const permLower = [...LOWER_RIGHT, ...LOWER_LEFT];
  const primUpper = [...PRIMARY_UPPER_RIGHT, ...PRIMARY_UPPER_LEFT];
  const primLower = [...PRIMARY_LOWER_RIGHT, ...PRIMARY_LOWER_LEFT];

  const rowProps = { chart, picked: pickedSet, marks, defs: saved, onSelect: open };

  return (
    <div data-odontogram className="rounded-xl bg-surface p-3 shadow-[var(--shadow-card)] sm:p-5">
      {title !== "" ? (
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-display text-lg">{title ?? "Зубная формула"}</h3>
            <p className="text-[12px] text-muted">
              {hint ??
                (mode === "pick"
                  ? "Нажмите квадрат, чтобы добавить зуб в план"
                  : "Квадрат с пятью поверхностями. Нажмите зуб.")}
            </p>
          </div>
          <DentitionToggle value={dentition} onChange={setMode} />
        </div>
      ) : (
        <div className="mb-3">
          <DentitionToggle value={dentition} onChange={setMode} />
        </div>
      )}

      <div className="overflow-x-auto pb-1">
        <div className="mx-auto w-max min-w-full">
          <SideLabels />
          {dentition === "permanent" ? (
            <>
              <PalmerRuler values={PALMER_PERM} />
              <p className="mb-1 mt-1 text-[11px] font-medium text-muted">Верхняя челюсть</p>
              <JawRow teeth={permUpper} align="end" {...rowProps} />
              <div className="mx-8 my-2 h-px bg-ink/15" />
              <JawRow teeth={permLower} align="start" {...rowProps} />
              <p className="mt-1 text-[11px] font-medium text-muted">Нижняя челюсть</p>
              <PalmerRuler values={PALMER_PERM} />
            </>
          ) : null}
          {dentition === "primary" ? (
            <>
              <PalmerRuler values={PALMER_PRIM} />
              <p className="mb-1 mt-1 text-[11px] font-medium text-muted">Верхняя челюсть · молочные</p>
              <JawRow teeth={primUpper} align="end" {...rowProps} />
              <div className="mx-8 my-2 h-px bg-ink/15" />
              <JawRow teeth={primLower} align="start" {...rowProps} />
              <p className="mt-1 text-[11px] font-medium text-muted">Нижняя челюсть · молочные</p>
              <PalmerRuler values={PALMER_PRIM} />
            </>
          ) : null}
          {dentition === "mixed" ? (
            <>
              <PalmerRuler values={PALMER_PERM} />
              <p className="mb-1 mt-1 text-[11px] font-medium text-muted">Верхняя челюсть</p>
              <JawRow teeth={permUpper} align="end" {...rowProps} />
              <p className="mt-1 text-center text-[10px] tracking-wide text-subtle">Молочные</p>
              <JawRow teeth={MIXED_PRIMARY_UPPER} align="end" size="sm" {...rowProps} />
              <div className="mx-8 my-1.5 h-px bg-ink/20" />
              <JawRow teeth={MIXED_PRIMARY_LOWER} align="start" size="sm" {...rowProps} />
              <p className="mb-1 text-center text-[10px] tracking-wide text-subtle">Молочные</p>
              <JawRow teeth={permLower} align="start" {...rowProps} />
              <p className="mt-1 text-[11px] font-medium text-muted">Нижняя челюсть</p>
              <PalmerRuler values={PALMER_PERM} />
            </>
          ) : null}
        </div>
      </div>

      <ul className="mt-4 flex flex-wrap gap-x-3 gap-y-1.5 text-[11px] text-muted">
        {defs.map((s) => (
          <li key={s.id} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm shadow-[inset_0_0_0_1px_rgb(28_25_21/0.2)]" style={{ background: s.color }} />
            {s.label}
          </li>
        ))}
      </ul>

      <Dialog open={fdi != null} onOpenChange={(o) => !o && setFdi(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Зуб {fdi}
              {fdi != null ? (
                <span className="mt-0.5 block text-sm font-normal text-muted">
                  {toothTypeName(fdi)}
                  {isPrimary(fdi) ? " · молочный" : " · постоянный"}
                </span>
              ) : null}
            </DialogTitle>
          </DialogHeader>
          {current && onChange ? (
            <>
              <div className="flex items-center justify-center py-1">
                {fdi != null ? (
                  <ToothGlyph
                    fdi={fdi}
                    state={liveState}
                    picked
                    size="lg"
                    defs={saved}
                    onSurface={statusUsesSurfaces(status, saved) ? toggleSurface : undefined}
                  />
                ) : null}
              </div>
              <Field label="Состояние">
                <Select
                  value={status}
                  onChange={(e) => {
                    const next = e.target.value as ToothStatus;
                    setStatus(next);
                    if (!statusUsesSurfaces(next, saved)) setSurfaces([]);
                  }}
                >
                  {statusOptions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </Select>
              </Field>
              {fdi != null && statusUsesSurfaces(status, saved) ? (
                <Field label="Поверхности">
                  <p className="mb-1.5 text-[12px] text-muted">
                    Нажмите сектор на квадрате или подпись. Если ничего не отмечено — состояние на весь зуб.
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {TOOTH_SURFACES.map((s) => (
                      <ChipToggle
                        key={s}
                        label={`${s} · ${surfaceLabel(fdi, s)}`}
                        on={surfaces.includes(s)}
                        onToggle={() => toggleSurface(s)}
                      />
                    ))}
                  </div>
                </Field>
              ) : null}
              <Field label="Заметка">
                <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
              </Field>
            </>
          ) : null}
          {markOptions?.length ? (
            <Field label="Отметки">
              <div className="flex flex-wrap gap-1.5">
                {markOptions.map(([id, label]) => (
                  <ChipToggle
                    key={id}
                    label={label}
                    on={markSel.includes(id)}
                    onToggle={() =>
                      setMarkSel((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))
                    }
                  />
                ))}
              </div>
            </Field>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setFdi(null)}>
              Отмена
            </Button>
            <Button type="button" onClick={save}>
              Сохранить
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DentitionToggle({
  value,
  onChange,
}: {
  value: DentitionMode;
  onChange: (mode: DentitionMode) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1 rounded-full bg-surface-2 p-1" data-dentition-toggle>
      {DENTITION_MODE_OPTIONS.map(([id, label]) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={cn(
            "h-8 rounded-full px-3 text-[12px] font-medium",
            value === id ? "bg-surface text-ink shadow-[var(--shadow-card)]" : "text-muted hover:text-ink",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
