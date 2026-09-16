import { useSyncExternalStore, useState } from "react";
import { Cloud, FolderOpen, RefreshCw, Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { IosSwitch } from "@/components/ios-switch";
import { FolderPickSheet, type FolderConnectResult } from "@/components/folder-pick-sheet";
import { hasDek } from "@/lib/crypto-session";
import { hasVault } from "@/lib/vault";
import { isCancelError } from "@/lib/sync-folder-parse";
import {
  SYNC_FILE_NAME,
  canUseOpfs,
  connectFolder,
  disconnectSync,
  downloadMirrorNow,
  drivePickStrategy,
  formatSyncTime,
  getSyncStatus,
  resolveConflict,
  runSync,
  subscribeSync,
} from "@/lib/clinic-sync";

export function SyncPanel() {
  const status = useSyncExternalStore(subscribeSync, getSyncStatus, getSyncStatus);
  const [busy, setBusy] = useState(false);
  const [offAsk, setOffAsk] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [password, setPassword] = useState("");
  const ready = hasVault() && hasDek();
  const mirror = status.kind === "mirror";

  function onConnected(r: FolderConnectResult) {
    if (r.status === "need-password" || r.status === "empty") {
      if (r.status === "empty") {
        toast.error("В папке нет файла кабинета. Сначала подключите папку на устройстве, где кабинет уже есть.");
      } else {
        setPasswordOpen(true);
      }
    }
  }

  function startDrivePick() {
    if (!ready) {
      toast.error("Сначала войдите в кабинет");
      return;
    }
    if (drivePickStrategy() === "sheet") {
      setSheetOpen(true);
      return;
    }
    void pick("drive");
  }

  async function pick(kind: "drive" | "opfs") {
    setBusy(true);
    try {
      const r = await connectFolder(kind);
      onConnected(r);
    } catch (err) {
      if (isCancelError(err)) return;
      const msg = String((err as { message?: string })?.message || err);
      if (msg.includes("need-sheet") || msg.includes("picker-unavailable")) {
        setSheetOpen(true);
        return;
      }
      toast.error("Не удалось открыть папку");
    } finally {
      setBusy(false);
    }
  }

  async function now() {
    setBusy(true);
    try {
      await runSync({ silent: false });
    } finally {
      setBusy(false);
    }
  }

  async function pullWithPassword() {
    setBusy(true);
    try {
      await runSync({ force: "pull", password, silent: false });
      setPasswordOpen(false);
      setPassword("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl bg-surface p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-start gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          <Cloud className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg">Общая папка</h2>
          <p className="mt-1 text-sm text-muted">
            Программа пишет в выбранную папку зашифрованный файл {SYNC_FILE_NAME}. Доступ коллеге вы даёте сами в
            Google Диске: «Настроить доступ» → его почта, права «Редактор». Без пароля врача файл не читается.
          </p>
        </div>
      </div>

      {!ready ? (
        <p className="mt-4 rounded-md bg-warn/10 px-3 py-2 text-sm text-warn">
          Сначала войдите в кабинет. В папку уходит только защищённая копия.
        </p>
      ) : null}

      <div className="mt-4 flex items-center justify-between gap-3 rounded-lg bg-bg px-3 py-3">
        <div>
          <p className="text-sm text-ink">Автообмен</p>
          <p className="text-[12px] text-muted">
            {status.enabled ? status.folderName || "Папка выбрана" : "Папка не выбрана"}
          </p>
        </div>
        <IosSwitch
          on={status.enabled}
          label="Автообмен"
          onChange={(on) => {
            if (!ready) {
              toast.error("Сначала войдите в кабинет");
              return;
            }
            if (!on) setOffAsk(true);
            else startDrivePick();
          }}
        />
      </div>

      {status.enabled ? (
        <dl className="mt-4 grid gap-2 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Последняя отправка</dt>
            <dd className="tabular-nums">{formatSyncTime(status.lastPushAt)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Последнее получение</dt>
            <dd className="tabular-nums">{formatSyncTime(status.lastPullAt)}</dd>
          </div>
          {status.dirty ? (
            <p className="text-[12px] text-muted">Есть местные изменения, ещё не ушедшие в папку.</p>
          ) : null}
          {mirror ? (
            <p className="text-[12px] text-muted">
              Это окно не может само писать в Google Диск. Нажмите «Скачать в Диск» и сохраните файл в ту же папку.
            </p>
          ) : null}
          {status.lastError ? <p className="text-sm text-danger">{status.lastError}</p> : null}
          {status.needsGesture ? (
            <p className="text-sm text-warn">Нажмите «Синхронизировать», чтобы снова разрешить доступ к папке.</p>
          ) : null}
        </dl>
      ) : null}

      {status.conflict ? (
        <div className="mt-4 rounded-lg bg-warn/10 p-3">
          <p className="text-sm text-ink">Оба устройства меняли кабинет. Какую копию оставить?</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={() => void resolveConflict("remote")}>
              Взять из папки
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => void resolveConflict("local")}>
              Оставить эту
            </Button>
          </div>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" disabled={busy} onClick={startDrivePick}>
          <FolderOpen className="size-4" />
          {status.enabled ? "Сменить папку" : "Выбрать папку Диска"}
        </Button>
        {status.enabled ? (
          <Button type="button" variant="outline" disabled={busy || !ready} onClick={() => void now()}>
            <RefreshCw className="size-4" />
            Синхронизировать
          </Button>
        ) : null}
        {status.enabled && mirror ? (
          <Button type="button" variant="outline" disabled={busy || !ready} onClick={() => void downloadMirrorNow()}>
            <Download className="size-4" />
            Скачать в Диск
          </Button>
        ) : null}
        {canUseOpfs() && status.kind !== "fsa" && status.kind !== "native" && status.kind !== "mirror" ? (
          <Button type="button" variant="outline" disabled={busy || !ready} onClick={() => void pick("opfs")}>
            Проверить в этом окне
          </Button>
        ) : null}
      </div>

      <p className="mt-3 text-[12px] text-muted">
        На телефоне откроется список папок — слева выберите Google Диск. Если окно не появилось, программа покажет
        выбор файла. Не правьте карточки на двух телефонах в одну секунду: если обе копии новее, программа спросит.
      </p>

      <FolderPickSheet open={sheetOpen} onOpenChange={setSheetOpen} onResult={onConnected} />

      <ConfirmDialog
        open={offAsk}
        onOpenChange={setOffAsk}
        title="Отключить обмен?"
        description="Файл в папке останется. Новые приёмы на это устройство сами больше не уйдут."
        confirmLabel="Отключить"
        danger
        onConfirm={() => {
          void disconnectSync();
        }}
      />

      <Dialog open={passwordOpen} onOpenChange={setPasswordOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Пароль кабинета в папке</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted">В папке уже есть кабинет. Введите пароль врача или ключ восстановления.</p>
          <Field label="Пароль или ключ" className="mt-3">
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
          </Field>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button type="button" variant="ghost" onClick={() => setPasswordOpen(false)}>
              Отмена
            </Button>
            <Button type="button" disabled={!password || busy} onClick={() => void pullWithPassword()}>
              Открыть
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
