import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { PlanActions, PlanEditor } from "@/components/plan-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { planTotals } from "@/lib/discounts";
import { formatDate, fullName, money } from "@/lib/format";
import { useClinic } from "@/lib/store";

export const Route = createFileRoute("/plans")({ component: PlansPage });

function PlansPage() {
  const plans = useClinic((s) => s.plans);
  const patients = useClinic((s) => s.patients);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [patientId, setPatientId] = useState(patients[0]?.id ?? "");

  const list = useMemo(() => {
    const query = q.trim().toLowerCase();
    return plans
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date))
      .filter((pl) => {
        if (!query) return true;
        const p = patients.find((x) => x.id === pl.patientId);
        return `${pl.title} ${p ? fullName(p) : ""}`.toLowerCase().includes(query);
      });
  }, [plans, patients, q]);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[13px] text-muted">Документы</p>
          <h1 className="font-display text-3xl">Планы лечения</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            className="h-11 rounded-md bg-surface px-3 text-sm shadow-[var(--shadow-card)]"
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
          >
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {fullName(p)}
              </option>
            ))}
          </select>
          <Button onClick={() => setOpen(true)} disabled={!patientId}>
            <Plus className="size-4" />
            Новый план
          </Button>
        </div>
      </header>
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск по пациенту или названию" />
      {list.length === 0 ? (
        <p className="text-sm text-muted">Планов нет</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {list.map((pl) => {
            const p = patients.find((x) => x.id === pl.patientId);
            const t = planTotals(pl.items, pl.discount);
            return (
              <li key={pl.id} className="rounded-xl bg-surface px-4 py-4 shadow-[var(--shadow-card)]">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{pl.title}</p>
                    <p className="text-sm text-muted">
                      {p ? (
                        <Link to="/patients/$id" params={{ id: p.id }} className="hover:text-primary">
                          {fullName(p)}
                        </Link>
                      ) : (
                        "Пациент"
                      )}
                      {" · "}
                      {formatDate(pl.date)} · {money(t.total)}
                    </p>
                  </div>
                </div>
                <div className="mt-3">
                  <PlanActions plan={pl} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {patientId ? <PlanEditor open={open} onOpenChange={setOpen} patientId={patientId} /> : null}
    </div>
  );
}
