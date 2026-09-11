import { useRouter } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { upcomingRecurring } from "@/lib/budget";
import { formatDate, money, todayISO } from "@/lib/format";
import { FOLLOW_TODAY, needsRecall } from "@/lib/recall";
import {
  dueNow,
  ensureServiceWorker,
  loadFired,
  markFired,
  notify,
  upcomingReminders,
} from "@/lib/reminders";
import { useClinic } from "@/lib/store";

export function ReminderWatch() {
  const router = useRouter();
  const appointments = useClinic((s) => s.appointments);
  const patients = useClinic((s) => s.patients);
  const visits = useClinic((s) => s.visits);
  const services = useClinic((s) => s.services);
  const budgetRecurring = useClinic((s) => s.budgetRecurring);
  const settings = useClinic((s) => s.settings);
  const notifyRules = useClinic((s) => s.notifyRules);
  const messageTemplates = useClinic((s) => s.messageTemplates);
  const nudged = useRef(false);

  useEffect(() => {
    void ensureServiceWorker();
  }, []);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; url?: string } | undefined;
      if (data?.type !== "denta-open" || !data.url) return;
      router.history.push(data.url);
    };
    navigator.serviceWorker?.addEventListener("message", onMessage);
    return () => navigator.serviceWorker?.removeEventListener("message", onMessage);
  }, [router]);

  useEffect(() => {
    if (settings.remindersEnabled === false) return;
    const rule = notifyRules.find((r) => r.kind === "reminder");
    if (rule && !rule.enabled) return;
    const minutes = rule?.minutesBefore || settings.reminderMinutes || 60;
    const tpl = messageTemplates.find((t) => t.id === rule?.templateId);

    function tick() {
      const items = upcomingReminders(appointments, patients, services, minutes);
      const due = dueNow(items, minutes);
      const fired = loadFired();
      for (const it of due) {
        if (fired.has(it.id)) continue;
        markFired(it.id);
        const body = tpl ? `${it.body}` : it.body;
        void notify(it.title, body, it.id, "/schedule");
        toast.message(it.title, { description: body });
      }
    }

    tick();
    const id = window.setInterval(tick, 20_000);
    const onVis = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [appointments, patients, services, settings.remindersEnabled, settings.reminderMinutes, notifyRules, messageTemplates]);

  useEffect(() => {
    if (nudged.current || settings.remindersEnabled === false) return;
    const key = `denta-recall-nudge-${todayISO()}`;
    if (sessionStorage.getItem(key)) return;
    const minDays = settings.recallDays ?? 180;
    const call = patients.filter((p) => FOLLOW_TODAY.includes(p.recallStatus)).length;
    const stale = patients.filter((p) => needsRecall(p, visits, appointments, minDays)).length;
    if (call === 0 && stale === 0) return;
    nudged.current = true;
    sessionStorage.setItem(key, "1");
    toast.message("Напоминание", {
      description:
        call > 0
          ? `${call} пациент(ов) ждут звонка · ${stale} давно не были`
          : `${stale} пациент(ов) давно не были на приёме`,
    });
  }, [patients, visits, appointments, settings.remindersEnabled, settings.recallDays]);

  useEffect(() => {
    if (settings.remindersEnabled === false) return;
    const key = `denta-budget-rec-${todayISO()}`;
    if (sessionStorage.getItem(key)) return;
    const soon = upcomingRecurring(budgetRecurring);
    if (!soon.length) return;
    sessionStorage.setItem(key, "1");
    const r = soon[0];
    toast.message(`Скоро платёж: ${r.title}`, {
      description: `${money(r.amount)} · ${formatDate(r.nextDate)}`,
    });
  }, [budgetRecurring, settings.remindersEnabled]);

  return null;
}
