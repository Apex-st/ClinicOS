import { CalendarPlus, MessageSquare, Phone } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { SendPatientDialog } from "@/components/send-patient";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { formatDate, phoneHref, todayISO } from "@/lib/format";
import { RECALL_STATUS_LABEL } from "@/lib/recall";
import { useClinic } from "@/lib/store";
import type { Patient, RecallStatus } from "@/lib/types";

const STATUSES = Object.keys(RECALL_STATUS_LABEL) as RecallStatus[];

export function PatientRecall({ patient }: { patient: Patient }) {
  const contacts = useClinic((s) => s.contacts);
  const setRecallStatus = useClinic((s) => s.setRecallStatus);
  const addContact = useClinic((s) => s.addContact);
  const list = contacts
    .filter((c) => c.patientId === patient.id)
    .sort((a, b) => b.at.localeCompare(a.at));
  const [note, setNote] = useState("");
  const [send, setSend] = useState(false);
  const navigate = useNavigate();

  function log(kind: "call" | "message" | "note", text: string, status?: RecallStatus) {
    addContact(patient.id, kind, text, status);
    toast.success("Запись в истории контактов");
    setNote("");
  }

  return (
    <section className="rounded-xl bg-surface p-5 shadow-[var(--shadow-card)]">
      <h2 className="font-display text-lg">Приглашения и контакты</h2>
      <p className="mt-1 text-sm text-muted">Звонок, сообщение и статус — в одной истории, без второй системы рассылок.</p>

      <div className="mt-4 flex flex-wrap gap-2">
        {patient.phone ? (
          <a href={phoneHref(patient.phone)} onClick={() => log("call", "Звонок")}>
            <Button type="button" variant="secondary">
              <Phone className="size-4" />
              Позвонить
            </Button>
          </a>
        ) : null}
        <Button type="button" variant="secondary" onClick={() => setSend(true)}>
          <MessageSquare className="size-4" />
          Сообщение
        </Button>
        <Button
          type="button"
          onClick={() =>
            void navigate({
              to: "/schedule/new",
              search: { date: todayISO(), start: "10:00", patientId: patient.id },
            } as never)
          }
        >
          <CalendarPlus className="size-4" />
          Записать на приём
        </Button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
        <Field label="Статус">
          <Select
            value={patient.recallStatus}
            onChange={(e) => setRecallStatus(patient.id, e.target.value as RecallStatus)}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {RECALL_STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Заметка в историю">
          <div className="flex gap-2">
            <Textarea rows={1} className="min-h-11" value={note} onChange={(e) => setNote(e.target.value)} />
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                if (!note.trim()) return;
                log("note", note.trim());
              }}
            >
              Записать
            </Button>
          </div>
        </Field>
      </div>

      {list.length === 0 ? (
        <p className="mt-4 text-sm text-muted">Контактов ещё не было</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {list.map((c) => (
            <li key={c.id} className="rounded-lg bg-bg px-3 py-2 text-sm">
              <p className="text-[12px] text-muted">
                {formatDate(c.at, "d MMMM yyyy, HH:mm")}
                {c.status ? ` · ${RECALL_STATUS_LABEL[c.status]}` : ""}
              </p>
              <p>{c.text || (c.kind === "call" ? "Звонок" : c.kind === "message" ? "Сообщение" : "Статус")}</p>
            </li>
          ))}
        </ul>
      )}

      <SendPatientDialog open={send} onOpenChange={setSend} patient={patient} kind="recall" />
    </section>
  );
}
