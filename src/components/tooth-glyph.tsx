import { isUpper, toothKind, toothSurfaceStatus, TOOTH_STATUS_LABEL, statusUsesSurfaces } from "@/lib/teeth";
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

function paint(status: ToothStatus) {
  return `var(--color-tooth-${status})`;
}

function surfacePaint(state: ToothState, surface?: ToothSurface) {
  const st = surface ? toothSurfaceStatus(state, surface) : state.status;
  return paint(st);
}

const SIZE = {
  sm: { molar: 22, premolar: 18, canine: 16, incisor: 15, h: 50 },
  md: { molar: 24, premolar: 19, canine: 17, incisor: 16, h: 56 },
  lg: { molar: 76, premolar: 64, canine: 58, incisor: 54, h: 156 },
} as const;

/** Лицевой вид: корень кверху, коронка книзу. Нижние зубы зеркалим. */
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
  const upper = isUpper(fdi);
  const kind = toothKind(fdi);
  const n = fdi % 10;
  const q = Math.floor(fdi / 10);
  const rightSide = q === 1 || q === 4;
  const gone = state.status === "missing" || state.status === "extracted";
  const uid = `t${fdi}-${size}`;
  const dim = SIZE[size];
  const w = dim[kind] * (n === 1 && kind === "incisor" ? 1.1 : n === 8 ? 0.9 : 1);

  return (
    <svg
      viewBox="0 0 44 88"
      width={w}
      height={dim.h}
      className={cn("overflow-visible", picked && "drop-shadow-[0_0_0_2px_var(--color-primary)]")}
      aria-hidden
    >
      <title>{`${fdi} · ${TOOTH_STATUS_LABEL[state.status]}`}</title>
      <defs>
        <linearGradient id={`${uid}-en`} x1="10" y1="34" x2="34" y2="82" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={surfacePaint(state)} />
          <stop offset="42%" stopColor={surfacePaint(state)} />
          <stop offset="100%" stopColor="var(--color-ink)" stopOpacity="0.16" />
        </linearGradient>
        <linearGradient id={`${uid}-rt`} x1="22" y1="2" x2="22" y2="36" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="var(--color-tooth-root)" stopOpacity="0.72" />
          <stop offset="100%" stopColor="var(--color-tooth-root)" />
        </linearGradient>
        <radialGradient id={`${uid}-pulp`} cx="50%" cy="58%" r="42%">
          <stop offset="0%" stopColor="var(--color-tooth-pulpitis)" />
          <stop offset="70%" stopColor="var(--color-tooth-pulpitis)" stopOpacity="0.85" />
          <stop offset="100%" stopColor="var(--color-tooth-pulpitis)" stopOpacity="0.2" />
        </radialGradient>
        <radialGradient id={`${uid}-gran`} cx="40%" cy="40%" r="70%">
          <stop offset="0%" stopColor="var(--color-tooth-periodontitis)" stopOpacity="0.95" />
          <stop offset="100%" stopColor="var(--color-ink)" stopOpacity="0.45" />
        </radialGradient>
        <clipPath id={`${uid}-c`}>
          <path d={crownPath(kind, n)} />
        </clipPath>
      </defs>
      <g transform={upper ? undefined : "translate(0 88) scale(1 -1)"}>
        {state.status === "periodontitis" && !gone ? <Granulomas kind={kind} uid={uid} /> : null}
        {state.status === "implant" ? <Implant uid={uid} /> : <Roots kind={kind} gone={gone} fill={`url(#${uid}-rt)`} />}
        {state.status === "root" ? (
          <path
            d="M14 34 C13 40 14 46 22 48 C30 46 31 40 30 34"
            fill="none"
            stroke="var(--color-tooth-root)"
            strokeWidth="1.3"
          />
        ) : (
          <Crown uid={uid} kind={kind} n={n} state={state} rightSide={rightSide} gone={gone} />
        )}
      </g>
    </svg>
  );
}

function Roots({
  kind,
  gone,
  fill,
}: {
  kind: ReturnType<typeof toothKind>;
  gone: boolean;
  fill: string;
}) {
  const stroke = gone ? "var(--color-subtle)" : "var(--color-ink)";
  const sw = 0.8;
  const op = gone ? 0.32 : 1;
  if (kind === "molar") {
    return (
      <g fill={gone ? "none" : fill} stroke={stroke} strokeWidth={sw} opacity={op} strokeLinejoin="round">
        <path d="M9.2 35 C7 22 6.6 12 10.2 5.2 C12.2 1.4 16 1.8 17.2 8.2 L18.2 35 Z" />
        <path d="M18 35 L19.2 6.5 C20.2 2 24.4 2 25.4 6.8 L26.6 35 Z" />
        <path d="M25.6 35 L27 10 C28.6 3.4 33.4 3.6 34.4 10 C35.2 18 34 27 32.8 35 Z" />
      </g>
    );
  }
  if (kind === "premolar") {
    return (
      <g fill={gone ? "none" : fill} stroke={stroke} strokeWidth={sw} opacity={op} strokeLinejoin="round">
        <path d="M14.2 35 C12.4 20 12 10 16.4 4.2 C18.6 1.4 22.2 2.2 23.2 8.4 L24 35 Z" />
        <path d="M23.2 35 L25.2 12 C26.4 5.6 30.8 5.6 31.6 12 L30.2 35 Z" />
      </g>
    );
  }
  if (kind === "canine") {
    return (
      <path
        d="M17.2 35 C15.6 20 14.6 8.5 18.4 2 C20.8 -0.6 25.2 0.6 26.4 8 C27.4 16.5 26 26 24.6 35 Z"
        fill={gone ? "none" : fill}
        stroke={stroke}
        strokeWidth={sw}
        opacity={op}
        strokeLinejoin="round"
      />
    );
  }
  return (
    <path
      d="M16.6 35 C15.4 20 15.6 9 19 3.4 C21.4 0.6 25.6 1 27 6 C28.2 13 27 24 25.6 35 Z"
      fill={gone ? "none" : fill}
      stroke={stroke}
      strokeWidth={sw}
      opacity={op}
      strokeLinejoin="round"
    />
  );
}

function Granulomas({ kind, uid }: { kind: ReturnType<typeof toothKind>; uid: string }) {
  const fill = `url(#${uid}-gran)`;
  const stroke = "var(--color-tooth-periodontitis)";
  if (kind === "molar") {
    return (
      <g fill={fill} stroke={stroke} strokeWidth="0.6" opacity="0.95">
        <ellipse cx="13.4" cy="5.2" rx="4.2" ry="3.8" />
        <ellipse cx="22.2" cy="3.4" rx="3.8" ry="3.4" />
        <ellipse cx="31.2" cy="6.2" rx="4" ry="3.6" />
      </g>
    );
  }
  if (kind === "premolar") {
    return (
      <g fill={fill} stroke={stroke} strokeWidth="0.6">
        <ellipse cx="19.2" cy="4.4" rx="4.1" ry="3.7" />
        <ellipse cx="28.4" cy="7.2" rx="3.6" ry="3.2" />
      </g>
    );
  }
  return <ellipse cx="22" cy="3.6" rx="4.6" ry="4.1" fill={fill} stroke={stroke} strokeWidth="0.65" />;
}

function Implant({ uid }: { uid: string }) {
  return (
    <g>
      <defs>
        <clipPath id={`${uid}-imp`}>
          <path d="M17.4 35 L18.6 8 C19.4 3.6 23.8 3.6 24.6 8 L25.8 35 Z" />
        </clipPath>
      </defs>
      <path
        d="M17.4 35 L18.6 8 C19.4 3.6 23.8 3.6 24.6 8 L25.8 35 Z"
        fill="var(--color-tooth-implant)"
        stroke="var(--color-ink)"
        strokeOpacity="0.35"
        strokeWidth="0.8"
      />
      <g clipPath={`url(#${uid}-imp)`} stroke="var(--color-ink)" strokeOpacity="0.45" strokeWidth="1.2">
        <path d="M16 12 H28 M16 16 H28 M16 20 H28 M16 24 H28 M16 28 H28 M16 32 H28" />
      </g>
      <path d="M18.6 35 H25.4 L26.2 38.5 H17.8 Z" fill="var(--color-tooth-implant)" />
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
}: {
  uid: string;
  kind: ReturnType<typeof toothKind>;
  n: number;
  state: ToothState;
  rightSide: boolean;
  gone: boolean;
}) {
  const d = crownPath(kind, n);
  const split = Boolean(statusUsesSurfaces(state.status) && state.surfaces && Object.keys(state.surfaces).length);
  const extracted = state.status === "extracted";
  const veneer = state.status === "veneer";
  const bridge = state.status === "bridge";
  const pulpitis = state.status === "pulpitis";
  const filling = state.status === "filling";
  const caries = state.status === "caries";
  const mesialLeft = !rightSide;
  const fill = gone ? "none" : split ? "var(--color-tooth-healthy)" : `url(#${uid}-en)`;

  return (
    <g>
      <path
        d={d}
        fill={fill}
        stroke={gone ? "var(--color-subtle)" : "var(--color-ink)"}
        strokeOpacity={gone ? 0.5 : 0.42}
        strokeWidth="1.2"
        strokeLinejoin="round"
        strokeDasharray={gone ? "2.4 1.8" : undefined}
      />
      {split && !gone ? (
        <g clipPath={`url(#${uid}-c)`}>
          <rect x="6" y="36" width="32" height="32" fill={surfacePaint(state, "B")} />
          <path d="M6 64 H38 V84 H6 Z" fill={surfacePaint(state, "O")} />
          <path d="M8 32 H36 V40 H8 Z" fill={surfacePaint(state, "L")} />
          <rect x={mesialLeft ? 2 : 26} y="34" width="16" height="44" fill={surfacePaint(state, "M")} />
          <rect x={mesialLeft ? 26 : 2} y="34" width="16" height="44" fill={surfacePaint(state, "D")} />
          <path d={d} fill="none" stroke="var(--color-ink)" strokeOpacity="0.28" strokeWidth="1" />
        </g>
      ) : null}
      {!gone && !split ? (
        <>
          <path d={dentinPath(kind)} fill="var(--color-ink)" opacity="0.06" />
          <path d={highlightPath(kind)} fill="var(--color-surface)" opacity="0.42" />
        </>
      ) : null}
      {pulpitis && !gone ? (
        <g clipPath={`url(#${uid}-c)`}>
          <path d={pulpPath(kind)} fill={`url(#${uid}-pulp)`} />
          <path d={pulpPath(kind)} fill="none" stroke="var(--color-tooth-pulpitis)" strokeWidth="0.7" opacity="0.8" />
        </g>
      ) : null}
      {filling && !gone && !split ? (
        <g clipPath={`url(#${uid}-c)`}>
          <path
            d={kind === "molar" ? "M16 58 C18 54 26 54 28 58 C30 64 28 72 22 74 C16 72 14 64 16 58 Z" : "M18 56 C20 52 26 52 28 57 C29 64 26 72 22 73 C18 72 16 64 18 56 Z"}
            fill="var(--color-tooth-filling)"
            stroke="var(--color-ink)"
            strokeOpacity="0.25"
            strokeWidth="0.6"
          />
        </g>
      ) : null}
      {caries && !gone && !split ? (
        <g clipPath={`url(#${uid}-c)`}>
          <ellipse cx="26" cy="62" rx="3.6" ry="4.4" fill="var(--color-ink)" opacity="0.55" />
          <ellipse cx="25.2" cy="61" rx="1.4" ry="1.6" fill="var(--color-tooth-caries)" opacity="0.7" />
        </g>
      ) : null}
      {veneer && !gone ? (
        <path
          d={d}
          fill="var(--color-tooth-veneer)"
          opacity="0.9"
          stroke="var(--color-ink)"
          strokeOpacity="0.18"
          strokeWidth="0.55"
          transform="translate(0 1.6) scale(0.9 0.9)"
          style={{ transformOrigin: "22px 56px" }}
        />
      ) : null}
      {bridge && !gone ? (
        <>
          <path d="M1 50 H11" stroke="var(--color-tooth-bridge)" strokeWidth="3.4" strokeLinecap="round" />
          <path d="M33 50 H43" stroke="var(--color-tooth-bridge)" strokeWidth="3.4" strokeLinecap="round" />
        </>
      ) : null}
      {extracted ? (
        <path
          d="M13 40 L31 72 M31 40 L13 72"
          fill="none"
          stroke="var(--color-danger)"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      ) : null}
      {!gone && kind === "molar" ? (
        <>
          <path d="M13 68 Q17 63.5 22 68 Q27 63.5 31 68" fill="none" stroke="var(--color-ink)" strokeOpacity="0.22" strokeWidth="0.85" />
          <path d="M16 58 Q22 55 28 58" fill="none" stroke="var(--color-ink)" strokeOpacity="0.12" strokeWidth="0.6" />
        </>
      ) : null}
      {!gone && kind === "premolar" ? (
        <path d="M16 68 Q22 64 28 68" fill="none" stroke="var(--color-ink)" strokeOpacity="0.2" strokeWidth="0.8" />
      ) : null}
      {!gone && kind === "incisor" ? (
        <path d="M15.5 74 Q18.5 76.4 22 77 Q25.5 76.4 28.5 74" fill="none" stroke="var(--color-ink)" strokeOpacity="0.18" strokeWidth="0.7" />
      ) : null}
      {!gone && kind === "canine" ? (
        <path d="M22 78 L20.5 70 L23.5 70 Z" fill="var(--color-ink)" opacity="0.08" />
      ) : null}
    </g>
  );
}

function crownPath(kind: ReturnType<typeof toothKind>, n: number) {
  if (kind === "molar") {
    return "M8 35 C5 40 5.2 52 7.4 62 C8.8 70 12 76 16 80 C18.8 83.5 21.2 81 22 78.5 C22.8 81 25.2 83.5 28 80 C32 76 35.2 70 36.6 62 C38.8 52 39 40 36 35 C30 32.4 14 32.4 8 35 Z";
  }
  if (kind === "premolar") {
    return "M11.2 35 C8.4 40 8.6 53 12 64 C14.2 71 17.6 77 22 80 C26.4 77 29.8 71 32 64 C35.4 53 35.6 40 32.8 35 C27 32.6 17 32.6 11.2 35 Z";
  }
  if (kind === "canine") {
    return "M14 35 C11.2 42 12.2 56 18.4 72 C20.6 78 21.6 83 22 85 C22.4 83 23.4 78 25.6 72 C31.8 56 32.8 42 30 35 C25 32.6 19 32.6 14 35 Z";
  }
  if (n === 2) {
    return "M14.6 35 C12 40 12.2 54 15 66 C16.8 73 19.8 78.5 22 80 C24.2 78.5 27.2 73 29 66 C31.8 54 32 40 29.4 35 C25 32.8 19 32.8 14.6 35 Z";
  }
  return "M12.6 35 C9.8 40 10 54 13.2 67 C15.6 74.5 19.4 80 22 81.4 C24.6 80 28.4 74.5 30.8 67 C34 54 34.2 40 31.4 35 C26 32.6 18 32.6 12.6 35 Z";
}

function dentinPath(kind: ReturnType<typeof toothKind>) {
  if (kind === "molar") return "M14 40 C12 48 13 60 16 70 C19 76 25 76 28 70 C31 60 32 48 30 40 C24 38 18 38 14 40 Z";
  if (kind === "canine") return "M18 40 C16 50 18 64 22 76 C26 64 28 50 26 40 C24 38 20 38 18 40 Z";
  return "M17 40 C15 50 16 62 19 72 C22 76 25 72 27 62 C28 50 27 40 25 40 C22 38 19 38 17 40 Z";
}

function highlightPath(kind: ReturnType<typeof toothKind>) {
  if (kind === "molar") return "M13 40 C14.5 37.5 20 36.5 22 40 C17.5 48 14.5 56 13.8 62 C12.6 54 12.2 46 13 40 Z";
  if (kind === "canine") return "M17.2 40 C18.4 37.5 21.5 36.5 23 40 C20.4 52 18.8 64 18.2 72 C16.6 58 16.2 46 17.2 40 Z";
  return "M16.4 39 C17.6 37 21.5 36.4 23 40 C20.2 50 18 60 17.4 66 C16 54 15.6 44 16.4 39 Z";
}

function pulpPath(kind: ReturnType<typeof toothKind>) {
  if (kind === "molar") {
    return "M17 42 C15.5 48 16 58 18.5 66 C20 70 24 70 25.5 66 C28 58 28.5 48 27 42 C24.5 39.5 19.5 39.5 17 42 Z";
  }
  if (kind === "canine") {
    return "M20 42 C18.6 50 19.2 64 21.6 74 C22.2 76 22.8 76 23.4 74 C25.8 64 26.2 50 24.8 42 C23.6 40 21.2 40 20 42 Z";
  }
  return "M19.2 42 C17.8 50 18.4 62 20.6 70 C21.4 73 22.6 73 23.4 70 C25.6 62 26.2 50 24.8 42 C23.4 40 20.6 40 19.2 42 Z";
}
