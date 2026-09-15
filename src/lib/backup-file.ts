import { unzipSync, zipSync, strFromU8, strToU8 } from "fflate";
import { buildExport, parseExportFile, type ExportSectionId, type ParseResult } from "@/lib/export-data";
import { decryptBytes, encryptBytes, base64ToBytes, bytesToBase64, unwrapDek, recoverySecret, parseRecoveryKey } from "@/lib/crypto";
import { getDek } from "@/lib/crypto-session";
import { todayISO } from "@/lib/format";
import { getPhotoBlob } from "@/lib/photos-idb";
import type { ClinicData } from "@/lib/store";
import { APP_VERSION } from "@/lib/version";
import {
  BACKUP_ENC_KIND,
  hasVault,
  isBackupEnvelope,
  readVault,
  type BackupEnvelope,
} from "@/lib/vault";

function extOf(type: string) {
  if (type.includes("png")) return ".png";
  if (type.includes("webp")) return ".webp";
  if (type.includes("gif")) return ".gif";
  return ".jpg";
}

function mimeOf(name: string) {
  const n = name.toLowerCase();
  if (n.endsWith(".png")) return "image/png";
  if (n.endsWith(".webp")) return "image/webp";
  if (n.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

export function isZipBytes(buf: Uint8Array) {
  return buf.length >= 2 && buf[0] === 0x50 && buf[1] === 0x4b;
}

async function zipClinic(state: ClinicData, sections: ExportSectionId[]) {
  const payload = await buildExport(state, sections, { embedPhotos: false });
  const files: Record<string, Uint8Array> = {
    "denta-export.json": strToU8(JSON.stringify(payload)),
  };
  if (sections.includes("photos")) {
    for (const ph of state.photos) {
      const blob = await getPhotoBlob(ph.id);
      if (!blob) continue;
      files[`photos/${ph.id}${extOf(blob.type)}`] = new Uint8Array(await blob.arrayBuffer());
    }
  }
  const zipped = zipSync(files, { level: 6 });
  const copy = new Uint8Array(zipped.byteLength);
  copy.set(zipped);
  return copy;
}

async function encryptBackupZip(
  zip: Uint8Array,
  sync?: { syncId: string; syncRev: number; deviceId: string },
): Promise<BackupEnvelope | null> {
  const dek = getDek();
  const vault = readVault();
  if (!dek || !vault) return null;
  const { iv, ct } = await encryptBytes(dek, zip);
  return {
    kind: BACKUP_ENC_KIND,
    v: 1,
    appVersion: APP_VERSION,
    exportedAt: new Date().toISOString(),
    wraps: vault.wraps,
    recovery: vault.recovery,
    iv: bytesToBase64(iv),
    ct: bytesToBase64(ct),
    ...(sync
      ? { syncId: sync.syncId, syncRev: sync.syncRev, deviceId: sync.deviceId }
      : {}),
  };
}

export async function buildBackupZip(
  state: ClinicData,
  sections: ExportSectionId[],
  sync?: { syncId: string; syncRev: number; deviceId: string },
) {
  const zip = await zipClinic(state, sections);
  if (hasVault() && getDek()) {
    const env = await encryptBackupZip(zip, sync);
    if (env) {
      return {
        blob: new Blob([JSON.stringify(env)], { type: "application/json" }),
        name: `denta-${todayISO()}.denta`,
        appVersion: APP_VERSION,
        encrypted: true as const,
      };
    }
  }
  const copy = new Uint8Array(zip.byteLength);
  copy.set(zip);
  return {
    blob: new Blob([copy], { type: "application/zip" }),
    name: `denta-${todayISO()}.zip`,
    appVersion: APP_VERSION,
    encrypted: false as const,
  };
}

function parseBackupZip(buf: Uint8Array): ParseResult {
  let unzipped: Record<string, Uint8Array>;
  try {
    unzipped = unzipSync(buf);
  } catch {
    return { ok: false, error: "Архив повреждён или это не копия Денты." };
  }

  const jsonFile =
    unzipped["denta-export.json"] ||
    Object.entries(unzipped).find(([k]) => k.replace(/\\/g, "/").endsWith("denta-export.json"))?.[1];
  if (!jsonFile) return { ok: false, error: "В архиве нет файла denta-export.json." };

  let jsonRaw: unknown;
  try {
    jsonRaw = JSON.parse(strFromU8(jsonFile));
  } catch {
    return { ok: false, error: "Файл данных в архиве повреждён." };
  }

  const parsed = parseExportFile(jsonRaw);
  if (!parsed.ok) return parsed;

  const photoBlobs: Record<string, Blob> = {};
  for (const [rawPath, data] of Object.entries(unzipped)) {
    const path = rawPath.replace(/\\/g, "/");
    if (path.startsWith("__MACOSX/") || path.endsWith("/")) continue;
    const m = /(?:^|\/)photos\/([^/]+)$/.exec(path);
    if (!m) continue;
    const file = m[1];
    const id = file.replace(/\.[a-z0-9]+$/i, "");
    if (!id) continue;
    const copy = new Uint8Array(data.byteLength);
    copy.set(data);
    photoBlobs[id] = new Blob([copy], { type: mimeOf(file) });
  }

  parsed.file.photoBlobs = photoBlobs;
  if (Object.keys(photoBlobs).length) {
    parsed.warnings = parsed.warnings.filter((w) => !w.includes("файлы снимков"));
    parsed.counts.photos = Math.max(parsed.counts.photos ?? 0, Object.keys(photoBlobs).length);
  }
  return parsed;
}

async function dekFromBackup(env: BackupEnvelope, password?: string): Promise<Uint8Array | null> {
  const current = getDek();
  if (current) {
    try {
      await decryptBytes(current, base64ToBytes(env.iv), base64ToBytes(env.ct));
      return current;
    } catch {
      /* another cabinet */
    }
  }
  if (!password) return null;
  for (const wrap of env.wraps ?? []) {
    if (!wrap.ct) continue;
    const dek = await unwrapDek(wrap, password);
    if (dek) return dek;
  }
  if (env.recovery && parseRecoveryKey(password)) {
    const dek = await unwrapDek(env.recovery, recoverySecret(password));
    if (dek) return dek;
  }
  return null;
}

async function parseEncryptedBackup(env: BackupEnvelope, password?: string): Promise<ParseResult> {
  const dek = await dekFromBackup(env, password);
  if (!dek) {
    return {
      ok: false,
      error: "Нужен пароль врача или ключ восстановления, которым закрыта эта копия.",
      needPassword: true,
    };
  }
  try {
    const zip = await decryptBytes(dek, base64ToBytes(env.iv), base64ToBytes(env.ct));
    const parsed = parseBackupZip(zip);
    if (parsed.ok) parsed.envelope = env;
    return parsed;
  } catch {
    return { ok: false, error: "Не удалось открыть зашифрованную копию." };
  }
}

export async function parseBackupFile(file: File, password?: string): Promise<ParseResult> {
  const buf = new Uint8Array(await file.arrayBuffer());
  if (isZipBytes(buf) || file.name.toLowerCase().endsWith(".zip")) {
    return parseBackupZip(buf);
  }
  try {
    const json = JSON.parse(new TextDecoder().decode(buf)) as unknown;
    if (isBackupEnvelope(json)) return parseEncryptedBackup(json, password);
    return parseExportFile(json);
  } catch {
    return { ok: false, error: "Не удалось прочитать файл. Нужна копия ClinicOS (.denta, zip) или старый JSON." };
  }
}
