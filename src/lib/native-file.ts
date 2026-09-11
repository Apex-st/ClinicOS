import { downloadBlob } from "@/lib/utils";

export type SaveResult = {
  how: "documents" | "shared" | "download" | "aborted";
  path?: string;
};

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const s = String(reader.result || "");
      const i = s.indexOf(",");
      resolve(i >= 0 ? s.slice(i + 1) : s);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export async function isNativeApp() {
  try {
    const { Capacitor } = await import("@capacitor/core");
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export async function saveNativeFile(
  blob: Blob,
  filename: string,
  opts?: { share?: boolean },
): Promise<SaveResult> {
  if (!(await isNativeApp())) {
    downloadBlob(blob, filename);
    return { how: "download", path: filename };
  }

  const { Filesystem, Directory } = await import("@capacitor/filesystem");
  const data = await blobToBase64(blob);
  const rel = `Denta/${filename}`;

  try {
    if (typeof Filesystem.requestPermissions === "function") {
      await Filesystem.requestPermissions();
    }
  } catch {
    /* older Android без отдельного запроса */
  }

  let savedUri: string | undefined;
  let path: string | undefined;

  try {
    await Filesystem.writeFile({
      path: rel,
      data,
      directory: Directory.Documents,
      recursive: true,
    });
    const loc = await Filesystem.getUri({ path: rel, directory: Directory.Documents });
    savedUri = loc.uri;
    path = `Документы/${rel}`;
  } catch {
    try {
      await Filesystem.writeFile({
        path: filename,
        data,
        directory: Directory.Cache,
        recursive: true,
      });
      const loc = await Filesystem.getUri({ path: filename, directory: Directory.Cache });
      savedUri = loc.uri;
    } catch {
      downloadBlob(blob, filename);
      return { how: "download", path: filename };
    }
  }

  if (opts?.share !== false && savedUri) {
    try {
      const { Share } = await import("@capacitor/share");
      await Share.share({
        title: filename,
        text: "Копия Денты",
        files: [savedUri],
        dialogTitle: "Сохранить копию",
      });
      return { how: path ? "documents" : "shared", path };
    } catch (err) {
      if ((err as { name?: string }).name === "AbortError") {
        return { how: path ? "documents" : "aborted", path };
      }
      if (path) return { how: "documents", path };
      return { how: "aborted" };
    }
  }

  if (path) return { how: "documents", path };
  return { how: "shared" };
}
