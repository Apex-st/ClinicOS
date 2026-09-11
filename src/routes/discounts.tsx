import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PatientPicker } from "@/components/patient-picker";
import { ConfirmDialog } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NumericInput } from "@/components/ui/numeric-input";
import { describeDiscount } from "@/lib/discounts";
import { DISCOUNT_CATEGORY_LABEL } from "@/lib/format";
import { useClinic } from "@/lib/store";
import type { DiscountCategory, DiscountKind, DiscountType } from "@/lib/types";

export const Route = createFileRoute("/discounts")({ component: DiscountsPage });

const CATS = Object.keys(DISCOUNT_CATEGORY_LABEL) as DiscountCategory[];

function DiscountsPage() {
  const discounts = useClinic((s) => s.discounts);
  const patients = useClinic((s) => s.patients);
  const addDiscount = useClinic((s) => s.addDiscount);
  const updateDiscount = useClinic((s) => s.updateDiscount);
  const deleteDiscount = useClinic((s) => s.deleteDiscount);
  const updatePatient = useClinic((s) => s.updatePatient);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<DiscountCategory>("other");
  const [kind, setKind] = useState<DiscountKind>("percent");
  const [value, setValue] = useState(10);
  const [askId, setAskId] = useState<string | null>(null);
  const [assignId, setAssignId] = useState("");
  const [assignPatient, setAssignPatient] = useState("");

  function create() {
    if (!name.trim()) {
      toast.error("Укажите название");
      return;
    }
    addDiscount({ name: name.trim(), category, kind, value: Math.max(0, value), active: true });
    toast.success("Тип скидки добавлен");
    setName("");
  }

  return (
    <div className="flex flex-col gap-5">
      <header>
        <p className="text-[13px] text-muted">Касса</p>
        <h1 className="font-display text-3xl">Скидки</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Типы скидок для пациента и плана. Если выбрать второй тип — предыдущий заменяется, суммы сами не складываются.
        </p>
      </header>

      <section className="rounded-xl bg-surface p-5 shadow-[var(--shadow-card)]">
        <h2 className="font-display text-lg">Новый тип</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="Название" className="lg:col-span-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Например: Акция весна" />
          </Field>
          <Field label="Категория">
            <Select value={category} onChange={(e) => setCategory(e.target.value as DiscountCategory)}>
              {CATS.map((c) => (
                <option key={c} value={c}>
                  {DISCOUNT_CATEGORY_LABEL[c]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Тип">
            <Select value={kind} onChange={(e) => setKind(e.target.value as DiscountKind)}>
              <option value="percent">Процент</option>
              <option value="fixed">Фиксированная сумма</option>
            </Select>
          </Field>
          <Field label={kind === "percent" ? "Процент" : "Сумма, ₽"}>
            <NumericInput min={0} value={value} onValue={setValue} />
          </Field>
        </div>
        <Button className="mt-4" onClick={create}>
          <Plus className="size-4" />
          Создать
        </Button>
      </section>

      <section className="rounded-xl bg-surface p-5 shadow-[var(--shadow-card)]">
        <h2 className="font-display text-lg">Назначить пациенту</h2>
        <p className="mt-1 text-sm text-muted">Одна скидка на карточку. Чтобы сменить — выберите другую, старая снимется.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <PatientPicker patients={patients} value={assignPatient} onChange={setAssignPatient} />
          <Select value={assignId} onChange={(e) => setAssignId(e.target.value)}>
            <option value="">Без скидки</option>
            {discounts
              .filter((d) => d.active)
              .map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} · {describeDiscount(d)}
                </option>
              ))}
          </Select>
          <Button
            variant="secondary"
            onClick={() => {
              if (!assignPatient) return;
              updatePatient(assignPatient, { discountTypeId: assignId });
              toast.success("Скидка назначена");
            }}
          >
            Применить
          </Button>
        </div>
      </section>

      <ul className="flex flex-col gap-2">
        {discounts.map((d) => (
          <DiscountRow
            key={d.id}
            d={d}
            used={patients.filter((p) => p.discountTypeId === d.id).length}
            onToggle={() => updateDiscount(d.id, { active: !d.active })}
            onDelete={() => setAskId(d.id)}
            onChange={(patch) => updateDiscount(d.id, patch)}
          />
        ))}
      </ul>

      <ConfirmDialog
        open={Boolean(askId)}
        onOpenChange={(o) => !o && setAskId(null)}
        title="Удалить тип скидки?"
        description="С карточек пациентов этот тип будет снят."
        onConfirm={() => {
          if (askId) deleteDiscount(askId);
          setAskId(null);
        }}
      />
    </div>
  );
}

function DiscountRow({
  d,
  used,
  onToggle,
  onDelete,
  onChange,
}: {
  d: DiscountType;
  used: number;
  onToggle: () => void;
  onDelete: () => void;
  onChange: (patch: Partial<DiscountType>) => void;
}) {
  return (
    <li className="grid gap-3 rounded-xl bg-surface px-4 py-3 shadow-[var(--shadow-card)] sm:grid-cols-[1fr_auto_auto_auto]">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <Input className="h-9 max-w-xs" value={d.name} onChange={(e) => onChange({ name: e.target.value })} />
          <Badge tone={d.active ? "ok" : "muted"}>{d.active ? "активна" : "выкл"}</Badge>
          <span className="text-[12px] text-muted">{DISCOUNT_CATEGORY_LABEL[d.category]}</span>
        </div>
        {used ? (
          <p className="mt-1 text-[12px] text-muted">
            Назначена {used} пац.{" "}
            <Link to="/patients" className="text-primary">
              Картотека
            </Link>
          </p>
        ) : null}
      </div>
      <Select
        className="h-9"
        value={d.kind}
        onChange={(e) => onChange({ kind: e.target.value as DiscountKind })}
      >
        <option value="percent">%</option>
        <option value="fixed">₽</option>
      </Select>
      <NumericInput
        className="h-9 w-24"
        min={0}
        value={d.value}
        onValue={(n) => onChange({ value: n })}
      />
      <div className="flex gap-1">
        <Button size="sm" variant="secondary" onClick={onToggle}>
          {d.active ? "Выключить" : "Включить"}
        </Button>
        <button type="button" className="grid size-9 place-items-center rounded-md text-muted hover:text-danger" onClick={onDelete}>
          <Trash2 className="size-4" />
        </button>
      </div>
    </li>
  );
}
