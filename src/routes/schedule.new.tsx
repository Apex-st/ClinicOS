import { createFileRoute, useRouter } from "@tanstack/react-router";
import { AppointmentForm } from "@/components/appointment-dialog";
import { todayISO } from "@/lib/format";

type Search = {
  date?: string;
  start?: string;
  doctorId?: string;
  patientId?: string;
};

export const Route = createFileRoute("/schedule/new")({
  component: NewAppointmentPage,
  validateSearch: (raw: Record<string, unknown>): Search => ({
    date: typeof raw.date === "string" ? raw.date : undefined,
    start: typeof raw.start === "string" ? raw.start : undefined,
    doctorId: typeof raw.doctorId === "string" ? raw.doctorId : undefined,
    patientId: typeof raw.patientId === "string" ? raw.patientId : undefined,
  }),
});

function NewAppointmentPage() {
  const router = useRouter();
  const search = Route.useSearch();

  function back() {
    if (window.history.length > 1) router.history.back();
    else router.history.push("/schedule");
  }

  return (
    <AppointmentForm
      layout="page"
      preset={{
        date: search.date || todayISO(),
        start: search.start || "09:00",
        doctorId: search.doctorId,
        patientId: search.patientId,
      }}
      onClose={back}
    />
  );
}
