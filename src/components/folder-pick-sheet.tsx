import { useRef, useState } from "react";
import { FolderOpen, HardDrive, Monitor } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  canPickDriveFolder,
  canUseOpfs,
  connectFolder,
  connectPickedFolder,
  ingestDentaFile,
  ingestDirectoryFiles,
  SYNC_FILE_NAME,
} from "@/lib/clinic-sync";
import { isCancelError } from "@/lib/sync-folder-parse";

export type FolderConnectResult = Awaited<ReturnType<typeof connectPickedFolder>>;

export function FolderPickSheet({
  open,
  onOpenChange,
  onResult,
  allowOpfs = true,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onResult?: (result: FolderConnectResult) => void;
  allowOpfs?: boolean;
}) {
  const dirRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function finish(picked: { name: string; kind: "mirror" | "opfs" }) {
    const r = await connectPickedFolder(picked);
    onResult?.(r);
    onOpenChange(false);
  }

  async function onDirPicked(list: FileList | null) {
    if (!list?.length) return;
    setBusy(true);
    try {
      await finish(await ingestDirectoryFiles(list));
    } catch (err) {
      if (!isCancelError(err)) toast.error("Не удалось прочитать папку");
    } finally {
      setBusy(false);
      if (dirRef.current) dirRef.current.value = "";
    }
  }

  async function onFilePicked(list: FileList | null) {
    const file = list?.[0];
    if (!file) return;
    setBusy(true);
    try {
      await finish(await ingestDentaFile(file));
    } catch (err) {
      if (!isCancelError(err)) toast.error("Не удалось открыть файл");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function connectViaFsa() {
    setBusy(true);
    try {
      const r = await connectFolder("drive");
      onResult?.(r);
      onOpenChange(false);
    } catch (err) {
      if (isCancelError(err)) return;
      const msg = String((err as { message?: string })?.message || err);
      if (msg.includes("need-sheet") || msg.includes("picker-unavailable") || msg.includes("permission")) {
        dirRef.current?.click();
        return;
      }
      toast.error("Не удалось открыть папку. Укажите файл .denta или папку кнопкой ниже.");
    } finally {
      setBusy(false);
    }
  }

  async function useThisWindow() {
    setBusy(true);
    try {
      const r = await connectFolder("opfs");
      onResult?.(r);
      onOpenChange(false);
    } catch (err) {
      if (!isCancelError(err)) toast.error("Не удалось создать папку в этом окне");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent placement="sheet" data-testid="sync-folder-sheet">
        <DialogHeader>
          <DialogTitle>Папка Google Диска</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted">
          Выберите одну папку, не весь Диск. В ней появится файл {SYNC_FILE_NAME}. Коллеге откройте эту папку в Google
          Диске — права «Редактор».
        </p>

        <input
          ref={(el) => {
            dirRef.current = el;
            if (el) {
              el.setAttribute("webkitdirectory", "true");
              el.setAttribute("directory", "true");
              el.multiple = true;
            }
          }}
          type="file"
          multiple
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => void onDirPicked(e.target.files)}
        />
        <input
          ref={fileRef}
          type="file"
          accept=".denta,.zip,.json,application/json"
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => void onFilePicked(e.target.files)}
        />

        <div className="grid gap-2">
          <Button
            type="button"
            disabled={busy}
            className="h-12 justify-start gap-3"
            onClick={() => {
              if (canPickDriveFolder()) {
                void connectViaFsa();
                return;
              }
              dirRef.current?.click();
            }}
          >
            <FolderOpen className="size-5" />
            Выбрать папку
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            className="h-12 justify-start gap-3"
            onClick={() => fileRef.current?.click()}
          >
            <HardDrive className="size-5" />
            Выбрать файл {SYNC_FILE_NAME}
          </Button>
          {allowOpfs && canUseOpfs() ? (
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              className="h-12 justify-start gap-3"
              onClick={() => void useThisWindow()}
            >
              <Monitor className="size-5" />
              Проверить в этом окне
            </Button>
          ) : null}
        </div>
        <p className="text-[12px] text-muted">
          На телефоне после «Выбрать папку» в списке слева откройте Google Диск. Если окно папок не появилось — укажите
          уже скачанный файл .denta.
        </p>
      </DialogContent>
    </Dialog>
  );
}
