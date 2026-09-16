export const SYNC_FILE_NAME = "ClinicOS-cabinet.denta";

export function folderNameFromRelativePath(relativePath: string, fallback = "Папка"): string {
  const trimmed = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!trimmed) return fallback;
  const first = trimmed.split("/")[0];
  return first || fallback;
}

export function isTopLevelSyncFile(relativePath: string, fileName: string, syncName = SYNC_FILE_NAME): boolean {
  const parts = relativePath.replace(/\\/g, "/").split("/").filter(Boolean);
  const base = parts[parts.length - 1] || fileName;
  const match = base === syncName || (base.startsWith("ClinicOS-cabinet") && base.endsWith(".denta"));
  if (!match) return false;
  return parts.length <= 2;
}

export function inIframe(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export function isCancelError(err: unknown): boolean {
  const name = err instanceof DOMException ? err.name : "";
  if (name === "AbortError" || name === "NotAllowedError") return true;
  const msg = String((err as { message?: string })?.message || err || "").toLowerCase();
  return msg.includes("cancel") || msg.includes("abort") || msg.includes("dismiss");
}
