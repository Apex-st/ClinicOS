import { Fragment, useState, type CSSProperties } from "react";
import { ChipToggle } from "@/components/chip-toggle";
import { ToothGlyph, STATUS_CLASS } from "@/components/tooth-glyph";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Field, Select } from "./ui/field";
import { Textarea } from "./ui/textarea";
import {
  LOWER_LEFT,
  LOWER_RIGHT,
  TOOTH_STATUS_LABEL,
  TOOTH_STATUS_ORDER,
  TOOTH_SURFACES,
  UPPER_LEFT,
  UPPER_RIGHT,
  isUpper,
  normalizeTooth,
  statusUsesSurfaces,
  surfaceLabel,
} from "@/lib/teeth";
import { markLetters } from "@/lib/specialty";
import type { Chart, ToothState, ToothStatus, ToothSurface } from "@/lib/types";
import { cn } from "@/lib/utils";

export { STATUS_CLASS };

function GumBand() {
  const n = 16;
  const left = 18;
  const right = 622;
  const midY = 18;
  const amp = 7;
  const step = (right - left) / n;
  let d = `M ${left} ${midY}`;
  for (let i = 0; i < n; i++) {
    const x1 = left + (i + 1) * step;
    const xc = left + i * step + step / 2;
    d += ` Q ${xc} ${midY - amp} ${x1} ${midY}`;
  }
  for (let i = n - 1; i >= 0; i--) {
    const x1 = left + i * step;
    const xc = left + i * step + step / 2;
    d += ` Q ${xc} ${midY + amp} ${x1} ${midY}`;
  }
  d += " Z";
  return (
    <svg viewBox="0 0 640 36" className="mx-auto h-5 w-full max-w-[42rem] overflow-visible" aria-hidden>
      <path d={d} fill="var(--color-tooth-gum)" opacity="0.95" />
      <path
        d={`M ${left} ${midY - 1} ${Array.from({ length: n }, (_, i) => {
          const x1 = left + (i + 1) * step;
          const xc = left + i * step + step / 2;
          return `Q ${xc} ${midY - amp - 1} ${x1} ${midY - 1}`;
        }).join(" ")}`}
        fill="none"
        stroke="rgba(255,255,255,0.4)"
        strokeWidth="1.1"
      />
      <line x1="320" y1="3" x2="320" y2="33" stroke="var(--color-ink)" strokeOpacity="0.22" strokeWidth="1.1" />
    </svg>
  );
}

function archStyle(index: number, total: number, upper: boolean): CSSProperties {
  const t = total <= 1 ? 0 : (index / (total - 1)) * 2 - 1;
  const lift = t * t * (upper ? -14 : 14);
  const rot = t * (upper ? 14 : -14);
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
      title={`${fdi} · ${TOOTH_STATUS_LABEL[state.status]}${badge ? ` · ${badge}` : ""}`}
      style={style}
      className={cn(
        "flex min-w-0 flex-col items-center gap-0.5 rounded-sm px-px py-0.5 transition-transform duration-150 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        !upper && "flex-col-reverse",
      )}
    >
      <span className="font-mono text-[9px] tabular-nums text-muted sm:text-[10px]">{fdi}</span>
      <span className="relative">
        <ToothGlyph fdi={fdi} state={state} picked={picked} />
        {badge ? (
          <span className="absolute -right-0.5 -top-1 rounded bg-primary px-0.5 font-mono text-[8px] leading-tight text-primary-fg">
            {badge}
          </span>
        ) : null}
      </span>
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
    <div className={cn("flex justify-center gap-px sm:gap-0.5", upper ? "items-end pb-1" : "items-start pt-1")}>
      {all.map((fdi, i) => (
        <Fragment key={fdi}>
          {i === split ? (
            <span
              aria-hidden
              className={cn("w-px shrink-0 self-stretch bg-ink/20", upper ? "mb-5" : "mt-5")}
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
}) {
  const [fdi, setFdi] = useState<number | null>(null);
  const current = fdi != null ? normalizeTooth(chart[fdi]) : null;
  const [status, setStatus] = useState<ToothStatus>("healthy");
  const [note, setNote] = useState("");
  const [surfaces, setSurfaces] = useState<ToothSurface[]>([]);
  const [markSel, setMarkSel] = useState<string[]>([]);
  const pickedSet = picked ? new Set(picked) : undefined;

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
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h3 className="font-display text-lg">{title ?? "Зубная формула"}</h3>
          <p className="text-[12px] text-muted">
            {hint ?? (mode === "pick" ? "FDI · нажмите зуб, чтобы добавить в план" : "FDI · нажмите на зуб")}
          </p>
        </div>
      ) : null}
      <div className="overflow-x-auto pb-2">
        <div className="mx-auto min-w-[20.5rem] max-w-[42rem]">
          <Arch
            upper
            right={UPPER_RIGHT}
            left={UPPER_LEFT}
            chart={chart}
            picked={pickedSet}
            marks={marks}
            onSelect={open}
          />
          <div className="relative mx-2 sm:mx-4">
            <GumBand />
          </div>
          <Arch
            upper={false}
            right={LOWER_RIGHT}
            left={LOWER_LEFT}
            chart={chart}
            picked={pickedSet}
            marks={marks}
            onSelect={open}
          />
        </div>
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
            <DialogTitle>Зуб {fdi}</DialogTitle>
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
