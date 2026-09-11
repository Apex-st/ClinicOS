import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/schedule")({ component: ScheduleLayout });

function ScheduleLayout() {
  return <Outlet />;
}
