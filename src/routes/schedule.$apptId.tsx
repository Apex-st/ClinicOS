import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppointmentForm } from "@/components/appointment-dialog";
import { VisitDialog } from "@/components/visit-dialog";
import { useClinic } from "@/lib/store";
import type { Appointment } from "@/lib/types";

export const Route = createFileRoute("/schedule/$apptId")({
  component: EditAppointmentPage,
});

function EditAppointmentPage() {
  const { apptId } = Route.useParams();
  const router = useRouter();
  const appointment = useClinic((s) => s.appointments.find((a) => a.id === apptId));
  const [hydrated, setHydrated] = useState(() => useClinic.persist.hasHydrated());
  const [visitFor, setVisitFor] = useState<Appointment | null>(null);

  useEffect(() => {
    if (useClinic.persist.hasHydrated()) {
      setHydrated(true);
      return;
    }
    return useClinic.persist.onFinishHydration(() => setHydrated(true));
  }, []);

  function back() {
    if (window.history.length > 1) router.history.back();
    else router.history.push("/schedule");
  }

  if (!hydrated) {
    return <p className="py-16 text-center text-sm text-muted">Загружаю запись…</p>;
  }

  if (!appointment) {
    return (
      <div className="py-16 text-center">
        <p className="font-display text-2xl">Запись не найдена</p>
        <Link to="/schedule" className="mt-3 inline-block text-sm text-primary">
          К расписанию
        </Link>
      </div>
    );
  }

  return (
    <>
      <AppointmentForm
        layout="page"
        appointment={appointment}
        onClose={back}
        onStartVisit={(a) => setVisitFor(a)}
      />
      <VisitDialog open={Boolean(visitFor)} onOpenChange={(o) => !o && setVisitFor(null)} appointment={visitFor} />
    </>
  );
}
