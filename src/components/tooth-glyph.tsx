import { isPrimary, statusInk, statusUsesSurfaces, toothStatusColor, toothStatusLabel, toothSurfaceStatus } from "@/lib/teeth";
import type { ToothState, ToothStatus, ToothStatusDef, ToothSurface } from "@/lib/types";
import { cn } from "@/lib/utils";

export const STATUS_CLASS: Record<string, string> = {
  healthy: "bg-tooth-healthy text-ink",
  caries: "bg-tooth-caries text-primary-fg",
  filling: "bg-tooth-filling text-primary-fg",
  pulpitis: "bg-tooth-pulpitis text-primary-fg",
  periodontitis: "bg-tooth-periodontitis text-primary-fg",
  crown: "bg-tooth-crown text-primary-fg",
  veneer: "bg-tooth-veneer text-ink",
  implant: "bg-tooth-implant text-primary-fg",
  root: "bg-tooth-root text-primary-fg",
  missing: "bg-tooth-missing text-subtle",
  extracted: "bg-tooth-extracted text-subtle",
  bridge: "bg-tooth-bridge text-primary-fg",
};

const SIZE_CLASS = {
  sm: "size-8",
  md: "size-10",
  lg: "size-28",
} as const;

/** Геометрический квадрат: B сверху, L снизу, O в центре, M/D по бокам. */
const SURFACE_PATH: Record<ToothSurface, string> = {
  B: "M3 3 H37 L27.2 12.8 H12.8 Z",
  M: "M3 3 V37 L12.8 27.2 V12.8 Z",
  O: "M12.8 12.8 H27.2 V27.2 H12.8 Z",
  D: "M37 3 V37 L27.2 27.2 V12.8 Z",
  L: "M3 37 H37 L27.2 27.2 H12.8 Z",
};

const SURFACE_LABEL: Record<ToothSurface, { x: number; y: number }> = {
  B: { x: 20, y: 7.4 },
  M: { x: 7.4, y: 21 },
  O: { x: 20, y: 21 },
  D: { x: 32.6, y: 21 },
  L: { x: 20, y: 34.6 },
};

function mesialOnLeft(fdi: number) {
  const q = Math.floor(fdi / 10);
  return q === 2 || q === 3 || q === 6 || q === 7;
}

function fillOf(status: ToothStatus, defs?: ToothStatusDef[] | null) {
  return toothStatusColor(status, defs);
}

export function ToothGlyph({
  fdi,
  state,
  picked,
  size = "md",
  defs,
  onSurface,
}: {
  fdi: number;
  state: ToothState;
  picked?: boolean;
  size?: "sm" | "md" | "lg";
  defs?: ToothStatusDef[] | null;
  onSurface?: (s: ToothSurface) => void;
}) {
  const gone = state.status === "missing" || state.status === "extracted";
  const split = Boolean(statusUsesSurfaces(state.status, defs) && state.surfaces && Object.keys(state.surfaces).length);
  const flip = !mesialOnLeft(fdi);
  const letters = size === "lg";
  const surfaces: ToothSurface[] = ["B", "M", "O", "D", "L"];
  const round = isPrimary(fdi) ? 4.2 : 2.4;

  return (
    <svg
      viewBox="0 0 40 40"
      className={cn("overflow-visible", SIZE_CLASS[size], picked && "drop-shadow-[0_0_0_2px_var(--color-primary)]")}
      aria-hidden={!onSurface}
    >
      <title>{`${fdi} · ${toothStatusLabel(state.status, defs)}`}</title>
      <rect
        x="1.4"
        y="1.4"
        width="37.2"
        height="37.2"
        rx={round}
        fill="var(--color-surface)"
        stroke={picked ? "var(--color-primary)" : "var(--color-ink)"}
        strokeOpacity={picked ? 0.9 : 0.32}
        strokeWidth={picked ? 1.7 : 1.15}
        strokeDasharray={state.status === "missing" ? "2.4 1.7" : undefined}
      />
      {surfaces.map((s) => {
        const logical: ToothSurface = flip && (s === "M" || s === "D") ? (s === "M" ? "D" : "M") : s;
        const st = split ? toothSurfaceStatus(state, logical) : gone && state.status === "missing" ? "missing" : state.status;
        const fill = fillOf(st, defs);
        const ink = statusInk(fill);
        return (
          <g key={s}>
            <path
              d={SURFACE_PATH[s]}
              fill={fill}
              fillOpacity={state.status === "missing" ? 0.38 : 1}
              stroke="var(--color-surface)"
              strokeWidth="1.15"
              className={onSurface ? "cursor-pointer" : undefined}
              onClick={onSurface ? () => onSurface(logical) : undefined}
            />
            {letters ? (
              <text
                x={SURFACE_LABEL[s].x}
                y={SURFACE_LABEL[s].y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="4.8"
                fontFamily="ui-monospace, monospace"
                fill={ink}
                fillOpacity={0.88}
                className="pointer-events-none select-none"
              >
                {logical}
              </text>
            ) : null}
          </g>
        );
      })}
      {state.status === "extracted" ? (
        <path
          d="M11 11 L29 29 M29 11 L11 29"
          fill="none"
          stroke="var(--color-danger)"
          strokeWidth="2.1"
          strokeLinecap="round"
        />
      ) : null}
      {state.status === "implant" ? (
        <g fill="none" stroke={statusInk(fillOf("implant", defs))} strokeWidth="1.15" opacity="0.85">
          <path d="M20 11 V29" />
          <path d="M16 14 H24 M16 17.5 H24 M16 21 H24 M16 24.5 H24" />
        </g>
      ) : null}
      {state.status === "bridge" ? (
        <g stroke="var(--color-ink)" strokeOpacity="0.45" strokeWidth="2.2" strokeLinecap="round">
          <path d="M1 20 H8" />
          <path d="M32 20 H39" />
        </g>
      ) : null}
      {state.status === "root" ? (
        <path d="M12 12 H28 V16 H12 Z" fill="var(--color-surface)" fillOpacity="0.55" />
      ) : null}
    </svg>
  );
}
