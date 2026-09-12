import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, FileDown } from "lucide-react";
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
import { VisitDiaryForm } from "@/components/visit-diary-form";
import { SaveFileDialog } from "@/components/save-file-dialog";
import { MedicalBanner } from "@/components/medical-alert";
import { PatientPicker } from "@/components/patient-picker";

import { applyDiaryTemplate, composeDiaryText, emptyDiary, hasDiaryContent, suggestVisitKind, VISIT_KIND_LABEL } from "@/lib/diary";
import { buildDiaryPdfBlob, diaryDocumentHtml } from "@/lib/diary-pdf";
import { emptyDiaryExtras } from "@/lib/stats";
import { fullName, groupLabel, money, todayISO } from "@/lib/format";
import { amountForType, describeDiscount } from "@/lib/discounts";
import { slotTaken, isBlocking } from "@/lib/clinic";
import { ToothFdiOptions } from "@/components/odontogram";
import { useClinic } from "@/lib/store";
import type { Appointment, DiaryTemplate, PaymentMethod, Visit, VisitDiary, VisitItem, VisitKind } from "@/lib/types";
import { uid } from "@/lib/utils";

export function VisitDialog({
  open,
  onOpenChange,
  patientId,
  appointment,
  visit,
  startTab,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId?: string;
  appointment?: Appointment | null;
  visit?: Visit | null;
  startTab?: "diary" | "pay";
}) {
  const patients = useClinic((s) => s.patients);
  const services = useClinic((s) => s.services);
  const discounts = useClinic((s) => s.discounts);
  const groups = useClinic((s) => s.groups);
  const doctors = useClinic((s) => s.doctors);
  const visits = useClinic((s) => s.visits);
  const appointments = useClinic((s) => s.appointments);
  const templates = useClinic((s) => s.diaryTemplates);
  const extras = useClinic((s) => s.settings.diaryExtras) ?? emptyDiaryExtras();
  const settings = useClinic((s) => s.settings);
  const stockItems = useClinic((s) => s.stockItems);
  const addVisit = useClinic((s) => s.addVisit);
  const updateVisit = useClinic((s) => s.updateVisit);
  const deleteVisit = useClinic((s) => s.deleteVisit);
  const voidVisit = useClinic((s) => s.voidVisit);
  const updateAppointment = useClinic((s) => s.updateAppointment);
  const addAppointment = useClinic((s) => s.addAppointment);
  const addDiaryExtra = useClinic((s) => s.addDiaryExtra);
  const addDiaryTemplate = useClinic((s) => s.addDiaryTemplate);

  const [tab, setTab] = useState<"diary" | "pay">("diary");
  const [pid, setPid] = useState("");
  const [date, setDate] = useState(todayISO());
  const [doctorId, setDoctorId] = useState("");
  const [kind, setKind] = useState<VisitKind>("primary");
  const [diary, setDiary] = useState<VisitDiary>(emptyDiary());
  const [items, setItems] = useState<VisitItem[]>([]);
  const [notes, setNotes] = useState("");
  const [discount, setDiscount] = useState(0);
  const [discountTypeId, setDiscountTypeId] = useState("");
  const [paid, setPaid] = useState(0);
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [pick, setPick] = useState("");
  const [bookNext, setBookNext] = useState(true);
  const [askDrop, setAskDrop] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [pdfFile, setPdfFile] = useState<{ blob: Blob; name: string; html?: string } | null>(null);

  const active = useMemo(() => services.filter((s) => s.active), [services]);
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const selectedType = discounts.find((d) => d.id === discountTypeId);
  const applied = discountTypeId ? amountForType(selectedType, subtotal) : discount;
  const total = Math.max(0, subtotal - applied);

  useEffect(() => {
    if (!open) return;
    const nextPid = visit?.patientId ?? appointment?.patientId ?? patientId ?? patients[0]?.id ?? "";
    setPid(nextPid);
    setDate(visit?.date ?? appointment?.date ?? todayISO());
    setDoctorId(visit?.doctorId || appointment?.doctorId || doctors.find((d) => d.active)?.id || "");
    const suggested = visit?.kind || appointment?.visitKind || suggestVisitKind(visits, nextPid, visit?.id);
    setKind(suggested);
    setDiary(visit?.diary ?? emptyDiary());
    setNotes(visit?.notes ?? appointment?.notes ?? "");
    setDiscount(visit?.discount ?? 0);
    setDiscountTypeId(visit?.discountTypeId ?? patients.find((p) => p.id === nextPid)?.discountTypeId ?? "");
    if (visit) {
      setItems(visit.items);
      setPaid(visit.paid);
      setMethod(visit.paymentMethod ?? "cash");
    } else {
      const svc = appointment?.serviceId ? services.find((s) => s.id === appointment.serviceId) : undefined;
      setItems(svc ? [{ id: uid("vi"), serviceId: svc.id, price: svc.price, qty: 1 }] : []);
      setPaid(svc?.price ?? 0);
      setMethod("cash");
    }
    setPick("");
    setTab(startTab ?? "diary");
    setBookNext(true);
    if (appointment && !visit) updateAppointment(appointment.id, { status: "in_chair" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function addItem(serviceId: string) {
    const svc = services.find((s) => s.id === serviceId);
    if (!svc) return;
    setItems((prev) => [...prev, { id: uid("vi"), serviceId: svc.id, price: svc.price, qty: 1 }]);
    setPick("");
  }

  function applyTemplate(tpl: DiaryTemplate) {
    const next = applyDiaryTemplate(diary, tpl, kind, extras, stockItems);
    setDiary(next);
    if (tpl.id.includes("primary")) setKind("primary");
    if (tpl.id.includes("repeat")) setKind("repeat");
    if (tpl.id.includes("control")) setKind("control");
  }

  function save() {
    if (!pid) {
      toast.error("Выберите пациента");
      return;
    }
    if (items.length === 0 && !hasDiaryContent(diary)) {
      toast.error("Добавьте услугу или заполните дневник");
      return;
    }
    if (bookNext && diary.nextDate && diary.nextKind !== "none") {
      const start = diary.nextTime;
      const durationMin = diary.nextDurationMin || 30;
      if (!start) {
        toast.error("Укажите время следующего приёма");
        return;
      }
      const mine = appointments.find(
        (a) => a.patientId === pid && a.date === diary.nextDate && a.start === start && isBlocking(a.status),
      );
      if (slotTaken(appointments, diary.nextDate, start, durationMin, mine?.id)) {
        toast.error("На это время уже есть запись. Выберите другое время.");
        return;
      }
    }
    const payload = {
      patientId: pid,
      appointmentId: appointment?.id ?? visit?.appointmentId,
      date,
      items,
      notes,
      discount: applied,
      discountTypeId: discountTypeId || undefined,
      paid: Math.min(paid, total),
      paymentMethod: method,
      doctorId,
      kind,
      diary,
    };
    if (visit) {
      updateVisit(visit.id, payload);
      toast.success("Дневник обновлён");
    } else {
      addVisit(payload);
      toast.success("Приём сохранён");
    }
    if (bookNext && diary.nextDate && diary.nextKind !== "none" && diary.nextTime) {
      const start = diary.nextTime;
      const durationMin = diary.nextDurationMin || 30;
      const already = appointments.some(
        (a) => a.patientId === pid && a.date === diary.nextDate && a.start === start && isBlocking(a.status),
      );
      if (!already) {
        addAppointment({
          patientId: pid,
          doctorId: doctorId || doctors[0]?.id || "doc_ivanov",
          date: diary.nextDate,
          start,
          durationMin,
          status: "scheduled",
          notes: diary.nextNote || "Следующий визит из дневника",
          visitKind: diary.nextKind === "control" ? "control" : "repeat",
        });
        toast.message(`Следующий приём: ${diary.nextDate} ${start}`);
      }
    }
    onOpenChange(false);
  }

  const patient = patients.find((p) => p.id === pid);
  const doctorName =
    fullName(doctors.find((d) => d.id === doctorId) ?? { lastName: "", firstName: "", middleName: "" }) ||
    settings.doctorName;

  async function saveDiaryPdf() {
    if (!patient) {
      toast.error("Выберите пациента");
      return;
    }
    try {
      toast.message("Готовлю PDF дневника…");
      const payload = {
        patient,
        settings,
        date,
        doctorName,
        kind,
        diary,
        extras,
        stockItems,
        services,
        items,
        discount: applied,
        paid: Math.min(paid, total),
        total,
      };
      const built = await buildDiaryPdfBlob(payload);
      if (!built.blob.size) throw new Error("PDF пустой");
      const head = new Uint8Array(await built.blob.slice(0, 5).arrayBuffer());
      const sig = String.fromCharCode(...head);
      if (!sig.startsWith("%PDF")) throw new Error("Собранный файл не PDF");
      setPdfFile({ ...built, html: diaryDocumentHtml(payload) });
      toast.success(`PDF готов, ${Math.max(1, Math.round(built.blob.size / 1024))} КБ`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "PDF не собрался");
    }
  }

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        placement="sheet"
        onOpenAutoFocus={(e) => e.preventDefault()}
        className="flex h-[min(96dvh,100%)] max-h-[min(96dvh,100%)] flex-col gap-0 overflow-hidden p-0 md:left-1/2 md:h-[min(90dvh,800px)] md:w-[min(40rem,calc(100%-1.5rem))] md:max-w-3xl md:-translate-x-1/2 md:rounded-xl"
      >
        <div className="shrink-0 min-w-0 px-4 pt-5 pr-12 pb-3 sm:px-5">
          <DialogHeader>
            <DialogTitle>{visit ? "Дневник посещения" : "Приём"}</DialogTitle>
            <DialogDescription>
              {patient ? fullName(patient) : "Выберите пациента"} · {VISIT_KIND_LABEL[kind]}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-4 pb-3 sm:px-5">
          <div className="flex min-w-0 flex-col gap-4">
        {patient ? <MedicalBanner patient={patient} /> : null}

        <div className="flex gap-1 rounded-lg bg-surface-2 p-1">
          <button
            type="button"
            className={`h-9 flex-1 rounded-md text-sm ${tab === "diary" ? "bg-surface shadow-[var(--shadow-card)]" : "text-muted"}`}
            onClick={() => setTab("diary")}
          >
            Дневник
          </button>
          <button
            type="button"
            className={`h-9 flex-1 rounded-md text-sm ${tab === "pay" ? "bg-surface shadow-[var(--shadow-card)]" : "text-muted"}`}
            onClick={() => setTab("pay")}
          >
            Услуги и оплата
          </button>
        </div>

        {tab === "diary" ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Пациент">
                {appointment || visit ? (
                  <p className="flex h-11 min-w-0 items-center rounded-md bg-surface-2 px-3 text-sm font-medium">
                    {patient ? fullName(patient) : "Пациент"}
                  </p>
                ) : (
                  <PatientPicker
                    patients={patients}
                    value={pid}
                    expandOnFocus={false}
                    onChange={(next) => {
                      setPid(next);
                      setKind(suggestVisitKind(visits, next));
                    }}
                  />
                )}
              </Field>
              <Field label="Дата">
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </Field>
              <Field label="Врач" className="sm:col-span-2">
                <Select value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
                  {doctors
                    .filter((d) => d.active || d.id === doctorId)
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {fullName(d)}
                      </option>
                    ))}
                </Select>
              </Field>
            </div>
            <VisitDiaryForm
              kind={kind}
              patientId={pid}
              onKind={(k) => {
                setKind(k);
                setDiary((d) => ({ ...d, text: composeDiaryText(k, d, extras, stockItems) }));
              }}
              diary={diary}
              onChange={(next) => setDiary(next)}
              templates={templates}
              extras={{ ...emptyDiaryExtras(), ...extras }}
              onAddExtra={addDiaryExtra}
              onApplyTemplate={applyTemplate}
              onSaveTemplate={(name) => {
                addDiaryTemplate({
                  name,
                  complaints: diary.complaints,
                  complaintsNote: "",
                  anamnesis: diary.anamnesis,
                  anamnesisNote: "",
                  exam: diary.exam,
                  examNote: "",
                  recommendations: diary.recommendations,
                  recommendationsNote: "",
                  diagnosisId: diary.findings[0]?.diagnosisId ?? "",
                  diagnosisText: diary.findings[0]?.diagnosisText ?? "",
                  treatments: diary.findings[0]?.treatments ?? [],
                  materialIds: diary.materialIds?.length ? diary.materialIds : diary.findings[0]?.materialIds ?? [],
                });
                toast.success("Шаблон сохранён");
              }}
            />
            {diary.nextDate && diary.nextKind !== "none" ? (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={bookNext} onChange={(e) => setBookNext(e.target.checked)} />
                Поставить следующий приём в расписание
                {diary.nextTime ? ` (${diary.nextDate} ${diary.nextTime})` : " — укажите время выше"}
              </label>
            ) : null}
          </>
        ) : (
          <>
            <div className="rounded-lg bg-bg p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-[13px] font-medium text-muted">Услуги</p>
                <div className="flex min-w-0 flex-1 items-center gap-2 sm:max-w-xs">
                  <Select value={pick} onChange={(e) => addItem(e.target.value)}>
                    <option value="">Добавить услугу</option>
                    {active.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} · {money(s.price)}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
              {items.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted">Пока пусто</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {items.map((item) => {
                    const svc = services.find((s) => s.id === item.serviceId);
                    return (
                      <li
                        key={item.id}
                        className="grid min-w-0 grid-cols-1 gap-2 rounded-md bg-surface px-3 py-2 sm:grid-cols-[minmax(0,1fr)_5.5rem_5rem_auto] sm:items-center"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm">{svc?.name}</p>
                          <p className="text-[11px] text-muted">{svc ? groupLabel(groups, svc.category) : ""}</p>
                        </div>
                        <div className="grid grid-cols-[1fr_1fr_auto] items-center gap-2 sm:contents">
                        <Select
                          className="h-9"
                          value={item.toothFdi?.toString() ?? ""}
                          onChange={(e) =>
                            setItems((prev) =>
                              prev.map((it) =>
                                it.id === item.id
                                  ? { ...it, toothFdi: e.target.value ? Number(e.target.value) : undefined }
                                  : it,
                              ),
                            )
                          }
                        >
                          <option value="">Зуб</option>
                          <ToothFdiOptions />
                        </Select>
                        <NumericInput
                          className="h-9"
                          min={0}
                          value={item.price}
                          onValue={(n) =>
                            setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, price: n } : it)))
                          }
                        />
                        <button
                          type="button"
                          className="grid size-9 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-danger"
                          onClick={() => setItems((prev) => prev.filter((it) => it.id !== item.id))}
                          aria-label="Удалить"
                        >
                          <Trash2 className="size-4" />
                        </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Тип скидки" className="sm:col-span-2">
                <Select
                  value={discountTypeId}
                  onChange={(e) => {
                    const id = e.target.value;
                    if (discountTypeId && id && id !== discountTypeId) {
                      const n = discounts.find((d) => d.id === id);
                      toast.message("Скидки не суммируются", {
                        description: n ? `Будет применено: ${describeDiscount(n)}` : "",
                      });
                    }
                    setDiscountTypeId(id);
                    const t = discounts.find((d) => d.id === id);
                    setDiscount(amountForType(t, subtotal));
                  }}
                >
                  <option value="">Без скидки / вручную</option>
                  {discounts
                    .filter((d) => d.active)
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} · {describeDiscount(d)}
                      </option>
                    ))}
                </Select>
              </Field>
              <Field label="Скидка, ₽">
                <NumericInput
                  min={0}
                  value={applied}
                  onValue={(n) => {
                    setDiscountTypeId("");
                    setDiscount(n);
                  }}
                />
              </Field>
              <Field label="Оплачено, ₽">
                <NumericInput min={0} value={paid} onValue={setPaid} />
              </Field>
              <Field label="Способ">
                <Select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
                  <option value="cash">Наличные</option>
                  <option value="card">Карта</option>
                  <option value="transfer">Перевод</option>
                </Select>
              </Field>
            </div>

            <div className="flex items-end justify-between rounded-lg bg-rail px-4 py-3 text-rail-fg">
              <div>
                <p className="text-[12px] text-rail-muted">К оплате</p>
                <p className="font-display text-2xl tabular-nums">{money(total)}</p>
              </div>
              <p className="text-sm text-rail-muted">
                Долг: <span className="tabular-nums text-rail-fg">{money(Math.max(0, total - paid))}</span>
              </p>
            </div>
          </>
        )}
          </div>
        </div>

        <div className="shrink-0 min-w-0 border-t border-line px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            {visit && !visit.voidedAt ? (
              <Button
                type="button"
                variant="ghost"
                className="text-danger hover:bg-danger/10 sm:w-auto"
                onClick={() => {
                  setVoidReason("");
                  setAskDrop(true);
                }}
              >
                <Trash2 className="size-4" />
                {visit.paid > 0 ? "Аннулировать счёт" : "Удалить счёт"}
              </Button>
            ) : (
              <span className="hidden sm:block" />
            )}
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
              <Button variant="ghost" type="button" onClick={() => onOpenChange(false)}>
                Закрыть
              </Button>
              <Button variant="secondary" type="button" onClick={() => void saveDiaryPdf()} disabled={!patient}>
                <FileDown className="size-4" />
                PDF
              </Button>
              <Button type="button" className="col-span-2 sm:col-span-1" onClick={save} disabled={Boolean(visit?.voidedAt)}>
                <Plus className="size-4" />
                {visit ? "Сохранить дневник" : "Сохранить приём"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    <SaveFileDialog
      open={Boolean(pdfFile)}
      onOpenChange={(o) => {
        if (!o) setPdfFile(null);
      }}
      blob={pdfFile?.blob ?? null}
      filename={pdfFile?.name ?? "diary.pdf"}
      title="Дневник посещения"
      kind="pdf"
      html={pdfFile?.html}
    />
    <Dialog open={askDrop} onOpenChange={setAskDrop}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{visit && visit.paid > 0 ? "Аннулировать счёт?" : "Удалить счёт?"}</DialogTitle>
            <DialogDescription>
              {visit
                ? `Счёт ${visit.id} · ${patient ? fullName(patient) : "пациент"} · ${money(visit.total)}`
                : ""}
            </DialogDescription>
          </DialogHeader>
          {visit && visit.paid > 0 ? (
            <>
              <p className="text-sm">
                К счёту привязана оплата {money(visit.paid)}. Счёт не удаляется из истории: он будет помечен как
                аннулированный и не войдёт в кассу и статистику.
              </p>
              <Field label="Причина">
                <Textarea
                  rows={3}
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  placeholder="Ошибка при создании"
                />
              </Field>
            </>
          ) : (
            <p className="text-sm">Неоплаченный счёт будет удалён. Это нельзя отменить.</p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setAskDrop(false)}>
              Отмена
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={() => {
                if (!visit) return;
                const actor =
                  doctors.find((d) => d.id === doctorId)?.lastName || settings.doctorName || "Администратор";
                if (visit.paid > 0) {
                  const ok = voidVisit(visit.id, voidReason, actor);
                  toast.success(ok ? "Счёт аннулирован" : "Не удалось аннулировать");
                } else {
                  const ok = deleteVisit(visit.id);
                  toast.success(ok ? "Счёт удалён" : "Не удалось удалить");
                }
                setAskDrop(false);
                onOpenChange(false);
              }}
            >
              {visit && visit.paid > 0 ? "Аннулировать" : "Удалить"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
