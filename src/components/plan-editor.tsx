import { FileDown, Plus, Printer, Share2, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/alert-dialog";
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
import { NumericInput } from "@/components/ui/numeric-input";
import { Textarea } from "@/components/ui/textarea";
import { SendPatientDialog } from "@/components/send-patient";
import { amountForType, describeDiscount, planTotals } from "@/lib/discounts";
import {
  DISCOUNT_CATEGORY_LABEL,
  ageYears,
  formatDate,
  fullName,
  money,
  shortName,
  todayISO,
} from "@/lib/format";
import { emptyPlanItem, groupPlanItems, patchGroup, planDocumentText } from "@/lib/plan-groups";
import { planDocumentHtml, openPlanPrint } from "@/lib/plan-print";
import { buildPlanPdfBlob } from "@/lib/plan-pdf";
import { SaveFileDialog } from "@/components/save-file-dialog";
import { DiagnosisField } from "@/components/diagnosis-field";
import { Odontogram } from "@/components/odontogram";
import { isNativeApp } from "@/lib/native-file";
import { useClinic } from "@/lib/store";
import type { PlanItem, TreatmentPlan } from "@/lib/types";
import { ALL_FDI, isUpper } from "@/lib/teeth";
import { shareOrDownload } from "@/lib/utils";

export function PlanEditor({
  open,
  onOpenChange,
  patientId,
  plan,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  plan?: TreatmentPlan | null;
}) {
  const patients = useClinic((s) => s.patients);
  const services = useClinic((s) => s.services);
  const discounts = useClinic((s) => s.discounts);
  const doctors = useClinic((s) => s.doctors);
  const settings = useClinic((s) => s.settings);
  const addPlan = useClinic((s) => s.addPlan);
  const updatePlan = useClinic((s) => s.updatePlan);
  const charts = useClinic((s) => s.charts);
  const patient = patients.find((p) => p.id === patientId);

  const [title, setTitle] = useState("План лечения");
  const [date, setDate] = useState(todayISO());
  const [doctorId, setDoctorId] = useState("");
  const [doctorName, setDoctorName] = useState(settings.doctorName);
  const [items, setItems] = useState<PlanItem[]>([emptyPlanItem()]);
  const [discountTypeId, setDiscountTypeId] = useState("");
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState("");
  const [recommendations, setRecommendations] = useState("");

  const activeDoctors = doctors.filter((d) => d.active);

  const activeDisc = discounts.filter((d) => d.active);
  const afterLines = planTotals(items, 0);
  const selectedType = discounts.find((d) => d.id === discountTypeId);
  const computed = amountForType(selectedType, afterLines.total);
  const totals = planTotals(items, discountTypeId ? computed : discount);
  const groups = useMemo(() => groupPlanItems(items), [items]);
  const usedTeeth = new Set(items.map((i) => i.toothFdi).filter((n): n is number => n != null));

  useEffect(() => {
    if (!open) return;
    if (plan) {
      setTitle(plan.title);
      setDate(plan.date);
      const matched = plan.doctorId || matchDoctorId(activeDoctors, plan.doctorName) || "";
      const doc = activeDoctors.find((x) => x.id === matched);
      setDoctorId(matched);
      setDoctorName(doc ? fullName(doc) : plan.doctorName || settings.doctorName);
      setItems(plan.items.length ? plan.items.map((i) => ({ ...i, note: i.note ?? "" })) : [emptyPlanItem()]);
      setDiscountTypeId(plan.discountTypeId);
      setDiscount(plan.discount);
      setNotes(plan.notes);
      setRecommendations(plan.recommendations);
    } else {
      const assigned = patient?.discountTypeId ?? "";
      const first = activeDoctors[0];
      setTitle(`План лечения, ${formatDate(todayISO(), "d MMMM yyyy")}`);
      setDate(todayISO());
      setDoctorId(first?.id ?? "");
      setDoctorName(first ? fullName(first) : settings.doctorName);
      setItems([emptyPlanItem()]);
      setDiscountTypeId(assigned);
      setDiscount(0);
      setNotes("");
      setRecommendations("");
    }
  }, [open, plan, patient?.discountTypeId, settings.doctorName]);

  function chooseDoctor(id: string) {
    setDoctorId(id);
    const d = activeDoctors.find((x) => x.id === id);
    setDoctorName(d ? fullName(d) : settings.doctorName);
  }

  function addTeeth(fdis: number[]) {
    const fresh = fdis.filter((n) => !usedTeeth.has(n));
    if (!fresh.length) {
      toast.message("Эти зубы уже есть в плане");
      return;
    }
    setItems((prev) => [...prev.filter((i) => i.serviceName || i.diagnosis || i.toothFdi), ...fresh.map((n) => emptyPlanItem(n))]);
  }

  function addGeneralService(serviceId: string) {
    const svc = services.find((s) => s.id === serviceId);
    if (!svc) return;
    setItems((prev) => {
      const empty = prev.find((i) => i.toothFdi == null && !i.serviceName.trim());
      const row: PlanItem = {
        ...(empty ?? emptyPlanItem()),
        serviceId: svc.id,
        serviceName: svc.name,
        price: svc.price,
        qty: 1,
        discount: 0,
        toothFdi: undefined,
      };
      if (empty) return prev.map((i) => (i.id === empty.id ? row : i));
      return [...prev, row];
    });
  }

  function addServiceToTooth(toothFdi: number, serviceId: string) {
    const svc = services.find((s) => s.id === serviceId);
    if (!svc) return;
    setItems((prev) => {
      const sibling = prev.find((i) => i.toothFdi === toothFdi);
      const empty = prev.find((i) => i.toothFdi === toothFdi && !i.serviceName.trim());
      const row: PlanItem = {
        ...(empty ?? emptyPlanItem(toothFdi)),
        toothFdi,
        serviceId: svc.id,
        serviceName: svc.name,
        price: svc.price,
        qty: 1,
        discount: 0,
        diagnosis: sibling?.diagnosis ?? "",
        diagnosisId: sibling?.diagnosisId,
        note: sibling?.note ?? "",
      };
      if (empty) return prev.map((i) => (i.id === empty.id ? row : i));
      return [...prev, row];
    });
  }

  function save() {
    const clean = items.filter((i) => i.serviceName.trim() || i.diagnosis.trim() || i.toothFdi);
    if (clean.length === 0) {
      toast.error("Добавьте зуб или услугу");
      return;
    }
    const chosen = activeDoctors.find((d) => d.id === doctorId);
    const draft = {
      patientId,
      title: title.trim() || "План лечения",
      date,
      doctorName: chosen ? fullName(chosen) : doctorName.trim() || settings.doctorName,
      doctorId: doctorId || undefined,
      items: clean,
      discountTypeId,
      discount: totals.planDiscount,
      notes,
      recommendations,
    };
    if (plan) {
      updatePlan(plan.id, draft);
      toast.success("План сохранён");
    } else {
      addPlan(draft);
      toast.success("План создан");
    }
    onOpenChange(false);
  }

  if (!patient) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{plan ? "План лечения" : "Новый план лечения"}</DialogTitle>
          <DialogDescription>
            {fullName(patient)} · несколько зубов, услуги по каждому и общие позиции
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Название" className="sm:col-span-2">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="Дата">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Врач" className="sm:col-span-3">
            <Select value={doctorId} onChange={(e) => chooseDoctor(e.target.value)}>
              <option value="">{doctorName || "Выберите врача"}</option>
              {activeDoctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {fullName(d)}
                  {d.specialty ? ` · ${d.specialty}` : ""}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => addTeeth(ALL_FDI.filter((n) => isUpper(n) && !usedTeeth.has(n)))}
          >
            Верхние
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => addTeeth(ALL_FDI.filter((n) => !isUpper(n) && !usedTeeth.has(n)))}
          >
            Нижние
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setItems((p) => [...p, emptyPlanItem()])}>
            Общая услуга
          </Button>
        </div>

        <Odontogram
          chart={charts[patientId] ?? {}}
          mode="pick"
          picked={[...usedTeeth]}
          title="Формула пациента"
          hint="Повторное нажатие убирает зуб из плана"
          patientAge={ageYears(patient?.birthDate ?? "")}
          onPick={(fdi) => {
            if (usedTeeth.has(fdi)) {
              setItems((prev) => {
                const next = prev.filter((i) => i.toothFdi !== fdi);
                return next.length ? next : [emptyPlanItem()];
              });
              return;
            }
            addTeeth([fdi]);
          }}
        />

        <div className="flex flex-col gap-3">
          {groups.map((g) => (
            <section key={g.key} className="rounded-lg bg-bg p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="font-medium">{g.toothFdi != null ? `Зуб ${g.toothFdi}` : "Общие услуги"}</p>
                <button
                  type="button"
                  className="grid size-9 place-items-center rounded-md text-muted hover:bg-surface hover:text-danger"
                  aria-label="Удалить группу"
                  onClick={() =>
                    setItems((prev) =>
                      prev.filter((i) => (g.toothFdi != null ? i.toothFdi !== g.toothFdi : i.toothFdi != null)),
                    )
                  }
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
              {g.toothFdi != null ? (
                <>
                  <DiagnosisField
                    diagnosisId={g.diagnosisId}
                    diagnosisText={g.diagnosis}
                    toothFdi={g.toothFdi}
                    onChange={({ diagnosisId, diagnosisText }) =>
                      setItems((prev) =>
                        patchGroup(prev, g.toothFdi, { diagnosisId: diagnosisId || undefined, diagnosis: diagnosisText }),
                      )
                    }
                  />
                  {plan ? (
                    <Field label="Планируемое лечение / комментарий" className="mt-2">
                      <Textarea
                        rows={2}
                        value={g.note}
                        onChange={(e) => setItems((prev) => patchGroup(prev, g.toothFdi, { note: e.target.value }))}
                        placeholder="Этапы: анестезия, лечение, реставрация"
                      />
                    </Field>
                  ) : null}
                </>
              ) : (
                <DiagnosisField
                  diagnosisId={g.diagnosisId}
                  diagnosisText={g.diagnosis}
                  onChange={({ diagnosisId, diagnosisText }) =>
                    setItems((prev) =>
                      patchGroup(prev, undefined, { diagnosisId: diagnosisId || undefined, diagnosis: diagnosisText }),
                    )
                  }
                />
              )}
              <p className="mt-2 mb-1 text-[13px] font-medium text-muted">Услуги</p>
              <ul className="flex flex-col gap-2">
                {g.items.map((it) => {
                  const line = Math.max(0, it.price * it.qty - it.discount);
                  return (
                    <li key={it.id} className="grid gap-2 rounded-md bg-surface p-2 sm:grid-cols-[1fr_70px_90px_auto]">
                      <Input
                        value={it.serviceName}
                        onChange={(e) =>
                          setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, serviceName: e.target.value } : x)))
                        }
                        placeholder="Название услуги"
                      />
                      <NumericInput
                        min={1}
                        value={it.qty}
                        onValue={(n) => setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, qty: n } : x)))}
                      />
                      <NumericInput
                        min={0}
                        value={it.price}
                        onValue={(n) => setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, price: n } : x)))}
                      />
                      <div className="flex items-center justify-between gap-2">
                        <span className="tabular-nums text-sm">{money(line)}</span>
                        <button
                          type="button"
                          className="grid size-9 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-danger"
                          onClick={() => setItems((prev) => prev.filter((x) => x.id !== it.id))}
                          aria-label="Удалить услугу"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <Select
                className="mt-2"
                value=""
                onChange={(e) => {
                  if (g.toothFdi != null) addServiceToTooth(g.toothFdi, e.target.value);
                  else addGeneralService(e.target.value);
                }}
              >
                <option value="">Добавить услугу из прайса</option>
                {services
                  .filter((s) => s.active)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} · {money(s.price)}
                    </option>
                  ))}
              </Select>
              <p className="mt-2 text-right text-sm font-medium">{money(g.subtotal)}</p>
            </section>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Скидка плана (одна, не суммируется со второй)">
            <Select
              value={discountTypeId}
              onChange={(e) => {
                const id = e.target.value;
                if (discountTypeId && id && id !== discountTypeId) {
                  toast.message("Скидки не суммируются", {
                    description: `Будет применено: ${discounts.find((d) => d.id === id)?.name ?? id}`,
                  });
                }
                setDiscountTypeId(id);
              }}
            >
              <option value="">Без скидки плана</option>
              {activeDisc.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} · {describeDiscount(d)} · {DISCOUNT_CATEGORY_LABEL[d.category]}
                </option>
              ))}
            </Select>
          </Field>
          <div className="rounded-lg bg-rail px-4 py-3 text-rail-fg">
            <p className="text-[12px] text-rail-muted">Без скидки {money(totals.subtotal)}</p>
            {totals.planDiscount ? <p className="text-[12px] text-rail-muted">План −{money(totals.planDiscount)}</p> : null}
            <p className="font-display text-2xl tabular-nums">{money(totals.total)}</p>
          </div>
        </div>

        {plan ? (
          <>
            <Field label="Комментарий врача">
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
            <Field label="Рекомендации">
              <Textarea rows={2} value={recommendations} onChange={(e) => setRecommendations(e.target.value)} />
            </Field>
          </>
        ) : null}

        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" type="button" onClick={() => onOpenChange(false)}>
            Закрыть
          </Button>
          <Button type="button" onClick={save}>
            Сохранить план
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function matchDoctorId(doctors: Array<{ id: string; lastName: string; firstName: string; middleName: string }>, name: string) {
  const n = (name || "").toLowerCase().replace(/\s+/g, " ").trim();
  if (!n) return "";
  const hit = doctors.find((d) => {
    const full = fullName(d).toLowerCase();
    const short = shortName(d).toLowerCase().replace(/\s+/g, " ");
    const compact = short.replace(/\.\s+/g, ".");
    const nCompact = n.replace(/\.\s+/g, ".");
    return full === n || short === n || compact === nCompact || n.startsWith(d.lastName.toLowerCase());
  });
  return hit?.id ?? "";
}

export function PlanActions({ plan }: { plan: TreatmentPlan }) {
  const patients = useClinic((s) => s.patients);
  const settings = useClinic((s) => s.settings);
  const discounts = useClinic((s) => s.discounts);
  const charts = useClinic((s) => s.charts);
  const patient = patients.find((p) => p.id === plan.patientId);
  const [file, setFile] = useState<{ blob: Blob; name: string; html?: string } | null>(null);
  const [send, setSend] = useState(false);
  if (!patient) return null;
  const chart = charts[plan.patientId];
  const text = planDocumentText(plan, patient, settings);

  async function savePdf() {
    try {
      toast.message("Готовлю PDF…");
      const built = await buildPlanPdfBlob(plan, patient!, settings, discounts, chart);
      if (!built.blob.size) throw new Error("PDF пустой");
      const head = new Uint8Array(await built.blob.slice(0, 5).arrayBuffer());
      const sig = String.fromCharCode(...head);
      if (!sig.startsWith("%PDF")) throw new Error("Собранный файл не PDF");
      const kb = Math.max(1, Math.round(built.blob.size / 1024));
      setFile({ ...built, html: planDocumentHtml(plan, patient!, settings, discounts, chart) });
      if (await isNativeApp()) {
        const how = await shareOrDownload(built.blob, built.name);
        if (how === "shared") toast.success("PDF готов — выберите, куда сохранить");
        else if (how === "aborted") toast.message(`PDF собран, ${kb} КБ`);
        else toast.success(`PDF готов, ${kb} КБ`);
      } else {
        toast.success(`PDF готов, ${kb} КБ — сохраните кнопкой в окне`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "PDF не собрался";
      toast.error(msg);
    }
  }

  function printNow() {
    const ok = openPlanPrint(plan, patient!, settings, discounts, chart);
    if (!ok) toast.error("Печать в этой среде может быть недоступна. Соберите PDF.");
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="outline" onClick={() => void savePdf()}>
        <FileDown className="size-4" />
        Создать PDF
      </Button>
      <Button size="sm" variant="ghost" onClick={printNow}>
        <Printer className="size-4" />
        Печать
      </Button>
      <Button size="sm" variant="secondary" type="button" onClick={() => setSend(true)}>
        <Share2 className="size-4" />
        Отправить пациенту
      </Button>
      <SaveFileDialog
        open={Boolean(file)}
        onOpenChange={(o) => {
          if (!o) setFile(null);
        }}
        blob={file?.blob ?? null}
        filename={file?.name ?? "plan.pdf"}
        title="План лечения"
        kind="pdf"
        html={file?.html}
      />
      <SendPatientDialog
        open={send}
        onOpenChange={setSend}
        patient={patient}
        kind="plan"
        extraBody={text}
        extraSubject={`План лечения — ${settings.clinicName}`}
      />
    </div>
  );
}

export function PatientPlans({ patientId }: { patientId: string }) {
  const plans = useClinic((s) => s.plans);
  const deletePlan = useClinic((s) => s.deletePlan);
  const list = plans.filter((p) => p.patientId === patientId).sort((a, b) => b.date.localeCompare(a.date));
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<TreatmentPlan | null>(null);
  const [askId, setAskId] = useState<string | null>(null);

  return (
    <section className="rounded-xl bg-surface p-5 shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-lg">Планы лечения</h2>
          <p className="text-sm text-muted">Несколько зубов, услуги по каждому, PDF с полным текстом.</p>
        </div>
        <Button
          onClick={() => {
            setCurrent(null);
            setOpen(true);
          }}
        >
          <Plus className="size-4" />
          Новый план
        </Button>
      </div>
      {list.length === 0 ? (
        <p className="mt-4 text-sm text-muted">Сохранённых планов нет</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {list.map((p) => {
            const t = planTotals(p.items, p.discount);
            const groups = groupPlanItems(p.items);
            return (
              <li key={p.id} className="rounded-lg bg-bg px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{p.title}</p>
                    <p className="text-[13px] text-muted">
                      {formatDate(p.date)} · {p.doctorName} · {groups.filter((g) => g.toothFdi).length} зуб. · {money(t.total)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setCurrent(p);
                        setOpen(true);
                      }}
                    >
                      Открыть
                    </Button>
                    <Button size="sm" variant="ghost" className="text-danger" onClick={() => setAskId(p.id)}>
                      Удалить
                    </Button>
                  </div>
                </div>
                <div className="mt-3">
                  <PlanActions plan={p} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <PlanEditor open={open} onOpenChange={setOpen} patientId={patientId} plan={current} />
      {askId ? (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setAskId(null)}
          title="Удалить план лечения?"
          description="Документ будет удалён. Это нельзя отменить."
          onConfirm={() => {
            deletePlan(askId);
            toast.success("План удалён");
            setAskId(null);
          }}
        />
      ) : null}
    </section>
  );
}
