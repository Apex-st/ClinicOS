import { isPrimary, isUpper, toothKind, toothSurfaceStatus, TOOTH_STATUS_LABEL, statusUsesSurfaces } from "@/lib/teeth";
import type { ToothState, ToothStatus, ToothSurface } from "@/lib/types";
import { cn } from "@/lib/utils";

export const STATUS_CLASS: Record<ToothStatus, string> = {
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

type Kind = ReturnType<typeof toothKind>;

function spec(fdi: number) {
  const n = fdi % 10;
  const upper = isUpper(fdi);
  const primary = isPrimary(fdi);
  const kind = toothKind(fdi);
  const roots = primary
    ? n <= 3
      ? 1
      : upper
        ? 3
        : 2
    : n <= 3
      ? 1
      : n === 4 && upper
        ? 2
        : n === 5
          ? 1
          : upper
            ? 3
            : 2;
  const width = primary
    ? n === 1
      ? 1.1
      : n === 2
        ? 0.88
        : n === 3
          ? 0.96
          : n === 4
            ? 1.22
            : 1.34
    : n === 1
      ? 1.18
      : n === 2
        ? 0.92
        : n === 3
          ? 1
          : n === 4
            ? 1.06
            : n === 5
              ? 1.02
              : n === 6
                ? 1.34
                : n === 7
                  ? 1.22
                  : 0.96;
  return { n, upper, kind, roots, width, wisdom: !primary && n === 8, primary };
}

function enamelColor(status: ToothStatus) {
  if (status === "healthy" || status === "veneer") return "#f6f0e4";
  if (status === "missing" || status === "extracted") return "transparent";
  return `var(--color-tooth-${status})`;
}

function surfacePaint(state: ToothState, surface?: ToothSurface) {
  const st = surface ? toothSurfaceStatus(state, surface) : state.status;
  return enamelColor(st);
}

const SIZE = {
  sm: { unit: 18, h: 56 },
  md: { unit: 20, h: 64 },
  lg: { unit: 58, h: 176 },
} as const;

/** Лицевой вид: корни кверху, коронка книзу. Нижние зубы зеркалим. */
export function ToothGlyph({
  fdi,
  state,
  picked,
  size = "md",
}: {
  fdi: number;
  state: ToothState;
  picked?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const s = spec(fdi);
  const gone = state.status === "missing" || state.status === "extracted";
  const uid = `t${fdi}-${size}`;
  const dim = SIZE[size];
  const hScale = s.primary ? 0.92 : 1;
  const w = dim.unit * s.width;
  const q = Math.floor(fdi / 10);
  const rightSide = q === 1 || q === 4 || q === 5 || q === 8;
  const tilt = s.wisdom ? (rightSide ? -7 : 7) : 0;

  return (
    <svg
      viewBox="0 0 56 112"
      width={w}
      height={dim.h * hScale}
      className={cn("overflow-visible", picked && "drop-shadow-[0_0_0_2px_var(--color-primary)]")}
      aria-hidden
    >
      <title>{`${fdi} · ${TOOTH_STATUS_LABEL[state.status]}`}</title>
      <defs>
        <linearGradient id={`${uid}-en`} x1="18" y1="46" x2="40" y2="104" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={state.status === "crown" ? "#f4edd4" : "#fffdf8"} />
          <stop offset="38%" stopColor={surfacePaint(state)} />
          <stop offset="100%" stopColor={state.status === "crown" ? "#6e624c" : "#d8c7ad"} />
        </linearGradient>
        <linearGradient id={`${uid}-rt`} x1="28" y1="2" x2="28" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#e2c49a" />
          <stop offset="55%" stopColor="#c9a06f" />
          <stop offset="100%" stopColor="#a9845c" />
        </linearGradient>
        <radialGradient id={`${uid}-pulp`} cx="50%" cy="62%" r="44%">
          <stop offset="0%" stopColor="#e45b5b" />
          <stop offset="55%" stopColor="var(--color-tooth-pulpitis)" />
          <stop offset="100%" stopColor="var(--color-tooth-pulpitis)" stopOpacity="0.15" />
        </radialGradient>
        <radialGradient id={`${uid}-gran`} cx="38%" cy="38%" r="70%">
          <stop offset="0%" stopColor="#f0b27a" />
          <stop offset="70%" stopColor="var(--color-tooth-periodontitis)" />
          <stop offset="100%" stopColor="#6b3a12" stopOpacity="0.55" />
        </radialGradient>
        <filter id={`${uid}-sh`} x="-30%" y="-8%" width="160%" height="140%">
          <feDropShadow dx="0" dy="1.15" stdDeviation="1.15" floodColor="#4a3724" floodOpacity="0.28" />
        </filter>
        <clipPath id={`${uid}-c`}>
          <path d={crownPath(s.kind, s.n, s.primary)} />
        </clipPath>
      </defs>
      <g filter={gone ? undefined : `url(#${uid}-sh)`} transform={s.upper ? undefined : "translate(0 112) scale(1 -1)"}>
        <g transform={tilt ? `rotate(${tilt} 28 56)` : undefined}>
          {state.status === "periodontitis" && !gone ? <Granulomas roots={s.roots} uid={uid} /> : null}
          {state.status === "implant" ? (
            <Implant uid={uid} />
          ) : (
            <g transform={s.primary ? "translate(28 46) scale(1 0.78) translate(-28 -46)" : undefined}>
              <Roots count={s.roots} kind={s.kind} gone={gone} fill={`url(#${uid}-rt)`} />
            </g>
          )}
          {state.status === "root" ? (
            <path
              d="M18 46 C17 54 18 62 28 64 C38 62 39 54 38 46"
              fill="none"
              stroke="#a9845c"
              strokeWidth="1.4"
            />
          ) : (
            <Crown uid={uid} kind={s.kind} n={s.n} state={state} rightSide={rightSide} gone={gone} primary={s.primary} />
          )}
        </g>
      </g>
    </svg>
  );
}

function Roots({
  count,
  kind,
  gone,
  fill,
}: {
  count: number;
  kind: Kind;
  gone: boolean;
  fill: string;
}) {
  const stroke = gone ? "var(--color-subtle)" : "#7a5a38";
  const sw = 0.85;
  const op = gone ? 0.28 : 1;
  const common = { fill: gone ? "none" : fill, stroke, strokeWidth: sw, opacity: op, strokeLinejoin: "round" as const };
  if (count === 3) {
    return (
      <g {...common}>
        <path d="M10.2 46 C7.4 28 7 14 12.2 5.2 C14.8 0.8 19.4 1.4 20.8 10 L22.2 46 Z" />
        <path d="M21.4 46 L22.8 8 C24 2.2 29.6 2 30.8 8.6 L32.2 46 Z" />
        <path d="M31.4 46 L33.4 12 C35.2 3.6 41.6 4 42.8 12.4 C44 24 42.2 36 40.4 46 Z" />
      </g>
    );
  }
  if (count === 2) {
    return (
      <g {...common}>
        <path d="M14.4 46 C11.8 26 11.2 12 16.8 4.4 C19.4 1 24.2 2 25.4 9.6 L26.6 46 Z" />
        <path d="M27.2 46 L29.4 12 C31 4.4 37.2 4.6 38.4 12.2 L36.8 46 Z" />
      </g>
    );
  }
  if (kind === "canine") {
    return (
      <path
        d="M20.2 46 C18.2 24 16.8 8 21.6 1.2 C24.6 -1.6 30.4 0.2 31.6 9 C33 22 31.2 36 29.6 46 Z"
        {...common}
      />
    );
  }
  return (
    <path
      d="M19.4 46 C17.8 24 18 10 22.4 3.2 C25.2 0.2 30.6 0.8 32 7.4 C33.4 16 32.2 32 30.6 46 Z"
      {...common}
    />
  );
}

function Granulomas({ roots, uid }: { roots: number; uid: string }) {
  const fill = `url(#${uid}-gran)`;
  const stroke = "var(--color-tooth-periodontitis)";
  if (roots === 3) {
    return (
      <g fill={fill} stroke={stroke} strokeWidth="0.55">
        <ellipse cx="15.4" cy="5.4" rx="4.4" ry="4" />
        <ellipse cx="26.4" cy="3.2" rx="4" ry="3.6" />
        <ellipse cx="38.2" cy="7" rx="4.2" ry="3.8" />
      </g>
    );
  }
  if (roots === 2) {
    return (
      <g fill={fill} stroke={stroke} strokeWidth="0.55">
        <ellipse cx="20.2" cy="4.6" rx="4.4" ry="4" />
        <ellipse cx="33.6" cy="7.2" rx="3.8" ry="3.4" />
      </g>
    );
  }
  return <ellipse cx="26.4" cy="3.4" rx="5" ry="4.4" fill={fill} stroke={stroke} strokeWidth="0.6" />;
}

function Implant({ uid }: { uid: string }) {
  return (
    <g>
      <defs>
        <clipPath id={`${uid}-imp`}>
          <path d="M21.2 46 L22.6 9 C23.6 3.8 29.2 3.8 30.2 9 L31.6 46 Z" />
        </clipPath>
      </defs>
      <path
        d="M21.2 46 L22.6 9 C23.6 3.8 29.2 3.8 30.2 9 L31.6 46 Z"
        fill="var(--color-tooth-implant)"
        stroke="var(--color-ink)"
        strokeOpacity="0.35"
        strokeWidth="0.8"
      />
      <g clipPath={`url(#${uid}-imp)`} stroke="var(--color-ink)" strokeOpacity="0.4" strokeWidth="1.15">
        <path d="M20 14 H34 M20 19 H34 M20 24 H34 M20 29 H34 M20 34 H34 M20 39 H34" />
      </g>
      <path d="M22 46 H31.6 L33 51 H20.6 Z" fill="var(--color-tooth-implant)" />
      <ellipse cx="26.8" cy="54" rx="8.4" ry="4.2" fill="var(--color-tooth-implant)" opacity="0.9" />
    </g>
  );
}

function Crown({
  uid,
  kind,
  n,
  state,
  rightSide,
  gone,
  primary,
}: {
  uid: string;
  kind: Kind;
  n: number;
  state: ToothState;
  rightSide: boolean;
  gone: boolean;
  primary: boolean;
}) {
  const d = crownPath(kind, n, primary);
  const split = Boolean(statusUsesSurfaces(state.status) && state.surfaces && Object.keys(state.surfaces).length);
  const extracted = state.status === "extracted";
  const veneer = state.status === "veneer";
  const bridge = state.status === "bridge";
  const pulpitis = state.status === "pulpitis";
  const filling = state.status === "filling";
  const caries = state.status === "caries";
  const mesialLeft = !rightSide;
  const fill = gone ? "none" : split ? "#f6f0e4" : `url(#${uid}-en)`;

  return (
    <g>
      <path
        d={d}
        fill={fill}
        stroke={gone ? "var(--color-subtle)" : "#8a7358"}
        strokeOpacity={gone ? 0.5 : 0.45}
        strokeWidth="1.15"
        strokeLinejoin="round"
        strokeDasharray={gone ? "2.4 1.8" : undefined}
      />
      {split && !gone ? (
        <g clipPath={`url(#${uid}-c)`}>
          <rect x="8" y="48" width="40" height="36" fill={surfacePaint(state, "B")} />
          <path d="M8 82 H48 V106 H8 Z" fill={surfacePaint(state, "O")} />
          <path d="M10 44 H46 V52 H10 Z" fill={surfacePaint(state, "L")} />
          <rect x={mesialLeft ? 2 : 32} y="46" width="20" height="52" fill={surfacePaint(state, "M")} />
          <rect x={mesialLeft ? 32 : 2} y="46" width="20" height="52" fill={surfacePaint(state, "D")} />
          <path d={d} fill="none" stroke="#8a7358" strokeOpacity="0.3" strokeWidth="1" />
        </g>
      ) : null}
      {!gone && !split ? (
        <>
          <path d={dentinPath(kind)} fill="#7a6248" opacity="0.07" />
          <path d={highlightPath(kind)} fill="#fff" opacity="0.38" />
          <path d={cervixPath(kind)} fill="#c9ae8c" opacity="0.22" />
        </>
      ) : null}
      {pulpitis && !gone ? (
        <g clipPath={`url(#${uid}-c)`}>
          <path d={pulpPath(kind)} fill={`url(#${uid}-pulp)`} />
          <path d={pulpPath(kind)} fill="none" stroke="#9b3a3a" strokeWidth="0.7" opacity="0.85" />
        </g>
      ) : null}
      {filling && !gone && !split ? (
        <g clipPath={`url(#${uid}-c)`}>
          <path
            d={kind === "molar" ? "M20 72 C22 66 32 66 35 73 C37 82 34 92 28 95 C22 92 18 82 20 72 Z" : "M22 70 C24 64 32 64 34 72 C35 82 32 92 28 94 C24 92 21 82 22 70 Z"}
            fill="var(--color-tooth-filling)"
            stroke="var(--color-ink)"
            strokeOpacity="0.22"
            strokeWidth="0.55"
          />
        </g>
      ) : null}
      {caries && !gone && !split ? (
        <g clipPath={`url(#${uid}-c)`}>
          <ellipse cx="33" cy="80" rx="4.2" ry="5" fill="#2a1c14" opacity="0.62" />
          <ellipse cx="32.2" cy="78.6" rx="1.6" ry="1.8" fill="var(--color-tooth-caries)" opacity="0.8" />
        </g>
      ) : null}
      {veneer && !gone ? (
        <path
          d={d}
          fill="var(--color-tooth-veneer)"
          opacity="0.88"
          stroke="#8a7358"
          strokeOpacity="0.16"
          strokeWidth="0.5"
          transform="translate(2.6 2.2) scale(0.9 0.9)"
        />
      ) : null}
      {bridge && !gone ? (
        <>
          <path d="M1 64 H13" stroke="var(--color-tooth-bridge)" strokeWidth="3.6" strokeLinecap="round" />
          <path d="M43 64 H55" stroke="var(--color-tooth-bridge)" strokeWidth="3.6" strokeLinecap="round" />
        </>
      ) : null}
      {extracted ? (
        <path
          d="M16 52 L40 94 M40 52 L16 94"
          fill="none"
          stroke="var(--color-danger)"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      ) : null}
      {!gone && kind === "molar" ? (
        <>
          <path d="M16 88 Q22 82 28 88 Q34 82 40 88" fill="none" stroke="#6a5640" strokeOpacity="0.22" strokeWidth="0.9" />
          <path d="M19 74 Q28 70 37 74" fill="none" stroke="#6a5640" strokeOpacity="0.12" strokeWidth="0.65" />
        </>
      ) : null}
      {!gone && kind === "premolar" ? (
        <path d="M20 88 Q28 82 36 88" fill="none" stroke="#6a5640" strokeOpacity="0.2" strokeWidth="0.85" />
      ) : null}
      {!gone && kind === "incisor" ? (
        <>
          <path d="M18 96 Q22 99.4 28 100 Q34 99.4 38 96" fill="none" stroke="#6a5640" strokeOpacity="0.18" strokeWidth="0.7" />
          {n === 1 ? (
            <path
              d="M20 100 Q22.5 102 24.5 100 M26 100.4 Q28 102.4 30 100.4 M31.5 100 Q33.5 102 36 100"
              fill="none"
              stroke="#6a5640"
              strokeOpacity="0.16"
              strokeWidth="0.55"
            />
          ) : null}
        </>
      ) : null}
      {!gone && kind === "canine" ? (
        <path d="M28 104 L25.6 90 L30.4 90 Z" fill="#6a5640" opacity="0.1" />
      ) : null}
      {!gone && (kind === "incisor" || kind === "canine") ? (
        <path d={incisalPath(kind)} fill="#c5d4e4" opacity="0.22" />
      ) : null}
    </g>
  );
}

function crownPath(kind: Kind, n: number, primary = false) {
  if (kind === "molar") {
    if (primary) {
      if (n === 4) {
        return "M11 46 C6.4 52 7.2 66 11.4 80 C14.2 92 19.4 100 24.6 103 C27.6 105.2 28.4 102 28.8 99 C29.4 102.4 32 105.4 35.4 103 C40.8 99 45.4 90 47.6 78 C51 64 50.4 52 45.6 46 C38.4 42.4 18 42.4 11 46 Z";
      }
      return "M9.2 46 C4.6 52 5.4 66 9.2 82 C12.2 94 17.8 102 23.6 105 C27 107.2 28.2 104 28.8 100.6 C29.6 104.2 32.4 107.4 36.2 105 C42 101 47.2 93 49.6 82 C53.2 66 53.6 52 48.6 46 C40.6 42 16.8 42 9.2 46 Z";
    }
    if (n === 8) {
      return "M14 46 C10 52 10.4 68 13.2 80 C15.2 90 19 98 24 102 C26.6 104.4 28.6 102 29.2 99 C30 102 32.4 104.6 35 102 C39.6 97 43 88 44.6 78 C47 66 46.6 52 42.4 46 C36 43.4 20 43.4 14 46 Z";
    }
    return "M10 46 C6.2 52 6.4 68 9.4 82 C11.4 92 16 100 21.4 104 C24.8 107 27.6 104.2 28.4 101 C29.2 104.2 32 107 35.4 104 C40.8 100 45.4 92 47.2 82 C50.2 68 50.4 52 46.4 46 C39 43 17.4 43 10 46 Z";
  }
  if (kind === "premolar") {
    return "M14.4 46 C10.8 52 11 68 15.2 84 C17.8 94 22.4 101 28 104 C33.6 101 38.2 94 40.8 84 C45 68 45.2 52 41.6 46 C35 43.4 21 43.4 14.4 46 Z";
  }
  if (kind === "canine") {
    if (primary) {
      return "M17.6 46 C14.2 54 15.4 70 22.6 90 C25 98 26.6 104 28 105.6 C29.4 104 31 98 33.4 90 C40.6 70 41.8 54 38.4 46 C33 43.6 23 43.6 17.6 46 Z";
    }
    return "M17.2 46 C13.6 54 14.8 72 22.2 92 C24.8 100 26.4 106 28 108 C29.6 106 31.2 100 33.8 92 C41.2 72 42.4 54 38.8 46 C33 43.4 23 43.4 17.2 46 Z";
  }
  if (n === 2) {
    return "M18.2 46 C14.8 52 15 70 18.4 86 C20.8 96 24.6 102.5 28 104.2 C31.4 102.5 35.2 96 37.6 86 C41 70 41.2 52 37.8 46 C32.6 43.6 23.4 43.6 18.2 46 Z";
  }
  return "M15.2 46 C11.4 52 11.6 70 15.6 88 C18.6 98 23.4 104.5 28 106.2 C32.6 104.5 37.4 98 40.4 88 C44.4 70 44.6 52 40.8 46 C34 43.2 22 43.2 15.2 46 Z";
}

function dentinPath(kind: Kind) {
  if (kind === "molar") return "M18 52 C15.5 64 17 80 21 92 C24.5 100 32.5 100 36 92 C40 80 41.5 64 39 52 C32 50 24 50 18 52 Z";
  if (kind === "canine") return "M22 52 C20 66 22 86 28 100 C34 86 36 66 34 52 C31 50 25 50 22 52 Z";
  return "M21 52 C18.5 66 20 84 24 96 C28 101 32 96 35 84 C36.5 66 35 52 32 52 C28 50 24 50 21 52 Z";
}

function highlightPath(kind: Kind) {
  if (kind === "molar") return "M16 52 C18 48.5 26 47.5 28 52 C22 64 18.5 76 17.4 84 C15.8 72 15.2 60 16 52 Z";
  if (kind === "canine") return "M21.2 52 C23 48.5 27.4 47.8 29.2 52 C26 68 23.8 84 23 94 C21 76 20.4 60 21.2 52 Z";
  return "M20 51 C22 48 27.5 47.4 29.4 52 C25.6 66 23 80 22.2 88 C20.4 72 19.6 58 20 51 Z";
}

function cervixPath(kind: Kind) {
  if (kind === "molar") return "M11 46 C18 50 38 50 45 46 C42 50 14 50 11 46 Z";
  if (kind === "canine") return "M18 46 C24 50 32 50 38 46 C34 50 22 50 18 46 Z";
  return "M16 46 C22 50 34 50 40 46 C36 50 20 50 16 46 Z";
}

function pulpPath(kind: Kind) {
  if (kind === "molar") {
    return "M22 54 C20 62 21 76 24 86 C26 92 31 92 33 86 C36 76 37 62 35 54 C32 51 25 51 22 54 Z";
  }
  if (kind === "canine") {
    return "M25.2 54 C23.4 66 24.2 86 27.2 100 C27.8 102 28.4 102 29 100 C32 86 32.8 66 31 54 C29.6 51.5 26.6 51.5 25.2 54 Z";
  }
  return "M24.2 54 C22.4 66 23.2 84 26 94 C26.8 98 28.4 98 29.2 94 C32 84 32.8 66 31 54 C29.4 51.5 25.8 51.5 24.2 54 Z";
}

function incisalPath(kind: Kind) {
  if (kind === "canine") {
    return "M22 92 C24 100 26 106 28 108 C30 106 32 100 34 92 C31 96 25 96 22 92 Z";
  }
  return "M18 94 C22 102 24 105 28 106 C32 105 34 102 38 94 C34 99 22 99 18 94 Z";
}
