import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { alertSummary, patientHasAlert } from "@/lib/patient-meta";
import { useClinic } from "@/lib/store";
import type { Patient } from "@/lib/types";

export function MedicalBanner({ patient }: { patient: Patient }) {
  const custom = useClinic((s) => s.customMedical);
  if (!patientHasAlert(patient)) return null;
  const parts = alertSummary(patient, custom);
  return (
    <div className="flex gap-3 rounded-lg bg-danger/10 px-3 py-2.5 text-sm text-danger">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0">
        <p className="font-medium">Важное медицинское предупреждение</p>
        <p className="mt-0.5 text-[13px] leading-snug">{parts.join(" · ") || "Есть отметка в карточке."}</p>
      </div>
    </div>
  );
}

export function MedicalAlertDialog({
  patient,
  open,
  onOpenChange,
}: {
  patient: Patient;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const custom = useClinic((s) => s.customMedical);
  if (!patientHasAlert(patient)) return null;
  const parts = alertSummary(patient, custom);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-danger">
            <AlertTriangle className="size-5" />
            Важное медицинское предупреждение
          </DialogTitle>
          <DialogDescription>Ознакомьтесь перед началом приёма. Подробности не показываются в общем списке.</DialogDescription>
        </DialogHeader>
        <ul className="flex flex-col gap-1.5 text-sm">
          {parts.map((p) => (
            <li key={p} className="rounded-md bg-danger/10 px-3 py-2 text-danger">
              {p}
            </li>
          ))}
        </ul>
        <div className="flex justify-end">
          <Button type="button" onClick={() => onOpenChange(false)}>
            Ознакомлен
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function AlertMark({ patient }: { patient: Patient }) {
  if (!patientHasAlert(patient)) return null;
  return (
    <span title="Есть медицинское предупреждение" className="inline-flex text-danger">
      <AlertTriangle className="size-4" />
      <span className="sr-only">Медицинское предупреждение</span>
    </span>
  );
}
