import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/field";
import {
  ensureNotifyPermission,
  isIosDevice,
  isStandaloneApp,
  notify,
  notifySupported,
} from "@/lib/reminders";
import { useClinic } from "@/lib/store";

type Perm = NotificationPermission | "unsupported" | "unknown";

export function NotifySetup() {
  const settings = useClinic((s) => s.settings);
  const updateSettings = useClinic((s) => s.updateSettings);
  const [perm, setPerm] = useState<Perm>("unknown");
  const ios = typeof window !== "undefined" && isIosDevice();
  const installed = typeof window !== "undefined" && isStandaloneApp();

  useEffect(() => {
    if (!notifySupported()) {
      setPerm("unsupported");
      return;
    }
    setPerm(Notification.permission);
  }, []);

  async function enable() {
    if (ios && !installed) {
      toast.message("Сначала добавьте Денту на экран Домой");
      return;
    }
    const p = await ensureNotifyPermission();
    setPerm(p === "granted" ? "granted" : p === "denied" ? "denied" : "unsupported");
    if (p === "granted") {
      updateSettings({ remindersEnabled: true });
      toast.success("Уведомления включены — проверьте шторку");
      await notify("ClinicOS", "Так выглядит напоминание о приёме", "denta-test", "/schedule");
    } else if (p === "denied") {
      toast.error("Телефон запретил уведомления. Разрешите их в настройках системы.");
    } else {
      toast.message("На этом экране системные уведомления недоступны");
    }
  }

  async function test() {
    const ok = await notify("ClinicOS", "Тестовое напоминание: приём через 15 минут", "denta-test", "/schedule");
    if (ok) toast.success("Смотрите шторку уведомлений");
    else toast.error("Сначала нажмите «Разрешить уведомления»");
  }

  const status =
    perm === "granted"
      ? "Системные уведомления разрешены"
      : perm === "denied"
        ? "Запрещены в настройках телефона"
        : perm === "unsupported"
          ? "Этот экран не умеет системную шторку"
          : "Ещё не запрашивали разрешение";

  return (
    <div className="mt-4 rounded-lg bg-bg px-4 py-4">
      <p className="text-sm font-medium">Шторка телефона</p>
      <p className="mt-1 text-[13px] text-muted">{status}</p>
      {ios && !installed ? (
        <p className="mt-2 text-[13px] text-muted">
          На iPhone: Safari → Поделиться → На экран «Домой». Откройте Денту с иконки и тогда
          разрешите уведомления.
        </p>
      ) : null}
      <p className="mt-2 text-[13px] text-muted">
        Пока программа открыта или свёрнута в фоне, за {settings.reminderMinutes ?? 60} мин до
        приёма придёт карточка в шторку. Если телефон полностью закрыл Денту — сработает напоминание
        из календаря (файл .ics ниже).
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" onClick={() => void enable()}>
          Разрешить уведомления
        </Button>
        <Button type="button" variant="outline" onClick={() => void test()}>
          Проверить шторку
        </Button>
      </div>
      <label className="mt-4 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={settings.remindersEnabled !== false}
          onChange={(e) => updateSettings({ remindersEnabled: e.target.checked })}
        />
        Напоминать о приёмах
      </label>
      <Field label="За сколько минут" className="mt-3 max-w-xs">
        <Select
          value={String(settings.reminderMinutes ?? 60)}
          onChange={(e) => updateSettings({ reminderMinutes: Number(e.target.value) })}
        >
          <option value="15">за 15 минут</option>
          <option value="30">за 30 минут</option>
          <option value="60">за 1 час</option>
          <option value="120">за 2 часа</option>
        </Select>
      </Field>
    </div>
  );
}
