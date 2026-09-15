import { decryptBytes, encryptBytes, isPhotoPacked, packPhoto, unpackPhoto } from "./crypto";
import { getDek } from "./crypto-session";

const DB_NAME = "denta-photos-v1";
const STORE = "files";

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB недоступен"));
  }
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function putRaw(id: string, blob: Blob) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(blob, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getRaw(id: string): Promise<Blob | undefined> {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(id);
      req.onsuccess = () => resolve(req.result as Blob | undefined);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return undefined;
  }
}

export async function putPhotoBlob(id: string, blob: Blob) {
  const dek = getDek();
  if (dek) {
    const buf = new Uint8Array(await blob.arrayBuffer());
    if (isPhotoPacked(buf)) {
      await putRaw(id, blob);
      return;
    }
    const { iv, ct } = await encryptBytes(dek, buf);
    const packed = packPhoto(iv, ct);
    const packedBuf = packed.buffer.slice(packed.byteOffset, packed.byteOffset + packed.byteLength) as ArrayBuffer;
    await putRaw(id, new Blob([packedBuf], { type: blob.type || "application/octet-stream" }));
    return;
  }
  await putRaw(id, blob);
}

export async function getPhotoBlob(id: string): Promise<Blob | undefined> {
  const stored = await getRaw(id);
  if (!stored) return undefined;
  const buf = new Uint8Array(await stored.arrayBuffer());
  const packed = unpackPhoto(buf);
  if (!packed) return stored;
  const dek = getDek();
  if (!dek) return undefined;
  try {
    const plain = await decryptBytes(dek, packed.iv, packed.ct);
    const plainBuf = plain.buffer.slice(plain.byteOffset, plain.byteOffset + plain.byteLength) as ArrayBuffer;
    return new Blob([plainBuf], { type: stored.type || "image/jpeg" });
  } catch {
    return undefined;
  }
}

export async function listPhotoIds(): Promise<string[]> {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).getAllKeys();
      req.onsuccess = () => resolve((req.result as IDBValidKey[]).map(String));
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function encryptAllPlainPhotos() {
  const dek = getDek();
  if (!dek) return;
  const ids = await listPhotoIds();
  for (const id of ids) {
    const stored = await getRaw(id);
    if (!stored) continue;
    const buf = new Uint8Array(await stored.arrayBuffer());
    if (isPhotoPacked(buf)) continue;
    const { iv, ct } = await encryptBytes(dek, buf);
    const packed = packPhoto(iv, ct);
    const packedBuf = packed.buffer.slice(packed.byteOffset, packed.byteOffset + packed.byteLength) as ArrayBuffer;
    await putRaw(id, new Blob([packedBuf], { type: stored.type || "application/octet-stream" }));
  }
}

export async function deletePhotoBlobs(ids: string[]) {
  if (ids.length === 0) return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    for (const id of ids) store.delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearAllPhotoBlobs() {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function compressImage(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const max = 1600;
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bmp.close();
    return file;
  }
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.84),
  );
  return blob ?? file;
}

export async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const [head, body] = dataUrl.split(",");
  const mime = /data:(.*?);/.exec(head ?? "")?.[1] ?? "image/jpeg";
  const bin = atob(body ?? "");
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}
