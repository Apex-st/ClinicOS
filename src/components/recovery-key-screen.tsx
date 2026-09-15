import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setPendingRecoveryKey } from "@/lib/crypto-session";

export function RecoveryKeyScreen({ recoveryKey }: { recoveryKey: string }) {
  const [copied, setCopied] = useState(false);
  const [ok, setOk] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(recoveryKey);
      setCopied(true);
      toast.success("Ключ скопирован");
    } catch {
      toast.error("Не удалось скопировать — перепишите вручную");
    }
  }

  return (
    <div className="grid min-h-dvh place-items-center bg-bg px-4 py-8">
      <div className="w-full max-w-md rounded-xl bg-surface p-6 shadow-[var(--shadow-lift)]">
        <p className="font-display text-3xl text-ink">ClinicOS</p>
        <h1 className="mt-2 font-display text-xl">Ключ восстановления</h1>
        <p className="mt-2 text-sm text-muted">
          Данные кабинета зашифрованы. Если все пароли будут забыты, открыть карточки можно только этим ключом.
          Запишите его и спрячьте. Показать снова — в «Настройки → Врачи».
        </p>
        <p className="mt-4 break-all rounded-lg bg-bg px-3 py-3 font-mono text-sm tracking-wide text-ink">
          {recoveryKey}
        </p>
        <Button type="button" variant="outline" className="mt-3 w-full" onClick={() => void copy()}>
          {copied ? "Скопировано" : "Скопировать ключ"}
        </Button>
        <label className="mt-4 flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={ok} onChange={(e) => setOk(e.target.checked)} />
          Я записал ключ и храню его отдельно от телефона
        </label>
        <Button
          type="button"
          className="mt-4 w-full"
          disabled={!ok}
          onClick={() => setPendingRecoveryKey(null)}
        >
          Продолжить
        </Button>
      </div>
    </div>
  );
}
