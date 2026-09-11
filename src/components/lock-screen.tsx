import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { verifyPassword } from "@/lib/passwords";
import { useSession } from "@/lib/session";
import { useClinic } from "@/lib/store";

export function LockScreen() {
  const doctors = useClinic((s) => s.doctors);
  const settings = useClinic((s) => s.settings);
  const login = useSession((s) => s.login);
  const [loginName, setLoginName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
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
      login(doc.id);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-dvh place-items-center bg-bg px-4">
      <form
        onSubmit={(e) => void submit(e)}
        className="w-full max-w-sm rounded-xl bg-surface p-6 shadow-[var(--shadow-lift)]"
      >
        <p className="font-display text-3xl text-ink">{settings.clinicName}</p>
        <h1 className="mt-2 font-display text-xl">Вход в кабинет</h1>
        <p className="mt-1 text-sm text-muted">Логин и пароль врача. Сессия держится, пока открыта вкладка.</p>
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
        </div>
      </form>
    </div>
  );
}
