import { Fragment, useState, type CSSProperties } from "react";
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
  PERMANENT_TYPE_LEGEND,
  PRIMARY_LOWER_LEFT,
  PRIMARY_LOWER_RIGHT,
  PRIMARY_TYPE_LEGEND,
  PRIMARY_UPPER_LEFT,
  PRIMARY_UPPER_RIGHT,
  TOOTH_STATUS_LABEL,
  TOOTH_STATUS_ORDER,
  TOOTH_SURFACES,
  UPPER_LEFT,
  UPPER_RIGHT,
  isPrimary,
  isUpper,
  normalizeTooth,
  statusUsesSurfaces,
  suggestDentition,
  surfaceLabel,
  toothTypeName,
  type DentitionMode,
} from "@/lib/teeth";
import { markLetters } from "@/lib/specialty";
import type { Chart, ToothState, ToothStatus, ToothSurface } from "@/lib/types";
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

function GumRidge({ count, upper }: { count: number; upper: boolean }) {
  const left = 8;
  const right = 632;
  const h = 44;
  const margin = upper ? 32 : 12;
  const amp = 7;
  const step = (right - left) / count;
  let scallop = `M ${left} ${margin}`;
  for (let i = 0; i < count; i++) {
    const x1 = left + (i + 1) * step;
    const xc = left + i * step + step / 2;
    const papilla = upper ? margin + amp : margin - amp;
    scallop += ` Q ${xc} ${papilla} ${x1} ${margin}`;
  }
  const d = upper
    ? `${scallop} L ${right} 0 L ${left} 0 Z`
    : `${scallop} L ${right} ${h} L ${left} ${h} Z`;
  const shine = upper ? 6 : h - 8;
  return (
    <svg viewBox={`0 0 640 ${h}`} className="h-full w-full overflow-visible" preserveAspectRatio="none" aria-hidden>
      <path d={d} fill="var(--color-tooth-gum)" />
      <path
        d={scallop}
        fill="none"
        stroke="rgba(255,255,255,0.4)"
        strokeWidth="1.2"
      />
      <rect
        x={left}
        y={upper ? 0 : h - 10}
        width={right - left}
        height={10}
        fill="rgba(255,255,255,0.12)"
      />
      <line x1="320" y1={upper ? 2 : shine} x2="320" y2={upper ? margin : h - 2} stroke="var(--color-ink)" strokeOpacity="0.18" strokeWidth="1" />
    </svg>
  );
}

function archStyle(index: number, total: number, upper: boolean): CSSProperties {
  const t = total <= 1 ? 0 : (index / (total - 1)) * 2 - 1;
  const lift = t * t * (upper ? -8 : 8);
  const rot = t * (upper ? 8 : -8);
  return {
    transform: `translateY(${lift}px) rotate(${rot}deg)`,
    transformOrigin: upper ? "50% 100%" : "50% 0%",
  };
}

function ToothButton({
  fdi,
  state,
  picked,
  badge,
  style,
  onClick,
}: {
  fdi: number;
  state: ToothState;
  picked?: boolean;
  badge?: string;
  style?: CSSProperties;
  onClick: () => void;
}) {
  const upper = isUpper(fdi);
  return (
    <button
      type="button"
      data-tooth={fdi}
      data-tooth-status={state.status}
      onClick={onClick}
      title={`${fdi} · ${toothTypeName(fdi)} · ${TOOTH_STATUS_LABEL[state.status]}${badge ? ` · ${badge}` : ""}`}
      style={style}
      className="flex min-w-0 flex-col items-center rounded-sm px-px py-0.5 transition-transform duration-150 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
    >
      {upper ? <span className="mb-0.5 font-mono text-[9px] tabular-nums text-muted sm:text-[10px]">{fdi}</span> : null}
      <span className="relative">
        <ToothGlyph fdi={fdi} state={state} picked={picked} />
        {badge ? (
          <span className="absolute -right-0.5 -top-1 rounded bg-primary px-0.5 font-mono text-[8px] leading-tight text-primary-fg">
            {badge}
          </span>
        ) : null}
      </span>
      {!upper ? <span className="mt-0.5 font-mono text-[9px] tabular-nums text-muted sm:text-[10px]">{fdi}</span> : null}
    </button>
  );
}

function Arch({
  left,
  right,
  chart,
  picked,
  marks,
  onSelect,
  upper,
}: {
  left: readonly number[];
  right: readonly number[];
  chart: Chart;
  picked?: Set<number>;
  marks?: Record<string, string[]>;
  onSelect: (fdi: number) => void;
  upper: boolean;
}) {
  const all = [...right, ...left];
  const split = right.length;
  return (
    <div className="relative">
      <div
        className={cn(
          "pointer-events-none absolute inset-x-1 z-0",
          upper ? "top-[16%] h-[42%]" : "bottom-[16%] h-[42%]",
        )}
        aria-hidden
      >
        <GumRidge count={all.length} upper={upper} />
      </div>
      <div className={cn("relative z-[1] flex justify-center gap-px sm:gap-0.5", upper ? "items-end" : "items-start")}>
        {all.map((fdi, i) => (
          <Fragment key={fdi}>
            {i === split ? (
              <span
                aria-hidden
                className={cn("w-px shrink-0 self-stretch bg-ink/20", upper ? "mb-6" : "mt-6")}
              />
            ) : null}
            <ToothButton
              fdi={fdi}
              state={normalizeTooth(chart[fdi])}
              picked={picked?.has(fdi)}
              badge={markLetters(marks?.[String(fdi)] ?? [])}
              style={archStyle(i, all.length, upper)}
              onClick={() => onSelect(fdi)}
            />
          </Fragment>
        ))}
      </div>
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

function QuadrantMap({
  upperRight,
  upperLeft,
  lowerRight,
  lowerLeft,
}: {
  upperRight: readonly number[];
  upperLeft: readonly number[];
  lowerRight: readonly number[];
  lowerLeft: readonly number[];
}) {
  const arch = (
    nums: readonly number[],
    cx: number,
    cy: number,
    start: number,
    end: number,
  ) =>
    nums.map((n, i) => {
      const t = nums.length <= 1 ? 0.5 : i / (nums.length - 1);
      const a = start + (end - start) * t;
      const r = 20;
      return (
        <text
          key={n}
          x={cx + Math.cos(a) * r}
          y={cy + Math.sin(a) * r}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="5.2"
          fill="var(--color-muted)"
          className="font-mono"
        >
          {n}
        </text>
      );
    });
  return (
    <svg viewBox="0 0 72 72" className="size-[4.5rem] shrink-0" aria-hidden>
      <line x1="36" y1="6" x2="36" y2="66" stroke="var(--color-ink)" strokeOpacity="0.28" strokeWidth="0.8" />
      <line x1="6" y1="36" x2="66" y2="36" stroke="var(--color-ink)" strokeOpacity="0.28" strokeWidth="0.8" />
      {arch(upperRight, 36, 36, Math.PI, -Math.PI / 2)}
      {arch(upperLeft, 36, 36, -Math.PI / 2, 0)}
      {arch(lowerLeft, 36, 36, 0, Math.PI / 2)}
      {arch(lowerRight, 36, 36, Math.PI / 2, Math.PI)}
    </svg>
  );
}

function TypeLegend({
  items,
  stacked,
}: {
  items: readonly { n: number; label: string; sample: number }[];
  stacked?: boolean;
}) {
  const healthy: ToothState = { status: "healthy", note: "" };
  return (
    <ul className={stacked ? "flex flex-col gap-1" : "flex flex-wrap gap-x-3 gap-y-1.5"}>
      {items.map((it) => (
        <li key={it.n} className="flex items-center gap-1.5 text-[11px] text-muted">
          <span className="grid w-7 shrink-0 place-items-center">
            <ToothGlyph fdi={it.sample} state={healthy} size="sm" />
          </span>
          <span>{it.label}</span>
        </li>
      ))}
    </ul>
  );
}

function DentitionBoard({
  title,
  subtitle,
  upperRight,
  upperLeft,
  lowerRight,
  lowerLeft,
  chart,
  picked,
  marks,
  onSelect,
  primary,
}: {
  title: string;
  subtitle: string;
  upperRight: readonly number[];
  upperLeft: readonly number[];
  lowerRight: readonly number[];
  lowerLeft: readonly number[];
  chart: Chart;
  picked?: Set<number>;
  marks?: Record<string, string[]>;
  onSelect: (fdi: number) => void;
  primary?: boolean;
}) {
  const legend = primary ? PRIMARY_TYPE_LEGEND : PERMANENT_TYPE_LEGEND;
  return (
    <div data-dentition-board={primary ? "primary" : "permanent"} className="flex flex-col gap-3 lg:flex-row lg:items-start">
      <div className="min-w-0 flex-1">
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <h4 className="font-display text-base sm:text-lg">{title}</h4>
          <p className="text-[11px] text-muted">{subtitle}</p>
        </div>
        <div className="overflow-x-auto pb-1">
          <div className="mx-auto min-w-[20.5rem] max-w-[42rem]">
            <div className="mb-1 text-[11px] font-medium text-muted">Верхняя челюсть</div>
            <SideLabels />
            <Arch
              upper
              right={upperRight}
              left={upperLeft}
              chart={chart}
              picked={picked}
              marks={marks}
              onSelect={onSelect}
            />
            <Arch
              upper={false}
              right={lowerRight}
              left={lowerLeft}
              chart={chart}
              picked={picked}
              marks={marks}
              onSelect={onSelect}
            />
            <div className="mt-1 text-[11px] font-medium text-muted">Нижняя челюсть</div>
            <div className="mt-3 lg:hidden">
              <p className="mb-1 text-[11px] font-medium text-ink">
                {primary ? "Типы зубов · молочный" : "Типы зубов · постоянный"}
              </p>
              <TypeLegend items={legend} />
            </div>
          </div>
        </div>
      </div>
      <aside className="hidden w-[13.5rem] shrink-0 rounded-lg bg-surface-2/70 p-3 lg:block">
        <p className="mb-2 text-[11px] font-medium text-ink">
          {primary ? "Обозначения (молочный прикус)" : "Обозначения (постоянный прикус)"}
        </p>
        <div className="mb-3 flex justify-center">
          <QuadrantMap
            upperRight={upperRight}
            upperLeft={upperLeft}
            lowerRight={lowerRight}
            lowerLeft={lowerLeft}
          />
        </div>
        <TypeLegend items={legend} stacked />
      </aside>
    </div>
  );
}

function SurfacePad({
  fdi,
  selected,
  onToggle,
}: {
  fdi: number;
  selected: ToothSurface[];
  onToggle: (s: ToothSurface) => void;
}) {
  const cells: Array<{ s: ToothSurface; d: string }> = [
    { s: "B", d: "M22 4 L58 4 L50 26 L30 26 Z" },
    { s: "M", d: "M4 22 L26 30 L26 50 L4 58 Z" },
    { s: "O", d: "M30 30 L50 30 L50 50 L30 50 Z" },
    { s: "D", d: "M54 30 L76 22 L76 58 L54 50 Z" },
    { s: "L", d: "M30 54 L50 54 L58 76 L22 76 Z" },
  ];
  const labels: Record<ToothSurface, { x: number; y: number }> = {
    B: { x: 40, y: 16 },
    M: { x: 15, y: 42 },
    O: { x: 40, y: 42 },
    D: { x: 65, y: 42 },
    L: { x: 40, y: 66 },
  };
  return (
    <svg viewBox="0 0 80 80" className="mx-auto size-28" aria-hidden>
      {cells.map(({ s, d }) => {
        const on = selected.includes(s);
        return (
          <g key={s}>
            <path
              d={d}
              fill={on ? "var(--color-primary)" : "var(--color-surface-2)"}
              stroke="var(--color-ink)"
              strokeOpacity="0.28"
              strokeWidth="1.1"
              className="cursor-pointer"
              onClick={() => onToggle(s)}
            />
            <text
              x={labels[s].x}
              y={labels[s].y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="pointer-events-none select-none"
              fontSize="9"
              fill={on ? "var(--color-primary-fg)" : "var(--color-muted)"}
            >
              {s}
            </text>
          </g>
        );
      })}
      <title>Поверхности зуба {fdi}</title>
    </svg>
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
}) {
  const [dentition, setDentition] = useState<DentitionMode>(
    () => defaultDentition ?? suggestDentition(patientAge),
  );
  const [fdi, setFdi] = useState<number | null>(null);
  const current = fdi != null ? normalizeTooth(chart[fdi]) : null;
  const [status, setStatus] = useState<ToothStatus>("healthy");
  const [note, setNote] = useState("");
  const [surfaces, setSurfaces] = useState<ToothSurface[]>([]);
  const [markSel, setMarkSel] = useState<string[]>([]);
  const pickedSet = picked ? new Set(picked) : undefined;
  const showPermanent = dentition === "permanent" || dentition === "mixed";
  const showPrimary = dentition === "primary" || dentition === "mixed";

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
        statusUsesSurfaces(status) && surfaces.length
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
      statusUsesSurfaces(status) && surfaces.length
        ? (Object.fromEntries(surfaces.map((s) => [s, status])) as ToothState["surfaces"])
        : undefined,
  };

  return (
    <div data-odontogram className="rounded-xl bg-surface p-3 shadow-[var(--shadow-card)] sm:p-5">
      {title !== "" ? (
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-display text-lg">{title ?? "Зубная формула"}</h3>
            <p className="text-[12px] text-muted">
              {hint ?? (mode === "pick" ? "FDI · нажмите зуб, чтобы добавить в план" : "FDI · нажмите на зуб")}
            </p>
          </div>
          <div className="flex flex-wrap gap-1 rounded-full bg-surface-2 p-1" data-dentition-toggle>
            {DENTITION_MODE_OPTIONS.map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setDentition(id)}
                className={cn(
                  "h-8 rounded-full px-3 text-[12px] font-medium",
                  dentition === id ? "bg-surface text-ink shadow-[var(--shadow-card)]" : "text-muted hover:text-ink",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="mb-3 flex flex-wrap gap-1 rounded-full bg-surface-2 p-1" data-dentition-toggle>
          {DENTITION_MODE_OPTIONS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setDentition(id)}
              className={cn(
                "h-8 rounded-full px-3 text-[12px] font-medium",
                dentition === id ? "bg-surface text-ink shadow-[var(--shadow-card)]" : "text-muted hover:text-ink",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-8">
        {showPermanent ? (
          <DentitionBoard
            title="Постоянный прикус (32 зуба)"
            subtitle="18–11 · 21–28 / 48–41 · 31–38"
            upperRight={UPPER_RIGHT}
            upperLeft={UPPER_LEFT}
            lowerRight={LOWER_RIGHT}
            lowerLeft={LOWER_LEFT}
            chart={chart}
            picked={pickedSet}
            marks={marks}
            onSelect={open}
          />
        ) : null}
        {showPrimary ? (
          <DentitionBoard
            title="Молочный прикус (20 зубов)"
            subtitle="55–51 · 61–65 / 85–81 · 71–75"
            upperRight={PRIMARY_UPPER_RIGHT}
            upperLeft={PRIMARY_UPPER_LEFT}
            lowerRight={PRIMARY_LOWER_RIGHT}
            lowerLeft={PRIMARY_LOWER_LEFT}
            chart={chart}
            picked={pickedSet}
            marks={marks}
            onSelect={open}
            primary
          />
        ) : null}
      </div>

      <ul className="mt-4 flex flex-wrap gap-x-3 gap-y-1.5 text-[11px] text-muted">
        {TOOTH_STATUS_ORDER.map((s) => (
          <li key={s} className="flex items-center gap-1.5">
            <span className={cn("size-2.5 rounded-sm", STATUS_CLASS[s])} />
            {TOOTH_STATUS_LABEL[s]}
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
              <div className="flex items-center justify-center gap-4 py-1">
                {fdi != null ? <ToothGlyph fdi={fdi} state={liveState} picked size="lg" /> : null}
                {fdi != null && statusUsesSurfaces(status) ? (
                  <div>
                    <SurfacePad fdi={fdi} selected={surfaces} onToggle={toggleSurface} />
                    <p className="mt-1 text-center text-[11px] text-muted">Поверхность</p>
                  </div>
                ) : null}
              </div>
              <Field label="Состояние">
                <Select
                  value={status}
                  onChange={(e) => {
                    const next = e.target.value as ToothStatus;
                    setStatus(next);
                    if (!statusUsesSurfaces(next)) setSurfaces([]);
                  }}
                >
                  {TOOTH_STATUS_ORDER.map((s) => (
                    <option key={s} value={s}>
                      {TOOTH_STATUS_LABEL[s]}
                    </option>
                  ))}
                </Select>
              </Field>
              {fdi != null && statusUsesSurfaces(status) ? (
                <Field label="Подпись поверхностей">
                  <p className="mb-1.5 text-[12px] text-muted">
                    Можно отметить несколько. Если ничего не отмечено — состояние на весь зуб.
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
