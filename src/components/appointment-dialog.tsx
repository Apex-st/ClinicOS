import { useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
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
import { NumericInput } from "@/components/ui/numeric-input";
import { Textarea } from "@/components/ui/textarea";
import { fullName, minutesOf } from "@/lib/format";
import { VISIT_KIND_LABEL, VISIT_KIND_ORDER, suggestVisitKind } from "@/lib/diary";
import { useClinic } from "@/lib/store";
import { useSession } from "@/lib/session";
import type { Appointment } from "@/lib/types";
import { ConfirmDialog } from "@/components/ui/alert-dialog";
import { CalendarOffer } from "@/components/calendar-offer";
import { PatientDialog } from "./patient-dialog";
import { MedicalBanner } from "@/components/medical-alert";
import { PatientPicker } from "@/components/patient-picker";

export function AppointmentForm({
  appointment,
  preset,
  onClose,
  onStartVisit,
  layout = "sheet",
}: {
  appointment?: Appointment | null;
  preset?: { date?: string; start?: string; patientId?: string; doctorId?: string };
  onClose: () => void;
  onStartVisit?: (appointment: Appointment) => void;
  layout?: "sheet" | "page";
}) {
  const patients = useClinic((s) => s.patients);
  const services = useClinic((s) => s.services);
  const appointments = useClinic((s) => s.appointments);
  const doctors = useClinic((s) => s.doctors);
  const addAppointment = useClinic((s) => s.addAppointment);
  const updateAppointment = useClinic((s) => s.updateAppointment);
  const deleteAppointment = useClinic((s) => s.deleteAppointment);
  const sessionDoctor = useSession((s) => s.doctorId);

  const [patientId, setPatientId] = useState("");
  const [date, setDate] = useState("");
  const [start, setStart] = useState("09:00");
  const [durationMin, setDurationMin] = useState(30);
  const [serviceId, setServiceId] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<Appointment["status"]>("scheduled");
  const [doctorId, setDoctorId] = useState("");
  const [visitKind, setVisitKind] = useState<Appointment["visitKind"]>(undefined);
  const [newPatient, setNewPatient] = useState(false);
  const [askDelete, setAskDelete] = useState(false);
  const [calendarFor, setCalendarFor] = useState<Appointment | null>(null);
  const [leaveAfterOffer, setLeaveAfterOffer] = useState(false);

  const activeServices = useMemo(() => services.filter((s) => s.active), [services]);

  useEffect(() => {
    if (appointment) {
      setPatientId(appointment.patientId);
      setDate(appointment.date);
      setStart(appointment.start);
      setDurationMin(appointment.durationMin);
      setServiceId(appointment.serviceId ?? "");
      setNotes(appointment.notes);
      setStatus(appointment.status);
      setDoctorId(appointment.doctorId || doctors[0]?.id || "");
      setVisitKind(appointment.visitKind);
    } else {
      setPatientId(preset?.patientId ?? patients[0]?.id ?? "");
      setDate(preset?.date ?? "");
      setStart(preset?.start ?? "09:00");
      setDurationMin(30);
      setServiceId("");
      setNotes("");
      setStatus("scheduled");
      setDoctorId(preset?.doctorId || sessionDoctor || doctors.find((d) => d.active)?.id || "");
      const pid = preset?.patientId ?? patients[0]?.id ?? "";
      setVisitKind(suggestVisitKind(useClinic.getState().visits, pid));
    }
  }, [appointment, preset, patients, doctors, sessionDoctor]);

  function onService(id: string) {
    setServiceId(id);
    const svc = services.find((s) => s.id === id);
    if (svc) setDurationMin(svc.durationMin);
  }

  function overlaps() {
    const a0 = minutesOf(start);
    const a1 = a0 + durationMin;
    return appointments.some((b) => {
      if (b.date !== date) return false;
      if (b.status === "cancelled" || b.status === "no_show") return false;
      if (appointment && b.id === appointment.id) return false;
      const b0 = minutesOf(b.start);
      const b1 = b0 + b.durationMin;
      return a0 < b1 && b0 < a1;
    });
  }

  function save() {
    if (!patientId || !date || !start) {
      toast.error("Выберите пациента, дату и время");
      return;
    }
    if (overlaps()) {
      toast.error("Это время уже занято");
      return;
    }
    const draft = {
      patientId,
      doctorId: doctorId || doctors[0]?.id || "doc_ivanov",
      date,
      start,
      durationMin,
      serviceId: serviceId || undefined,
      status,
      notes,
      visitKind,
    };
    if (appointment) {
      updateAppointment(appointment.id, draft);
      toast.success("Запись обновлена");
      onClose();
    } else {
      const id = addAppointment(draft);
      const created = { ...draft, id } as Appointment;
      toast.success("Пациент записан");
      setLeaveAfterOffer(true);
      setCalendarFor(created);
    }
  }

  const title = appointment ? "Запись" : "Новая запись";
  const fields = (
    <>
      <div className="grid gap-3">
        <Field label="Пациент">
          <div className="flex gap-2">
            <PatientPicker
              patients={patients}
              value={patientId}
              expandOnFocus={!appointment}
              onChange={(next) => {
                setPatientId(next);
                if (!appointment) setVisitKind(suggestVisitKind(useClinic.getState().visits, next));
              }}
            />
            <Button type="button" variant="secondary" onClick={() => setNewPatient(true)}>
              Новый
            </Button>
          </div>
        </Field>
        {patients.find((p) => p.id === patientId) ? (
          <MedicalBanner patient={patients.find((p) => p.id === patientId)!} />
        ) : null}
        <Field label="Врач">
          <Select value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
            {doctors
              .filter((d) => d.active || d.id === doctorId)
              .map((d) => (
                <option key={d.id} value={d.id}>
                  {fullName(d)} · {d.specialty}
                </option>
              ))}
          </Select>
        </Field>
        <Field label="Тип приёма">
          <Select
            value={visitKind ?? ""}
            onChange={(e) => setVisitKind((e.target.value || undefined) as Appointment["visitKind"])}
          >
            {VISIT_KIND_ORDER.map((k) => (
              <option key={k} value={k}>
                {VISIT_KIND_LABEL[k]}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Дата">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Время">
            <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
          </Field>
        </div>
        <Field label="Услуга">
          <Select value={serviceId} onChange={(e) => onService(e.target.value)}>
            <option value="">Без услуги</option>
            {activeServices.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Длительность, мин">
          <NumericInput min={1} value={durationMin} onValue={setDurationMin} />
        </Field>
        {appointment ? (
          <Field label="Статус">
            <Select value={status} onChange={(e) => setStatus(e.target.value as Appointment["status"])}>
              <option value="scheduled">Запись</option>
              <option value="confirmed">Подтверждена</option>
              <option value="in_chair">В кресле</option>
              <option value="done">Завершена</option>
              <option value="cancelled">Отмена</option>
              <option value="no_show">Не явился</option>
            </Select>
          </Field>
        ) : null}
        <Field label="Комментарий">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </Field>
      </div>
      <div className="flex items-center justify-between gap-2">
        {appointment ? (
          <div className="flex flex-wrap gap-1">
            <Button type="button" variant="ghost" className="text-danger" onClick={() => setAskDelete(true)}>
              Удалить
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() =>
                setCalendarFor({
                  ...appointment,
                  patientId,
                  date,
                  start,
                  durationMin,
                  serviceId: serviceId || undefined,
                  notes,
                  status,
                  doctorId,
                })
              }
            >
              В календарь
            </Button>
          </div>
        ) : (
          <span />
        )}
        <div className="flex flex-wrap justify-end gap-2">
          {appointment &&
          onStartVisit &&
          appointment.status !== "done" &&
          appointment.status !== "cancelled" &&
          appointment.status !== "no_show" ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                onStartVisit(appointment);
              }}
            >
              Начать приём
            </Button>
          ) : null}
          <Button variant="ghost" type="button" onClick={onClose}>
            Отмена
          </Button>
          <Button type="button" onClick={save}>
            Сохранить
          </Button>
        </div>
      </div>
    </>
  );

  return (
    <>
      {layout === "page" ? (
        <div className="flex min-w-0 flex-col gap-5">
          <button type="button" onClick={onClose} className="inline-flex w-fit items-center gap-1 text-sm text-muted hover:text-ink">
            <ArrowLeft className="size-4" />
            Назад
          </button>
          <header>
            <h1 className="font-display text-3xl">{title}</h1>
            <p className="mt-1 text-sm text-muted">Один кабинет — одно кресло. Пересечения по времени не допускаются.</p>
          </header>
          <div className="rounded-xl bg-surface p-5 shadow-[var(--shadow-card)]">
            <div className="flex flex-col gap-4">{fields}</div>
          </div>
        </div>
      ) : (
        <>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>Один кабинет — одно кресло. Пересечения по времени не допускаются.</DialogDescription>
          </DialogHeader>
          {fields}
        </>
      )}
      <PatientDialog open={newPatient} onOpenChange={setNewPatient} onCreated={(id) => setPatientId(id)} />
      <ConfirmDialog
        open={askDelete}
        onOpenChange={setAskDelete}
        title="Удалить запись?"
        description="Приём пропадёт из расписания. Это нельзя отменить."
        confirmLabel="Удалить"
        onConfirm={() => {
          if (!appointment) return;
          deleteAppointment(appointment.id);
          toast.success("Запись удалена");
          onClose();
        }}
      />
      <CalendarOffer
        open={Boolean(calendarFor)}
        onOpenChange={(o) => {
          if (!o) {
            setCalendarFor(null);
            if (leaveAfterOffer) {
              setLeaveAfterOffer(false);
              onClose();
            }
          }
        }}
        appointment={calendarFor}
      />
    </>
  );
}

export function AppointmentDialog({
  open,
  onOpenChange,
  appointment,
  preset,
  onStartVisit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment?: Appointment | null;
  preset?: { date: string; start: string; patientId?: string; doctorId?: string };
  onStartVisit?: (appointment: Appointment) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent placement="sheet" onOpenAutoFocus={(e) => appointment && e.preventDefault()}>
        {open ? (
          <AppointmentForm
            appointment={appointment}
            preset={preset}
            onClose={() => onOpenChange(false)}
            onStartVisit={(a) => {
              onOpenChange(false);
              onStartVisit?.(a);
            }}
            layout="sheet"
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
