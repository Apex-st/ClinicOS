import { Capacitor } from "@capacitor/core";
import { FolderAccess } from "@/plugins/folder-access";
import { downloadBlob } from "@/lib/utils";
import {
  SYNC_FILE_NAME,
  folderNameFromRelativePath,
  inIframe,
  isCancelError,
  isTopLevelSyncFile,
} from "@/lib/sync-folder-parse";

export { SYNC_FILE_NAME, inIframe } from "@/lib/sync-folder-parse";
export type FolderKind = "none" | "fsa" | "native" | "opfs" | "mirror";
export type DrivePickStrategy = "native" | "fsa" | "sheet";

const IDB_NAME = "denta-sync-folder-v1";
const IDB_STORE = "kv";
const FSA_KEY = "dir";
const MIRROR_KEY = "mirror";
const KIND_KEY = "denta-sync-kind";

type FsaDir = {
  getFileHandle: (name: string, opts?: { create?: boolean }) => Promise<FsaFile>;
  queryPermission?: (opts: { mode: string }) => Promise<PermissionState>;
  requestPermission?: (opts: { mode: string }) => Promise<PermissionState>;
  name?: string;
};

type FsaFile = {
  getFile: () => Promise<File>;
  createWritable: () => Promise<{ write: (data: BufferSource | Blob) => Promise<void>; close: () => Promise<void> }>;
};

type MirrorRecord = {
  name: string;
  bytes: ArrayBuffer | null;
  lastModified: number;
};

function canIdb() {
  return typeof indexedDB !== "undefined";
}

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(IDB_STORE)) req.result.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet<T>(key: string): Promise<T | undefined> {
  if (!canIdb()) return undefined;
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readonly");
    const req = tx.objectStore(IDB_STORE).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key: string, value: unknown) {
  if (!canIdb()) return;
  const db = await openIdb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbDel(key: string) {
  if (!canIdb()) return;
  const db = await openIdb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function savedFolderKind(): FolderKind {
  if (typeof localStorage === "undefined") return "none";
  const k = localStorage.getItem(KIND_KEY);
  if (k === "fsa" || k === "native" || k === "opfs" || k === "mirror") return k;
  return "none";
}

function setKind(kind: FolderKind) {
  if (typeof localStorage === "undefined") return;
  if (kind === "none") localStorage.removeItem(KIND_KEY);
  else localStorage.setItem(KIND_KEY, kind);
}

export function canPickDriveFolder() {
  if (typeof window === "undefined") return false;
  if (inIframe()) return false;
  return typeof (window as Window & { showDirectoryPicker?: unknown }).showDirectoryPicker === "function";
}

export function drivePickStrategy(): DrivePickStrategy {
  if (typeof window === "undefined") return "sheet";
  if (Capacitor.isNativePlatform()) return "native";
  return "sheet";
}

export function canUseOpfs() {
  return typeof navigator !== "undefined" && Boolean(navigator.storage?.getDirectory);
}

async function ensureFsa(handle: FsaDir) {
  try {
    const q = (await handle.queryPermission?.({ mode: "readwrite" })) ?? "granted";
    if (q === "granted") return true;
    const r = await handle.requestPermission?.({ mode: "readwrite" });
    return r === "granted";
  } catch {
    return false;
  }
}

async function opfsDir(create: boolean) {
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle("clinic-sync", { create });
}

/** Must be called directly from a click — no await before this function's first native/FSA call. */
export function pickDriveFolder(): Promise<{ name: string; kind: FolderKind }> {
  if (Capacitor.isNativePlatform()) {
    return FolderAccess.pickDirectory().then((picked) => {
      setKind("native");
      return { name: picked.name || "Папка", kind: "native" as const };
    });
  }
  const picker = (window as Window & { showDirectoryPicker?: (opts: object) => Promise<FsaDir> }).showDirectoryPicker;
  if (typeof picker === "function" && !inIframe()) {
    return picker({ id: "clinicos-sync", mode: "readwrite", startIn: "documents" }).then(async (handle) => {
      if (!(await ensureFsa(handle))) throw new Error("permission-denied");
      await idbSet(FSA_KEY, handle);
      setKind("fsa");
      return { name: handle.name || "Папка", kind: "fsa" as const };
    });
  }
  return Promise.reject(new Error("need-sheet"));
}

export async function pickOpfsFolder(): Promise<{ name: string; kind: "opfs" }> {
  if (!canUseOpfs()) throw new Error("opfs-unavailable");
  await opfsDir(true);
  setKind("opfs");
  return { name: "Это окно браузера", kind: "opfs" };
}

export async function ingestDirectoryFiles(files: FileList | File[]): Promise<{ name: string; kind: "mirror" }> {
  const list = Array.from(files);
  if (!list.length) throw new Error("canceled");
  const first = list[0] as File & { webkitRelativePath?: string };
  const name = folderNameFromRelativePath(first.webkitRelativePath || first.name);
  const denta = list.find((f) => {
    const rel = (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name;
    return isTopLevelSyncFile(rel, f.name);
  });
  if (denta) {
    const buf = await denta.arrayBuffer();
    await idbSet(MIRROR_KEY, { name, bytes: buf, lastModified: denta.lastModified } satisfies MirrorRecord);
  } else {
    await idbSet(MIRROR_KEY, { name, bytes: null, lastModified: Date.now() } satisfies MirrorRecord);
  }
  setKind("mirror");
  return { name, kind: "mirror" };
}

export async function ingestDentaFile(file: File): Promise<{ name: string; kind: "mirror" }> {
  const buf = await file.arrayBuffer();
  const name = file.name.replace(/\.(denta|zip|json)$/i, "") || "Кабинет";
  await idbSet(MIRROR_KEY, { name, bytes: buf, lastModified: file.lastModified } satisfies MirrorRecord);
  setKind("mirror");
  return { name, kind: "mirror" };
}

export async function restoreFolder(): Promise<{ name: string; kind: FolderKind } | null> {
  const kind = savedFolderKind();
  if (kind === "native") {
    if (!Capacitor.isNativePlatform()) return null;
    const restored = await FolderAccess.restoreDirectory();
    if ("missing" in restored && restored.missing) return null;
    return { name: "name" in restored ? restored.name || "Папка" : "Папка", kind: "native" };
  }
  if (kind === "fsa") {
    const handle = await idbGet<FsaDir>(FSA_KEY);
    if (!handle) return null;
    if (!(await ensureFsa(handle))) return { name: handle.name || "Папка", kind: "fsa" };
    return { name: handle.name || "Папка", kind: "fsa" };
  }
  if (kind === "opfs") {
    if (!canUseOpfs()) return null;
    try {
      await opfsDir(false);
      return { name: "Это окно браузера", kind: "opfs" };
    } catch {
      return null;
    }
  }
  if (kind === "mirror") {
    const rec = await idbGet<MirrorRecord>(MIRROR_KEY);
    if (!rec) return null;
    return { name: rec.name || "Папка", kind: "mirror" };
  }
  return null;
}

export async function folderNeedsGesture(): Promise<boolean> {
  if (savedFolderKind() !== "fsa") return false;
  const handle = await idbGet<FsaDir>(FSA_KEY);
  if (!handle) return false;
  return !(await ensureFsa(handle));
}

export async function forgetFolder() {
  const kind = savedFolderKind();
  if (kind === "native" && Capacitor.isNativePlatform()) {
    try {
      await FolderAccess.forgetDirectory();
    } catch {
      /* */
    }
  }
  await idbDel(FSA_KEY);
  await idbDel(MIRROR_KEY);
  setKind("none");
}

async function fsaHandle(): Promise<FsaDir | null> {
  const handle = await idbGet<FsaDir>(FSA_KEY);
  if (!handle) return null;
  if (!(await ensureFsa(handle))) throw new Error("permission-denied");
  return handle;
}

export async function readSyncFile(): Promise<{ bytes: Uint8Array; lastModified: number } | null> {
  const kind = savedFolderKind();
  if (kind === "native") {
    const r = await FolderAccess.readToCache({ cacheFile: "denta-sync-in.denta", fileName: SYNC_FILE_NAME });
    if (!("lastModified" in r)) return null;
    const modified = r.lastModified;
    const { Filesystem, Directory } = await import("@capacitor/filesystem");
    const file = await Filesystem.readFile({ path: "denta-sync-in.denta", directory: Directory.Cache });
    const data = file.data;
    if (typeof data !== "string") {
      const buf = new Uint8Array(await (data as Blob).arrayBuffer());
      return { bytes: buf, lastModified: modified };
    }
    const bin = atob(data);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return { bytes, lastModified: modified };
  }
  if (kind === "fsa") {
    const dir = await fsaHandle();
    if (!dir) return null;
    try {
      const fh = await dir.getFileHandle(SYNC_FILE_NAME);
      const file = await fh.getFile();
      return { bytes: new Uint8Array(await file.arrayBuffer()), lastModified: file.lastModified };
    } catch {
      return null;
    }
  }
  if (kind === "opfs") {
    const dir = await opfsDir(true);
    try {
      const fh = await dir.getFileHandle(SYNC_FILE_NAME);
      const file = await fh.getFile();
      return { bytes: new Uint8Array(await file.arrayBuffer()), lastModified: file.lastModified };
    } catch {
      return null;
    }
  }
  if (kind === "mirror") {
    const rec = await idbGet<MirrorRecord>(MIRROR_KEY);
    if (!rec?.bytes) return null;
    return { bytes: new Uint8Array(rec.bytes), lastModified: rec.lastModified };
  }
  return null;
}

export async function writeSyncFile(bytes: Uint8Array) {
  const kind = savedFolderKind();
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const blob = new Blob([copy], { type: "application/json" });
  if (kind === "native") {
    const { Filesystem, Directory } = await import("@capacitor/filesystem");
    const reader = new FileReader();
    const b64 = await new Promise<string>((resolve, reject) => {
      reader.onload = () => {
        const s = String(reader.result || "");
        const i = s.indexOf(",");
        resolve(i >= 0 ? s.slice(i + 1) : s);
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
    await Filesystem.writeFile({
      path: "denta-sync-out.denta",
      data: b64,
      directory: Directory.Cache,
    });
    await FolderAccess.writeFromCache({ cacheFile: "denta-sync-out.denta", fileName: SYNC_FILE_NAME });
    return;
  }
  if (kind === "fsa") {
    const dir = await fsaHandle();
    if (!dir) throw new Error("no-folder");
    const fh = await dir.getFileHandle(SYNC_FILE_NAME, { create: true });
    const w = await fh.createWritable();
    await w.write(blob);
    await w.close();
    return;
  }
  if (kind === "opfs") {
    const dir = await opfsDir(true);
    const fh = await dir.getFileHandle(SYNC_FILE_NAME, { create: true });
    const w = await fh.createWritable();
    await w.write(blob);
    await w.close();
    return;
  }
  if (kind === "mirror") {
    const rec = (await idbGet<MirrorRecord>(MIRROR_KEY)) ?? { name: "Папка", bytes: null, lastModified: Date.now() };
    const buf = copy.buffer.slice(copy.byteOffset, copy.byteOffset + copy.byteLength);
    await idbSet(MIRROR_KEY, { ...rec, bytes: buf, lastModified: Date.now() } satisfies MirrorRecord);
    return;
  }
  throw new Error("no-folder");
}

export function downloadSyncCopy(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  downloadBlob(new Blob([copy], { type: "application/octet-stream" }), SYNC_FILE_NAME);
}

export { isCancelError };
