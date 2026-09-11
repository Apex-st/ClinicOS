import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { googleCalendarUrl, icsBlob } from "@/lib/calendar-ics";
import { fullName } from "@/lib/format";
import { useClinic } from "@/lib/store";
import type { Appointment } from "@/lib/types";
import { SaveFileDialog } from "./save-file-dialog";
import { useState } from "react";

export function CalendarOffer({
  open,
  onOpenChange,
  appointment,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  appointment: Appointment | null;
}) {
  const patients = useClinic((s) => s.patients);
  const services = useClinic((s) => s.services);
  const settings = useClinic((s) => s.settings);
  const [ics, setIcs] = useState<{ blob: Blob; name: string } | null>(null);
  if (!appointment) return null;
  const patient = patients.find((p) => p.id === appointment.patientId);
  const gcal = googleCalendarUrl(appointment, patient, settings, services);

  return (
    <>
      <Dialog open={open && !ics} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Календарь телефона</DialogTitle>
            <DialogDescription>
              Дента сама не пишет в календарь Google/Apple. Выберите, куда добавить приём{" "}
              {patient ? `«${fullName(patient)}»` : ""} в {appointment.start}.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <a href={gcal} target="_blank" rel="noreferrer">
              <Button type="button" className="w-full">
                Открыть Google Календарь
              </Button>
            </a>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => {
                setIcs({
                  blob: icsBlob(
                    [appointment],
                    patients,
                    settings,
                    services,
                    settings.reminderMinutes ?? 60,
                  ),
                  name: "denta-priyom.ics",
                });
              }}
            >
              Файл для Apple / другого календаря
            </Button>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Не сейчас
            </Button>
          </div>
          <p className="text-[12px] text-muted">
            Google: откроется событие — нажмите «Сохранить». Apple: откройте файл .ics и выберите
            «Календарь».
          </p>
        </DialogContent>
      </Dialog>
      <SaveFileDialog
        open={Boolean(ics)}
        onOpenChange={(o) => {
          if (!o) {
            setIcs(null);
            onOpenChange(false);
          }
        }}
        blob={ics?.blob ?? null}
        filename={ics?.name ?? "priyom.ics"}
        title="Файл календаря"
        kind="ics"
      />
    </>
  );
}
