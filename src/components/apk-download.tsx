import { Smartphone } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function ApkDownload() {
  const [busy, setBusy] = useState(false);

  async function download() {
    setBusy(true);
    toast.message("Готовлю файл для телефона…");
    try {
      const res = await fetch("/Denta-2.24.apk", { cache: "no-store" });
      if (!res.ok) throw new Error("file");
      const buf = await res.arrayBuffer();
      triggerDownload(new Blob([buf], { type: "application/vnd.android.package-archive" }), "Denta-2.24.apk");
      toast.success("Смотрите папку «Загрузки» или значок загрузки в браузере сверху");
    } catch {
      try {
        const res = await fetch("/Denta-android.zip", { cache: "no-store" });
        if (!res.ok) throw new Error("zip");
        const buf = await res.arrayBuffer();
        triggerDownload(new Blob([buf], { type: "application/zip" }), "Denta-android.zip");
        toast.success("Скачан архив. Откройте его и установите Denta.apk");
      } catch {
        toast.error("Предпросмотр блокирует скачивание. Напишите в чат — пришлю файл ещё раз.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl bg-primary px-5 py-5 text-primary-fg shadow-[var(--shadow-lift)]">
      <p className="text-[12px] uppercase tracking-wide opacity-80">Телефон</p>
      <h2 className="font-display text-2xl">Приложение на Android</h2>
      <p className="mt-1 max-w-prose text-sm opacity-90">
        Нажмите кнопку — файл Denta.apk уйдёт в загрузки. Поставьте его на Android. Если окно
        предпросмотра молчит, файл лежит ниже в этом чате.
      </p>
      <div className="mt-4">
        <Button
          type="button"
          size="lg"
          variant="secondary"
          disabled={busy}
          onClick={() => void download()}
        >
          <Smartphone className="size-4" />
          {busy ? "Скачиваю…" : "Скачать для Android"}
        </Button>
      </div>
    </section>
  );
}
