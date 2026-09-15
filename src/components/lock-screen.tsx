import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { unlockWithPassword, unlockWithRecovery, migrateToEncryptionIfNeeded } from "@/lib/encryption";
import { maybePersistAutoUnlock } from "@/lib/crypto-session";
import { hasVault, readVault } from "@/lib/vault";
import { verifyPassword } from "@/lib/passwords";
import { useSession } from "@/lib/session";
import { useClinic } from "@/lib/store";

export function LockScreen() {
  const doctors = useClinic((s) => s.doctors);
  const settings = useClinic((s) => s.settings);
  const login = useSession((s) => s.login);
  const vault = readVault();
  const [loginName, setLoginName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [recoveryKey, setRecoveryKey] = useState("");

  async function afterUnlock(doctorId: string) {
    try {
      await useClinic.persist.rehydrate();
    } catch {
      toast.error("Не удалось открыть зашифрованные данные");
      useSession.getState().logout();
      return;
    }
    if (!useClinic.persist.hasHydrated?.()) {
      toast.error("Не удалось открыть зашифрованные данные");
      useSession.getState().logout();
      return;
    }
    login(doctorId);
    maybePersistAutoUnlock();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (hasVault()) {
        const result = await unlockWithPassword(loginName, password);
        if ("fail" in result) {
          if (result.fail === "no-wrap") {
            toast.error("Этот профиль ещё не привязан к шифрованию. Попросите главного врача задать пароль в настройках.");
            return;
          }
          if (result.fail === "no-crypto") {
            toast.error("Шифрование недоступно в этом браузере");
            return;
          }
          toast.error("Неверный логин или пароль");
          return;
        }
        await afterUnlock(result.doctorId);
        return;
      }

      const doc = doctors.find((d) => d.active && d.login.toLowerCase() === loginName.trim().toLowerCase());
      if (!doc || !doc.passwordHash) {
        toast.error("Неверный логин или пароль");
        return;
      }
      const ok = await verifyPassword(password, doc.passwordSalt, doc.passwordHash);
      if (!ok) {
        toast.error("Неверный логин или пароль");
        return;
      }
      try {
        await migrateToEncryptionIfNeeded({
          doctorId: doc.id,
          login: doc.login,
          password,
        });
      } catch {
        toast.error("Не удалось включить шифрование");
        return;
      }
      login(doc.id);
    } finally {
      setBusy(false);
    }
  }

  async function submitRecovery(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const result = await unlockWithRecovery(recoveryKey);
      if ("fail" in result) {
        toast.error("Ключ не подошёл");
        return;
      }
      await afterUnlock(result.doctorId);
    } finally {
      setBusy(false);
    }
  }

  const title = vault?.clinicName || settings.clinicName || "ClinicOS";

  if (recoveryMode) {
    return (
      <div className="grid min-h-dvh place-items-center bg-bg px-4">
        <form
          onSubmit={(e) => void submitRecovery(e)}
          className="w-full max-w-sm rounded-xl bg-surface p-6 shadow-[var(--shadow-lift)]"
        >
          <p className="font-display text-3xl text-ink">{title}</p>
          <h1 className="mt-2 font-display text-xl">Ключ восстановления</h1>
          <p className="mt-1 text-sm text-muted">
            Введите ключ, который показывали при первом шифровании. После входа задайте новый пароль в настройках.
          </p>
          <Field label="Ключ" className="mt-5">
            <Textarea
              value={recoveryKey}
              onChange={(e) => setRecoveryKey(e.target.value)}
              autoFocus
              placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
            />
          </Field>
          <Button type="submit" className="mt-3 w-full" disabled={busy || recoveryKey.trim().length < 16}>
            {busy ? "Проверка…" : "Открыть кабинет"}
          </Button>
          <button
            type="button"
            className="mt-3 w-full text-center text-sm text-muted hover:text-ink"
            onClick={() => setRecoveryMode(false)}
          >
            Назад ко входу
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="grid min-h-dvh place-items-center bg-bg px-4">
      <form
        onSubmit={(e) => void submit(e)}
        className="w-full max-w-sm rounded-xl bg-surface p-6 shadow-[var(--shadow-lift)]"
      >
        <p className="font-display text-3xl text-ink">{title}</p>
        <h1 className="mt-2 font-display text-xl">Вход в кабинет</h1>
        <p className="mt-1 text-sm text-muted">
          {hasVault()
            ? "Карточки и снимки зашифрованы. Сессия держится, пока открыта вкладка."
            : "Логин и пароль. Сессия держится, пока открыта вкладка."}
        </p>
        <div className="mt-5 flex flex-col gap-3">
          <Field label="Логин">
            <Input
              autoComplete="username"
              value={loginName}
              onChange={(e) => setLoginName(e.target.value)}
              autoFocus
            />
          </Field>
          <Field label="Пароль">
            <Input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <Button type="submit" disabled={busy || !loginName || !password}>
            {busy ? "Проверка…" : "Войти"}
          </Button>
          {hasVault() ? (
            <button
              type="button"
              className="text-center text-sm text-muted hover:text-ink"
              onClick={() => setRecoveryMode(true)}
            >
              Вход по ключу восстановления
            </button>
          ) : null}
        </div>
      </form>
    </div>
  );
}
