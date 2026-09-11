import { BookUser } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, Select } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { describeDiscount } from "@/lib/discounts";
import { fullName } from "@/lib/format";
import { DEFAULT_SOCIALS, MEDICAL_FLAG_LABEL, MEDICAL_FLAG_ORDER, SOURCE_KIND_LABEL, SOURCE_KIND_ORDER } from "@/lib/patient-meta";
import type { PatientDraft } from "@/lib/store";
import { useClinic } from "@/lib/store";
import { pickPhoneFromDevice } from "@/lib/pick-contact";
import type { Patient, PatientSourceKind } from "@/lib/types";

const empty: PatientDraft = {
  lastName: "",
  firstName: "",
  middleName: "",
  birthDate: "",
  phone: "",
  email: "",
  address: "",
  allergies: "",
  chronic: "",
  notes: "",
  cardNumber: "",
  referredById: "",
  sourceKind: "none",
  sourceSocial: "",
  sourceNote: "",
  tagIds: [],
  medicalFlags: [],
  medicalNote: "",
  discountTypeId: "",
  recallStatus: "none",
};

export function PatientDialog({
  open,
  onOpenChange,
  patient,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient?: Patient | null;
  onCreated?: (id: string) => void;
}) {
  const addPatient = useClinic((s) => s.addPatient);
  const updatePatient = useClinic((s) => s.updatePatient);
  const patients = useClinic((s) => s.patients);
  const discounts = useClinic((s) => s.discounts);
  const tags = useClinic((s) => s.tags);
  const customSocials = useClinic((s) => s.customSocials);
  const customMedical = useClinic((s) => s.customMedical);
  const addCustomSocial = useClinic((s) => s.addCustomSocial);
  const addCustomMedical = useClinic((s) => s.addCustomMedical);
  const addTag = useClinic((s) => s.addTag);
  const [form, setForm] = useState<PatientDraft>(empty);

  useEffect(() => {
    if (!open) return;
    if (patient) {
      const { id: _id, createdAt: _c, ...rest } = patient;
      setForm({ ...empty, ...rest });
    } else {
      setForm(empty);
    }
  }, [open, patient]);

  function set<K extends keyof PatientDraft>(key: K, value: PatientDraft[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function save() {
    if (!form.lastName.trim() || !form.firstName.trim()) {
      toast.error("Укажите фамилию и имя");
      return;
    }
    if (patient) {
      updatePatient(patient.id, form);
      toast.success("Карточка обновлена");
      onOpenChange(false);
      return;
    }
    const id = addPatient(form);
    toast.success("Пациент добавлен");
    onOpenChange(false);
    onCreated?.(id);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{patient ? "Карточка пациента" : "Новый пациент"}</DialogTitle>
          <DialogDescription>Основные данные и медицинские пометки.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Фамилия" className="sm:col-span-1">
            <Input value={form.lastName} onChange={(e) => set("lastName", e.target.value)} />
          </Field>
          <Field label="Имя">
            <Input value={form.firstName} onChange={(e) => set("firstName", e.target.value)} />
          </Field>
          <Field label="Отчество">
            <Input value={form.middleName} onChange={(e) => set("middleName", e.target.value)} />
          </Field>
          <Field label="Дата рождения">
            <Input type="date" value={form.birthDate} onChange={(e) => set("birthDate", e.target.value)} />
          </Field>
          <Field label="Телефон" className="sm:col-span-2">
            <div className="flex gap-2">
              <Input
                className="min-w-0 flex-1"
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="+7 ("
                inputMode="tel"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Из контактов телефона"
                onClick={async () => {
                  const tel = await pickPhoneFromDevice();
                  if (tel) {
                    set("phone", tel);
                    toast.success("Номер из контактов");
                  }
                }}
              >
                <BookUser className="size-4" />
              </Button>
            </div>
          </Field>
          <Field label="Эл. почта" className="sm:col-span-3">
            <Input value={form.email} onChange={(e) => set("email", e.target.value)} />
          </Field>
          <Field label="Адрес" className="sm:col-span-3">
            <Input value={form.address} onChange={(e) => set("address", e.target.value)} />
          </Field>
          <Field label="№ карты">
            <Input
              value={form.cardNumber}
              onChange={(e) => set("cardNumber", e.target.value)}
              placeholder="Назначится сам"
            />
          </Field>
          <Field label="Откуда узнали" className="sm:col-span-2">
            <Select
              value={form.sourceKind ?? "none"}
              onChange={(e) => {
                const sourceKind = e.target.value as PatientSourceKind;
                set("sourceKind", sourceKind);
              }}
            >
              {SOURCE_KIND_ORDER.map((k) => (
                <option key={k} value={k}>
                  {SOURCE_KIND_LABEL[k]}
                </option>
              ))}
            </Select>
          </Field>
          {form.sourceKind === "social" ? (
            <Field label="Социальная сеть" className="sm:col-span-3">
              <div className="flex gap-2">
                <Select
                  value={form.sourceSocial ?? ""}
                  onChange={(e) => set("sourceSocial", e.target.value)}
                >
                  <option value="">Выберите</option>
                  {[...DEFAULT_SOCIALS, ...customSocials].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
                <Input
                  placeholder="Своя"
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    const v = (e.target as HTMLInputElement).value.trim();
                    if (!v) return;
                    addCustomSocial(v);
                    set("sourceSocial", v);
                    (e.target as HTMLInputElement).value = "";
                  }}
                />
              </div>
            </Field>
          ) : null}
          {form.sourceKind === "patient" || form.referredById ? (
            <Field label="Кто рекомендовал" className="sm:col-span-3">
              <Select
                value={form.referredById}
                onChange={(e) => {
                  set("referredById", e.target.value);
                  if (e.target.value) set("sourceKind", "patient");
                }}
              >
                <option value="">Никто</option>
                {patients
                  .filter((p) => p.id !== patient?.id)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {fullName(p)}
                    </option>
                  ))}
              </Select>
            </Field>
          ) : null}
          {form.sourceKind === "other" ? (
            <Field label="Свой вариант" className="sm:col-span-3">
              <Input value={form.sourceNote ?? ""} onChange={(e) => set("sourceNote", e.target.value)} />
            </Field>
          ) : null}
          <Field label="Группы" className="sm:col-span-3">
            <div className="flex flex-wrap gap-1.5">
              {tags.map((t) => {
                const on = (form.tagIds ?? []).includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() =>
                      set(
                        "tagIds",
                        on ? (form.tagIds ?? []).filter((x) => x !== t.id) : [...(form.tagIds ?? []), t.id],
                      )
                    }
                    className={`rounded-full px-3 py-1.5 text-[13px] ${on ? "bg-primary text-primary-fg" : "bg-surface-2"}`}
                  >
                    {t.name}
                  </button>
                );
              })}
              <input
                placeholder="+ группа"
                className="h-8 w-28 rounded-full bg-surface-2 px-3 text-[13px] outline-none"
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  const v = (e.target as HTMLInputElement).value.trim();
                  if (!v) return;
                  const id = addTag(v);
                  set("tagIds", [...(form.tagIds ?? []), id]);
                  (e.target as HTMLInputElement).value = "";
                }}
              />
            </div>
          </Field>
          <Field label="Медицинские предупреждения" className="sm:col-span-3">
            <div className="flex flex-wrap gap-1.5">
              {MEDICAL_FLAG_ORDER.map((f) => {
                const on = (form.medicalFlags ?? []).includes(f);
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() =>
                      set(
                        "medicalFlags",
                        on ? (form.medicalFlags ?? []).filter((x) => x !== f) : [...(form.medicalFlags ?? []), f],
                      )
                    }
                    className={`rounded-full px-3 py-1.5 text-[13px] ${on ? "bg-danger text-primary-fg" : "bg-surface-2"}`}
                  >
                    {MEDICAL_FLAG_LABEL[f]}
                  </button>
                );
              })}
              {customMedical.map((m) => {
                const on = (form.medicalFlags ?? []).includes(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() =>
                      set(
                        "medicalFlags",
                        on ? (form.medicalFlags ?? []).filter((x) => x !== m.id) : [...(form.medicalFlags ?? []), m.id],
                      )
                    }
                    className={`rounded-full px-3 py-1.5 text-[13px] ${on ? "bg-danger text-primary-fg" : "bg-surface-2"}`}
                  >
                    {m.name}
                  </button>
                );
              })}
            </div>
            <Input
              className="mt-2"
              placeholder="+ своё предупреждение, Enter"
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                const v = (e.target as HTMLInputElement).value.trim();
                if (!v) return;
                addCustomMedical(v);
                (e.target as HTMLInputElement).value = "";
              }}
            />
          </Field>
          <Field label="Пояснение к предупреждениям" className="sm:col-span-3">
            <Input value={form.medicalNote ?? ""} onChange={(e) => set("medicalNote", e.target.value)} />
          </Field>
          <Field label="Аллергии" className="sm:col-span-3">
            <Input
              value={form.allergies}
              onChange={(e) => set("allergies", e.target.value)}
              placeholder="Нет"
            />
          </Field>
          <Field label="Хронические заболевания" className="sm:col-span-3">
            <Input value={form.chronic} onChange={(e) => set("chronic", e.target.value)} />
          </Field>
          <Field label="Заметки" className="sm:col-span-3">
            <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={3} />
          </Field>
          <Field label="Скидка на карточке" className="sm:col-span-3">
            <Select value={form.discountTypeId} onChange={(e) => set("discountTypeId", e.target.value)}>
              <option value="">Нет</option>
              {discounts
                .filter((d) => d.active)
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} · {describeDiscount(d)}
                  </option>
                ))}
            </Select>
          </Field>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" type="button" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button type="button" onClick={save}>
            Сохранить
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
