import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function uid(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 8000);
  return url;
}

export async function shareOrDownload(blob: Blob, filename: string): Promise<"shared" | "download" | "aborted"> {
  try {
    const native = await import("@/lib/native-file");
    if (await native.isNativeApp()) {
      const r = await native.saveNativeFile(blob, filename, { share: true });
      if (r.how === "aborted") return "aborted";
      if (r.how === "download") return "download";
      return "shared";
    }
  } catch {
    /* браузер без Capacitor */
  }
  const file = new File([blob], filename, { type: blob.type || "application/octet-stream" });
  const nav = navigator as Navigator & {
    canShare?: (data: { files: File[] }) => boolean;
    share?: (data: { files: File[]; title?: string }) => Promise<void>;
  };
  if (typeof nav.canShare === "function" && typeof nav.share === "function") {
    try {
      if (nav.canShare({ files: [file] })) {
        await nav.share({ files: [file], title: filename });
        return "shared";
      }
    } catch (err) {
      if ((err as { name?: string }).name === "AbortError") return "aborted";
    }
  }
  downloadBlob(blob, filename);
  return "download";
}

