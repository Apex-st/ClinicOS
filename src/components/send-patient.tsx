import { Mail, MessageSquare, Send } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, Select } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { fillTemplate, TEMPLATE_KIND_LABEL } from "@/lib/messages";
import { mailtoHref, smsHref, waHref } from "@/lib/format";
import { useClinic } from "@/lib/store";
import type { MessageTemplate, Patient } from "@/lib/types";

export type SendChannel = "sms" | "whatsapp" | "email";

const CHANNEL_LABEL: Record<SendChannel, string> = {
  sms: "SMS",
  whatsapp: "WhatsApp",
  email: "Электронная почта",
};

export function SendPatientDialog({
  open,
  onOpenChange,
  patient,
  kind,
  extraBody,
  extraSubject,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  patient: Patient | null;
  kind?: MessageTemplate["kind"];
  extraBody?: string;
  extraSubject?: string;
}) {
  const templates = useClinic((s) => s.messageTemplates);
  const settings = useClinic((s) => s.settings);
  const addContact = useClinic((s) => s.addContact);
  const doctors = useClinic((s) => s.doctors);
  const [channel, setChannel] = useState<SendChannel>("whatsapp");
  const [tplId, setTplId] = useState("");
  const [text, setText] = useState("");

  const list = useMemo(() => {
    const all = templates ?? [];
    if (kind) {
      const hit = all.filter((t) => t.kind === kind);
      return hit.length ? hit : all;
    }
    const rest = all.filter((t) => t.kind !== "reminder");
    return rest.length ? rest : all;
  }, [templates, kind]);

  useEffect(() => {
    if (!open || !patient) return;
    const tpl = list.find((t) => t.id === tplId) ?? list[0];
    setTplId(tpl?.id ?? "");
    const filled = tpl
      ? fillTemplate(tpl.body, {
          patient,
          settings,
          doctor: settings.doctorName || doctors[0]?.lastName,
        })
      : "";
    setText([filled, extraBody].filter(Boolean).join("\n\n"));
    if (channel === "email" && !patient.email && patient.phone) setChannel("whatsapp");
    if ((channel === "sms" || channel === "whatsapp") && !patient.phone && patient.email) setChannel("email");
  }, [open, patient?.id, tplId, list, extraBody]);

  if (!patient) return null;

  const missing =
    (channel === "sms" || channel === "whatsapp") && !patient.phone.trim()
      ? "У пациента не указан номер телефона."
      : channel === "email" && !patient.email.trim()
        ? "У пациента не указан email."
        : "";

  function send() {
    if (!patient) return;
    if (missing) {
      toast.error(missing);
      return;
    }
    const subject = extraSubject || `${settings.clinicName}: сообщение`;
    let href = "";
    if (channel === "whatsapp") href = waHref(patient.phone, text);
    if (channel === "sms") href = smsHref(patient.phone, text);
    if (channel === "email") href = mailtoHref(patient.email, subject, text);
    addContact(patient.id, "message", `${CHANNEL_LABEL[channel]}: ${text.slice(0, 180)}`);
    window.open(href, "_blank", "noopener,noreferrer");
    toast.success("Откроется приложение телефона, WhatsApp или почта. Серверной отправки в программе нет.");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Отправить пациенту</DialogTitle>
          <DialogDescription>
            Сообщение можно править. Отправка идёт через SMS, WhatsApp или почтовый клиент этого устройства — не через
            сервер клиники.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-2">
          {(["whatsapp", "sms", "email"] as const).map((c) => (
            <Button key={c} type="button" size="sm" variant={channel === c ? "default" : "secondary"} onClick={() => setChannel(c)}>
              {c === "email" ? <Mail className="size-4" /> : <MessageSquare className="size-4" />}
              {CHANNEL_LABEL[c]}
            </Button>
          ))}
        </div>
        {list.length > 0 ? (
          <Field label="Шаблон">
            <Select
              value={tplId}
              onChange={(e) => {
                setTplId(e.target.value);
              }}
            >
              {list.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} · {TEMPLATE_KIND_LABEL[t.kind]}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
        <Field label="Предпросмотр сообщения">
          <Textarea rows={7} value={text} onChange={(e) => setText(e.target.value)} />
        </Field>
        {missing ? <p className="text-sm text-danger">{missing}</p> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button type="button" onClick={send} disabled={Boolean(missing) || !text.trim()}>
            <Send className="size-4" />
            Открыть {CHANNEL_LABEL[channel]}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
