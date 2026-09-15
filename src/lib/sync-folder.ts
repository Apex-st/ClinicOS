import { isNativeApp } from "@/lib/native-file";

export const SYNC_FILE_NAME = "ClinicOS-cabinet.denta";
export type FolderKind = "none" | "fsa" | "native" | "opfs";

const IDB_NAME = "denta-sync-folder-v1";
const IDB_STORE = "kv";
const FSA_KEY = "dir";
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
  if (k === "fsa" || k === "native" || k === "opfs") return k;
  return "none";
}

function setKind(kind: FolderKind) {
  if (typeof localStorage === "undefined") return;
  if (kind === "none") localStorage.removeItem(KIND_KEY);
  else localStorage.setItem(KIND_KEY, kind);
}

export function canPickDriveFolder() {
  if (typeof window === "undefined") return false;
  return typeof (window as Window & { showDirectoryPicker?: unknown }).showDirectoryPicker === "function";
}

export function canUseOpfs() {
  return typeof navigator !== "undefined" && Boolean(navigator.storage?.getDirectory);
}

async function nativePlugin() {
  const { FolderAccess } = await import("@/plugins/folder-access");
  return FolderAccess;
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

export async function pickDriveFolder(): Promise<{ name: string; kind: FolderKind }> {
  if (await isNativeApp()) {
    const plugin = await nativePlugin();
    const picked = await plugin.pickDirectory();
    setKind("native");
    return { name: picked.name || "Папка", kind: "native" };
  }
  const picker = (window as Window & { showDirectoryPicker?: (opts: { mode: string }) => Promise<FsaDir> })
    .showDirectoryPicker;
  if (!picker) {
    throw new Error("picker-unavailable");
  }
  const handle = await picker({ mode: "readwrite" });
  if (!(await ensureFsa(handle))) throw new Error("permission-denied");
  await idbSet(FSA_KEY, handle);
  setKind("fsa");
  return { name: handle.name || "Папка", kind: "fsa" };
}

export async function pickOpfsFolder(): Promise<{ name: string; kind: "opfs" }> {
  if (!canUseOpfs()) throw new Error("opfs-unavailable");
  await opfsDir(true);
  setKind("opfs");
  return { name: "Это окно браузера", kind: "opfs" };
}

export async function restoreFolder(): Promise<{ name: string; kind: FolderKind } | null> {
  const kind = savedFolderKind();
  if (kind === "native") {
    if (!(await isNativeApp())) return null;
    const plugin = await nativePlugin();
    const restored = await plugin.restoreDirectory();
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
  if (kind === "native" && (await isNativeApp())) {
    try {
      const plugin = await nativePlugin();
      await plugin.forgetDirectory();
    } catch {
      /* */
    }
  }
  await idbDel(FSA_KEY);
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
    const plugin = await nativePlugin();
    const r = await plugin.readToCache({ cacheFile: "denta-sync-in.denta", fileName: SYNC_FILE_NAME });
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
    const plugin = await nativePlugin();
    await plugin.writeFromCache({ cacheFile: "denta-sync-out.denta", fileName: SYNC_FILE_NAME });
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
  throw new Error("no-folder");
}
