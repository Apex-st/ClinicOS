import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, Select } from "@/components/ui/field";
import { formatDate, fullName } from "@/lib/format";
import {
  importedPatientLabel,
  matchImportedPatient,
  nameFromEventTitle,
  parseIcs,
  type ImportedEvent,
} from "@/lib/calendar-ics";
import { useClinic, type PatientDraft } from "@/lib/store";
import { useSession } from "@/lib/session";

const CREATE = "__create__";

function draftFromTitle(title: string, extra: string): PatientDraft {
  const name = nameFromEventTitle(title);
  return {
    lastName: name.lastName,
    firstName: name.firstName,
    middleName: name.middleName,
    birthDate: "",
    phone: "",
    email: "",
    address: "",
    allergies: "",
    chronic: "",
    notes: ["Импорт из календаря", title, extra].filter(Boolean).join("\n"),
    cardNumber: "",
    referredById: "",
    sourceKind: "other",
    sourceSocial: "",
    sourceNote: "календарь",
    tagIds: [],
    medicalFlags: [],
    medicalNote: "",
    discountTypeId: "",
    recallStatus: "none",
  };
}

export function CalendarImportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const patients = useClinic((s) => s.patients);
  const appointments = useClinic((s) => s.appointments);
  const doctors = useClinic((s) => s.doctors);
  const addAppointment = useClinic((s) => s.addAppointment);
  const addPatient = useClinic((s) => s.addPatient);
  const sessionDoctor = useSession((s) => s.doctorId);
  const [events, setEvents] = useState<ImportedEvent[]>([]);
  const [picked, setPicked] = useState<Record<number, boolean>>({});
  const [patientOf, setPatientOf] = useState<Record<number, string>>({});
  const [includeAllDay, setIncludeAllDay] = useState(false);

  const doctorId = sessionDoctor || doctors.find((d) => d.active)?.id || doctors[0]?.id || "";

  const visible = useMemo(
    () => events.map((e, i) => ({ e, i })).filter(({ e }) => includeAllDay || !e.allDay),
    [events, includeAllDay],
  );

  async function onFile(file: File) {
    const text = await file.text();
    const list = parseIcs(text);
    if (!list.length) {
      toast.error("В файле нет событий");
      return;
    }
    const nextPick: Record<number, boolean> = {};
    const nextPat: Record<number, string> = {};
    list.forEach((ev, i) => {
      const p = matchImportedPatient(ev.title, patients);
      nextPat[i] = p?.id ?? CREATE;
      nextPick[i] = !ev.allDay;
    });
    setEvents(list);
    setPicked(nextPick);
    setPatientOf(nextPat);
    toast.success(`Найдено событий: ${list.length}`);
  }

  function save() {
    let n = 0;
    let created = 0;
    let skip = 0;
    const createdByKey: Record<string, string> = {};

    for (const { e, i } of visible) {
      if (!picked[i]) continue;
      let patientId = patientOf[i];
      if (!patientId || patientId === CREATE) {
        const draft = draftFromTitle(e.title, e.notes);
        const key = `${draft.lastName}|${draft.firstName}|${draft.middleName}`.toLowerCase();
        if (createdByKey[key]) {
          patientId = createdByKey[key];
        } else {
          const existing = useClinic.getState().patients.find(
            (p) =>
              p.lastName.toLowerCase() === draft.lastName.toLowerCase() &&
              p.firstName.toLowerCase() === draft.firstName.toLowerCase(),
          );
          if (existing) {
            patientId = existing.id;
          } else {
            patientId = addPatient(draft);
            createdByKey[key] = patientId;
            created += 1;
          }
        }
      }
      if (!patientId) {
        skip += 1;
        continue;
      }
      const dup = appointments.some(
        (a) => a.patientId === patientId && a.date === e.date && a.start === e.start && a.status !== "cancelled",
      );
      if (dup) {
        skip += 1;
        continue;
      }
      addAppointment({
        patientId,
        doctorId,
        date: e.date,
        start: e.start,
        durationMin: e.durationMin,
        status: "scheduled",
        notes: [e.title, e.notes].filter(Boolean).join("\n"),
      });
      n += 1;
    }
    const bits = [
      n ? `записей: ${n}` : "",
      created ? `новых карточек: ${created}` : "",
      skip ? `пропущено: ${skip}` : "",
    ].filter(Boolean);
    if (n || created) toast.success(`Перенесено — ${bits.join(", ")}`);
    else toast.message(skip ? "Нечего добавлять — уже есть такая запись" : "Ничего не отмечено");
    if (n) onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent placement="sheet">
        <DialogHeader>
          <DialogTitle>Из календаря телефона</DialogTitle>
          <DialogDescription>
            Google и Samsung не отдают записи сами. Экспортируйте их в файл .ics (или «Поделиться» событием) и выберите файл здесь.
            Если пациента ещё нет — создадим карточку.
          </DialogDescription>
        </DialogHeader>
        <label className="flex h-11 cursor-pointer items-center justify-center rounded-md bg-surface-2 text-sm">
          Выбрать файл .ics
          <input
            type="file"
            accept=".ics,text/calendar,application/ics"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onFile(f);
              e.target.value = "";
            }}
          />
        </label>
        {events.length ? (
          <>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={includeAllDay} onChange={(ev) => setIncludeAllDay(ev.target.checked)} />
              Показывать события на весь день
            </label>
            <ul className="flex max-h-[46vh] flex-col gap-2 overflow-y-auto">
              {visible.map(({ e, i }) => (
                <li key={`${e.uid}-${i}`} className="rounded-lg bg-bg px-3 py-2">
                  <label className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={Boolean(picked[i])}
                      onChange={(ev) => setPicked((p) => ({ ...p, [i]: ev.target.checked }))}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{e.title}</p>
                      <p className="text-[12px] text-muted">
                        {formatDate(e.date)} · {e.allDay ? "весь день" : `${e.start}, ${e.durationMin} мин`}
                      </p>
                      <Field label="Пациент" className="mt-2">
                        <Select value={patientOf[i] ?? ""} onChange={(ev) => setPatientOf((p) => ({ ...p, [i]: ev.target.value }))}>
                          <option value={CREATE}>Новая карточка: {importedPatientLabel(e.title)}</option>
                          {patients.map((p) => (
                            <option key={p.id} value={p.id}>
                              {fullName(p)}
                            </option>
                          ))}
                        </Select>
                      </Field>
                    </div>
                  </label>
                </li>
              ))}
            </ul>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" type="button" onClick={() => onOpenChange(false)}>
                Отмена
              </Button>
              <Button type="button" onClick={save}>
                Перенести
              </Button>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
