import { createFileRoute, Link } from "@tanstack/react-router";
import { ListFilter, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertMark } from "@/components/medical-alert";
import { MovableFab } from "@/components/movable-fab";
import { PatientDialog } from "@/components/patient-dialog";
import { ConfirmDialog } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { patientBalance } from "@/lib/clinic";
import { ageYears, formatDate, fullName, initials, money, pluralYears } from "@/lib/format";
import { VISIT_KIND_LABEL } from "@/lib/diary";
import { SOURCE_KIND_LABEL, SOURCE_KIND_ORDER } from "@/lib/patient-meta";
import { useLongPress } from "@/lib/long-press";
import { useClinic } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { Patient, PatientSourceKind, Visit } from "@/lib/types";

export const Route = createFileRoute("/patients/")({ component: PatientsPage });

type SortKey = "fio" | "created" | "last" | "first" | "count" | "birth" | "card";

const SORT_LABEL: Record<SortKey, string> = {
  fio: "По ФИО",
  created: "По дате создания",
  last: "По последнему посещению",
  first: "По первому посещению",
  count: "По числу визитов",
  birth: "По дате рождения",
  card: "По номеру карты",
};

const SORT_STORE = "denta-patients-sort-v1";

function loadSort(): { sort: SortKey; dir: "asc" | "desc" } {
  try {
    const raw = localStorage.getItem(SORT_STORE);
    if (!raw) return { sort: "fio", dir: "asc" };
    const j = JSON.parse(raw) as { sort?: SortKey; dir?: "asc" | "desc" };
    return { sort: j.sort && j.sort in SORT_LABEL ? j.sort : "fio", dir: j.dir === "desc" ? "desc" : "asc" };
  } catch {
    return { sort: "fio", dir: "asc" };
  }
}

function visitMeta(visits: { patientId: string; date: string }[], id: string) {
  const list = visits.filter((v) => v.patientId === id).sort((a, b) => a.date.localeCompare(b.date));
  return { count: list.length, first: list[0]?.date ?? "", last: list[list.length - 1]?.date ?? "" };
}

function PatientsPage() {
  const patients = useClinic((s) => s.patients);
  const visits = useClinic((s) => s.visits);
  const tags = useClinic((s) => s.tags);
  const deletePatients = useClinic((s) => s.deletePatients);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [confirm, setConfirm] = useState(false);
  const saved = loadSort();
  const [sort, setSort] = useState<SortKey>(saved.sort);
  const [dir, setDir] = useState<"asc" | "desc">(saved.dir);
  const [tagId, setTagId] = useState("");
  const [source, setSource] = useState<PatientSourceKind | "">("");
  const [lastVisit, setLastVisit] = useState<"any" | "30" | "90" | "180" | "365" | "never">("any");
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(SORT_STORE, JSON.stringify({ sort, dir }));
    } catch {
      /* ignore */
    }
  }, [sort, dir]);

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    const today = new Date();
    const cutoff = (days: number) => {
      const d = new Date(today);
      d.setDate(d.getDate() - days);
      return d.toISOString().slice(0, 10);
    };
    const list = patients.filter((p) => {
      if (n) {
        const blob = `${fullName(p)} ${p.phone} ${p.cardNumber} ${p.email}`.toLowerCase();
        if (!blob.includes(n)) return false;
      }
      if (tagId && !(p.tagIds ?? []).includes(tagId)) return false;
      if (source) {
        const sk = p.sourceKind || (p.referredById ? "patient" : "none");
        if (sk !== source) return false;
      }
      if (lastVisit !== "any") {
        const meta = visitMeta(visits, p.id);
        if (lastVisit === "never") return !meta.last;
        if (!meta.last) return false;
        if (meta.last < cutoff(Number(lastVisit))) return false;
      }
      return true;
    });
    list.sort((a, b) => {
      const ma = visitMeta(visits, a.id);
      const mb = visitMeta(visits, b.id);
      let cmp = 0;
      if (sort === "fio") cmp = fullName(a).localeCompare(fullName(b), "ru");
      else if (sort === "created") cmp = (a.createdAt || "").localeCompare(b.createdAt || "");
      else if (sort === "last") cmp = (ma.last || "").localeCompare(mb.last || "");
      else if (sort === "first") cmp = (ma.first || "").localeCompare(mb.first || "");
      else if (sort === "count") cmp = ma.count - mb.count;
      else if (sort === "birth") cmp = (a.birthDate || "").localeCompare(b.birthDate || "");
      else cmp = (a.cardNumber || "").localeCompare(b.cardNumber || "", "ru", { numeric: true });
      return dir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [patients, visits, q, sort, dir, tagId, source, lastVisit]);

  const pickedSet = useMemo(() => new Set(picked), [picked]);

  function toggle(id: string) {
    setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  function toggleAll() {
    if (picked.length === filtered.length) setPicked([]);
    else setPicked(filtered.map((p) => p.id));
  }

  function stopSelect() {
    setSelecting(false);
    setPicked([]);
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="font-display text-3xl">Пациенты</h1>
        {selecting ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" type="button" onClick={toggleAll}>
              {picked.length === filtered.length ? "Снять все" : "Выбрать все"}
            </Button>
            <Button
              variant="danger"
              type="button"
              disabled={picked.length === 0}
              onClick={() => setConfirm(true)}
            >
              <Trash2 className="size-4" />
              Удалить ({picked.length})
            </Button>
            <Button variant="ghost" type="button" onClick={stopSelect}>
              Готово
            </Button>
          </div>
        ) : null}
      </header>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />
          <Input
            className="pl-10"
            placeholder="ФИО, телефон или номер карты"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="relative">
          <Button type="button" variant="secondary" size="icon" onClick={() => setMenu((v) => !v)} aria-label="Сортировка и фильтры">
            <ListFilter className="size-4" />
          </Button>
          {menu ? (
            <div className="absolute top-12 right-0 z-20 w-[min(100vw-2rem,320px)] rounded-xl bg-surface p-3 shadow-[var(--shadow-lift)]">
              <p className="text-[12px] font-medium text-muted">Сортировка</p>
              <ul className="mt-1 flex flex-col gap-0.5">
                {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
                  <li key={k}>
                    <button
                      type="button"
                      className={`w-full rounded-md px-2 py-1.5 text-left text-sm ${sort === k ? "bg-primary text-primary-fg" : "hover:bg-surface-2"}`}
                      onClick={() => setSort(k)}
                    >
                      {SORT_LABEL[k]}
                    </button>
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex gap-1">
                <button
                  type="button"
                  className={`flex-1 rounded-md px-2 py-1.5 text-sm ${dir === "asc" ? "bg-primary text-primary-fg" : "bg-surface-2"}`}
                  onClick={() => setDir("asc")}
                >
                  По возрастанию
                </button>
                <button
                  type="button"
                  className={`flex-1 rounded-md px-2 py-1.5 text-sm ${dir === "desc" ? "bg-primary text-primary-fg" : "bg-surface-2"}`}
                  onClick={() => setDir("desc")}
                >
                  По убыванию
                </button>
              </div>
              <p className="mt-3 text-[12px] font-medium text-muted">Фильтры</p>
              {tags.length ? (
                <Select value={tagId} onChange={(e) => setTagId(e.target.value)} className="mt-1">
                  <option value="">Все группы</option>
                  {tags.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </Select>
              ) : null}
              <Select value={source} onChange={(e) => setSource(e.target.value as PatientSourceKind | "")} className="mt-1">
                <option value="">Любой источник</option>
                {SOURCE_KIND_ORDER.map((k) => (
                  <option key={k} value={k}>
                    {SOURCE_KIND_LABEL[k]}
                  </option>
                ))}
              </Select>
              <Select value={lastVisit} onChange={(e) => setLastVisit(e.target.value as typeof lastVisit)} className="mt-1">
                <option value="any">Любой визит</option>
                <option value="30">Был за 30 дней</option>
                <option value="90">Был за 90 дней</option>
                <option value="180">Был за 6 месяцев</option>
                <option value="365">Был за год</option>
                <option value="never">Ещё не был</option>
              </Select>
              <Button type="button" size="sm" className="mt-3 w-full" onClick={() => setMenu(false)}>
                Готово
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl bg-surface px-5 py-10 text-center shadow-[var(--shadow-card)]">
          <p className="font-display text-xl">Никого не нашли</p>
          <p className="mt-1 text-sm text-muted">Добавьте пациента или измените запрос.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {filtered.map((p, i) => {
            const age = ageYears(p.birthDate);
            const bal = patientBalance(visits, p.id);
            const last = visits
              .filter((v) => v.patientId === p.id)
              .sort((a, b) => b.date.localeCompare(a.date))[0];
            const on = pickedSet.has(p.id);
            const namedTags = tags.filter((t) => (p.tagIds ?? []).includes(t.id));
            return (
              <PatientRow
                key={p.id}
                patient={p}
                index={i}
                selecting={selecting}
                picked={on}
                namedTags={namedTags.map((t) => t.name)}
                last={last}
                age={age}
                balance={bal}
                onToggle={() => toggle(p.id)}
                onStartSelect={() => {
                  setSelecting(true);
                  setPicked((cur) => (cur.includes(p.id) ? cur : [...cur, p.id]));
                }}
              />
            );
          })}
        </ul>
      )}

      {selecting ? null : (
        <MovableFab label="Новый пациент" onPress={() => setOpen(true)} />
      )}

      <PatientDialog open={open} onOpenChange={setOpen} />
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Удалить ${picked.length} карточек?`}
        description="Пропадут записи, планы, фото и визиты этих пациентов. Это нельзя отменить."
        confirmLabel="Удалить"
        danger
        onConfirm={() => {
          deletePatients(picked);
          toast.success(`Удалено: ${picked.length}`);
          stopSelect();
        }}
      />
    </div>
  );
}

function PatientRow({
  patient,
  index,
  selecting,
  picked,
  namedTags,
  last,
  age,
  balance,
  onToggle,
  onStartSelect,
}: {
  patient: Patient;
  index: number;
  selecting: boolean;
  picked: boolean;
  namedTags: string[];
  last?: Visit;
  age: number | null;
  balance: number;
  onToggle: () => void;
  onStartSelect: () => void;
}) {
  const lp = useLongPress(onStartSelect);
  return (
    <li className="flex items-center gap-2">
      {selecting ? (
        <label className="grid size-11 shrink-0 place-items-center rounded-md bg-surface shadow-[var(--shadow-card)]">
          <input type="checkbox" checked={picked} onChange={onToggle} className="size-4" />
        </label>
      ) : null}
      <Link
        to="/patients/$id"
        params={{ id: patient.id }}
        onPointerDown={lp.onPointerDown}
        onPointerMove={lp.onPointerMove}
        onPointerUp={lp.onPointerUp}
        onPointerCancel={lp.onPointerCancel}
        onContextMenu={lp.onContextMenu}
        onClick={(e) => {
          lp.onClick(e);
          if (e.defaultPrevented) return;
          if (selecting) {
            e.preventDefault();
            onToggle();
          }
        }}
        className="flex min-w-0 flex-1 select-none items-center gap-3 rounded-lg bg-surface px-3 py-3 shadow-[var(--shadow-card)] [-webkit-touch-callout:none] sm:px-4"
      >
        <span
          className={cn(
            "grid size-11 shrink-0 place-items-center rounded-md text-sm font-medium",
            index % 3 === 0 && "bg-primary text-primary-fg",
            index % 3 === 1 && "bg-ink text-primary-fg",
            index % 3 === 2 && "bg-surface-2 text-ink",
          )}
        >
          {initials(patient)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate font-medium">
            <span className="truncate">{fullName(patient)}</span>
            <AlertMark patient={patient} />
          </p>
          <p className="truncate text-[13px] text-muted">
            {patient.cardNumber ? `${patient.cardNumber} · ` : ""}
            {age != null ? pluralYears(age) : "возраст не указан"}
            {last?.kind ? ` · ${VISIT_KIND_LABEL[last.kind]}` : ""}
            {namedTags.length ? ` · ${namedTags.join(", ")}` : ""}
          </p>
        </div>
        <div className="hidden text-right sm:block">
          {balance > 0 ? (
            <p className="text-sm tabular-nums text-danger">{money(balance)}</p>
          ) : last ? (
            <p className="text-[13px] text-muted">был {formatDate(last.date, "d MMM")}</p>
          ) : (
            <p className="text-[13px] text-subtle">нет приёмов</p>
          )}
          {patient.phone ? <p className="text-[12px] text-subtle">{patient.phone}</p> : null}
        </div>
      </Link>
    </li>
  );
}
