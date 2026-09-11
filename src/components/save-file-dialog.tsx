import { FileText } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { shareOrDownload } from "@/lib/utils";

export type SaveKind = "pdf" | "json" | "ics" | "image";

export function SaveFileDialog({
  open,
  onOpenChange,
  blob,
  filename,
  title,
  kind,
  html,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  blob: Blob | null;
  filename: string;
  title: string;
  kind: SaveKind;
  html?: string | null;
}) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!blob) {
      setUrl(null);
      return;
    }
    const next = URL.createObjectURL(blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [blob]);

  async function share() {
    if (!blob) return;
    const how = await shareOrDownload(blob, filename);
    if (how === "shared") toast.success("Выберите, куда сохранить файл");
    else if (how === "aborted") toast.message("Отмена");
    else toast.success("Если файл не появился — нажмите ещё раз или «Скачать»");
  }

  function printNow() {
    const w = frameRef.current?.contentWindow;
    if (!w) {
      toast.error("Сначала дождитесь предпросмотра");
      return;
    }
    w.focus();
    w.print();
  }

  async function copyText() {
    if (!blob) return;
    try {
      const text = await blob.text();
      await navigator.clipboard.writeText(text);
      toast.success("Текст копии в буфере — вставьте в файл на компьютере");
    } catch {
      toast.error("Не удалось скопировать");
    }
  }

  const sizeLabel = blob ? `${Math.max(1, Math.round(blob.size / 1024))} КБ` : "";
  const hint =
    kind === "pdf"
      ? "Файл собран. Текст плана ниже — это не пустой экран. «Поделиться» сохраняет настоящий PDF."
      : kind === "ics"
        ? "Откройте файл и выберите календарь телефона. Так появятся напоминания, даже когда Дента закрыта."
        : kind === "image"
          ? "Снимок можно сохранить в «Файлы» или отправить в Telegram. Имя файла без фамилии пациента."
          : "Сохраните файл в «Загрузки» или отправьте себе в Telegram — так не потеряете карточки.";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{hint}</DialogDescription>
        </DialogHeader>
        {kind === "pdf" ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-start gap-3 rounded-lg bg-surface-2 px-3 py-3 text-sm">
              <FileText className="mt-0.5 size-5 shrink-0 text-primary" />
              <div className="min-w-0">
                <p className="font-medium break-all">{filename}</p>
                <p className="mt-0.5 text-muted">{blob ? `PDF готов · ${sizeLabel}` : "Файл ещё собирается…"}</p>
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              {html ? (
                <Button variant="secondary" type="button" onClick={printNow}>
                  Печать
                </Button>
              ) : null}
              {url ? (
                <Button variant="secondary" asChild>
                  <a href={url} download={filename}>
                    Скачать
                  </a>
                </Button>
              ) : null}
              <Button type="button" onClick={() => void share()} disabled={!blob}>
                Поделиться / сохранить
              </Button>
            </div>
            {html ? (
              <iframe
                ref={frameRef}
                title="Документ"
                srcDoc={html}
                className="min-h-[240px] h-[40vh] w-full rounded-md bg-white"
              />
            ) : null}
          </div>
        ) : kind === "image" && url ? (
          <div>
            <img src={url} alt="" className="max-h-[min(52vh,420px)] w-full rounded-md bg-surface-2 object-contain" />
            <p className="mt-2 text-sm">
              {filename}
              {blob ? ` · ${sizeLabel}` : ""}
            </p>
          </div>
        ) : (
          <div className="rounded-lg bg-surface-2 px-4 py-3 text-sm">
            <p className="font-medium">{filename}</p>
            <p className="mt-1 text-muted">{sizeLabel}</p>
          </div>
        )}
        {kind === "pdf" ? null : (
          <div className="flex flex-wrap justify-end gap-2">
            {kind === "json" ? (
              <Button variant="secondary" type="button" onClick={() => void copyText()}>
                Скопировать текст
              </Button>
            ) : null}
            <Button type="button" onClick={() => void share()} disabled={!blob}>
              Поделиться / сохранить
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
