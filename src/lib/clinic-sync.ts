import { toast } from "sonner";
import { Capacitor } from "@capacitor/core";
import { buildBackupZip, parseBackupFile } from "@/lib/backup-file";
import { getDek, setDek } from "@/lib/crypto-session";
import { unwrapDek, recoverySecret, parseRecoveryKey, decryptBytes, base64ToBytes } from "@/lib/crypto";
import { allSectionIds, mergeExport, type ImportPreview } from "@/lib/export-data";
import { clearAllPhotoBlobs, dataUrlToBlob, putPhotoBlob } from "@/lib/photos-idb";
import { waitForPersistWrites } from "@/lib/secure-storage";
import { hasPasswordAccount } from "@/lib/staff";
import { useClinic } from "@/lib/store";
import { decideSync } from "@/lib/sync-decide";
import {
  canPickDriveFolder,
  canUseOpfs,
  forgetFolder,
  folderNeedsGesture,
  pickDriveFolder,
  pickOpfsFolder,
  readSyncFile,
  restoreFolder,
  savedFolderKind,
  SYNC_FILE_NAME,
  writeSyncFile,
  type FolderKind,
} from "@/lib/sync-folder";
import { uid } from "@/lib/utils";
import {
  emptyVault,
  hasVault,
  isBackupEnvelope,
  readVault,
  writeVault,
  type BackupEnvelope,
} from "@/lib/vault";

const CONFIG_KEY = "denta-sync-v1";
const DEVICE_KEY = "denta-device-v1";
const DEBOUNCE_MS = 4000;
const PULL_EVERY_MS = 25000;

export type SyncConfig = {
  enabled: boolean;
  folderName: string;
  kind: FolderKind;
  syncId: string;
  lastRev: number;
  lastPushAt: string | null;
  lastPullAt: string | null;
  lastError: string | null;
  dirty: boolean;
  conflict: boolean;
};

export type SyncUiStatus = SyncConfig & {
  busy: boolean;
  needsGesture: boolean;
};

const listeners = new Set<() => void>();
let busy = false;
let applyingRemote = false;
let debounceTimer: number | null = null;
let pullTimer: number | null = null;
let started = false;
let needsGesture = false;
let snapshot: SyncUiStatus | null = null;

const idleConfig = (): SyncConfig => ({
  enabled: false,
  folderName: "",
  kind: "none",
  syncId: "",
  lastRev: 0,
  lastPushAt: null,
  lastPullAt: null,
  lastError: null,
  dirty: false,
  conflict: false,
});

function deviceId() {
  if (typeof localStorage === "undefined") return "dev";
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = uid("dev");
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

function readConfig(): SyncConfig {
  if (typeof localStorage === "undefined") return idleConfig();
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return idleConfig();
    const parsed = JSON.parse(raw) as Partial<SyncConfig>;
    return {
      ...idleConfig(),
      ...parsed,
      kind: parsed.kind === "fsa" || parsed.kind === "native" || parsed.kind === "opfs" ? parsed.kind : "none",
    };
  } catch {
    return idleConfig();
  }
}

function writeConfig(patch: Partial<SyncConfig>) {
  if (typeof localStorage === "undefined") return;
  const next = { ...readConfig(), ...patch };
  localStorage.setItem(CONFIG_KEY, JSON.stringify(next));
  emit();
}

function refreshSnapshot() {
  const next: SyncUiStatus = { ...readConfig(), busy, needsGesture };
  const prev = snapshot;
  if (
    prev &&
    prev.enabled === next.enabled &&
    prev.folderName === next.folderName &&
    prev.kind === next.kind &&
    prev.syncId === next.syncId &&
    prev.lastRev === next.lastRev &&
    prev.lastPushAt === next.lastPushAt &&
    prev.lastPullAt === next.lastPullAt &&
    prev.lastError === next.lastError &&
    prev.dirty === next.dirty &&
    prev.conflict === next.conflict &&
    prev.busy === next.busy &&
    prev.needsGesture === next.needsGesture
  ) {
    return;
  }
  snapshot = next;
}

function emit() {
  refreshSnapshot();
  for (const fn of listeners) fn();
}

export function getSyncStatus(): SyncUiStatus {
  refreshSnapshot();
  return snapshot ?? { ...idleConfig(), busy, needsGesture };
}

export function subscribeSync(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function syncPickerHint(): "native" | "fsa" | "blocked" {
  if (typeof window === "undefined") return "blocked";
  if (Capacitor.isNativePlatform()) return "native";
  if (canPickDriveFolder()) return "fsa";
  return "blocked";
}

export { canPickDriveFolder, canUseOpfs, SYNC_FILE_NAME };

function beginRemote() {
  applyingRemote = true;
}

function endRemote() {
  window.setTimeout(() => {
    applyingRemote = false;
  }, 50);
}

function markDirty() {
  if (applyingRemote) return;
  const cfg = readConfig();
  if (!cfg.enabled) return;
  if (!cfg.dirty) writeConfig({ dirty: true, conflict: false });
  schedulePush();
}

function schedulePush() {
  if (typeof window === "undefined") return;
  if (debounceTimer) window.clearTimeout(debounceTimer);
  debounceTimer = window.setTimeout(() => {
    void runSync({ reason: "dirty" });
  }, DEBOUNCE_MS);
}

export async function unlockDekFromBackup(env: BackupEnvelope, password: string) {
  for (const wrap of env.wraps ?? []) {
    if (!wrap.ct) continue;
    const dek = await unwrapDek(wrap, password);
    if (dek) return { dek, doctorId: wrap.doctorId, login: wrap.login };
  }
  if (env.recovery && parseRecoveryKey(password)) {
    const dek = await unwrapDek(env.recovery, recoverySecret(password));
    if (dek) return { dek, doctorId: env.wraps?.[0]?.doctorId ?? "", login: env.wraps?.[0]?.login ?? "" };
  }
  return null;
}

function adoptVault(env: BackupEnvelope) {
  const prev = readVault();
  const pub = prev ?? emptyVault({
    clinicName: useClinic.getState().settings.clinicName || "ClinicOS",
    welcomeName: useClinic.getState().settings.doctorName || "",
    welcomeMode: useClinic.getState().settings.welcomeMode === "custom" ? "custom" : "auto",
    welcomeText: useClinic.getState().settings.welcomeText || "",
  });
  writeVault({
    ...pub,
    wraps: env.wraps?.length ? env.wraps : pub.wraps,
    recovery: env.recovery ?? pub.recovery,
    requireLogin: prev?.requireLogin ?? true,
    clinicName: pub.clinicName,
  });
}

async function applyPreview(preview: ImportPreview, env: BackupEnvelope | undefined, dek: Uint8Array | undefined, opts?: { keepLocalPrefs?: boolean }) {
  const keepLogin = useClinic.getState().settings.requireLogin;
  const keepTheme = useClinic.getState().settings.theme;
  const merged = mergeExport(useClinic.getState(), preview.file, {
    replaceAll: true,
    defaultAction: "replace",
    patientActions: {},
    sections: allSectionIds(),
  });
  beginRemote();
  try {
    if (dek) setDek(dek);
    if (env) adoptVault(env);
    useClinic.getState().importSnapshot(merged.data);
    if (opts?.keepLocalPrefs) {
      useClinic.getState().updateSettings({ requireLogin: keepLogin, theme: keepTheme });
    }
    await clearAllPhotoBlobs();
    const blobMap = preview.file.photoBlobs ?? {};
    for (const [id, blob] of Object.entries(blobMap)) {
      await putPhotoBlob(id, blob);
    }
    for (const [id, dataUrl] of Object.entries(preview.file.photoFiles ?? {})) {
      if (blobMap[id]) continue;
      await putPhotoBlob(id, dataUrlToBlob(dataUrl));
    }
    await waitForPersistWrites();
  } finally {
    endRemote();
  }
}

function asFile(bytes: Uint8Array, name: string) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new File([copy], name);
}

function parseEnvelope(bytes: Uint8Array): BackupEnvelope | null {
  try {
    const json = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    return isBackupEnvelope(json) ? json : null;
  } catch {
    return null;
  }
}

async function pushNow() {
  const dek = getDek();
  if (!dek || !hasVault()) throw new Error("Кабинет ещё не защищён паролем — в папку можно писать только шифрованный файл.");
  const cfg = readConfig();
  const nextRev = Math.max(cfg.lastRev, 0) + 1;
  const { blob } = await buildBackupZip(useClinic.getState(), allSectionIds(), {
    syncId: cfg.syncId,
    syncRev: nextRev,
    deviceId: deviceId(),
  });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  await writeSyncFile(bytes);
  writeConfig({
    lastRev: nextRev,
    lastPushAt: new Date().toISOString(),
    lastError: null,
    dirty: false,
    conflict: false,
  });
}

async function pullNow(password?: string, opts?: { keepLocalPrefs?: boolean }) {
  const file = await readSyncFile();
  if (!file) throw new Error("В папке нет файла кабинета.");
  const env = parseEnvelope(file.bytes);
  const parsed = await parseBackupFile(asFile(file.bytes, SYNC_FILE_NAME), password);
  if (!parsed.ok) {
    if (parsed.needPassword) throw Object.assign(new Error(parsed.error), { needPassword: true });
    throw new Error(parsed.error);
  }
  let dek = getDek() ?? undefined;
  if (env && password && !dek) {
    const opened = await unlockDekFromBackup(env, password);
    dek = opened?.dek;
  }
  await applyPreview(parsed, env ?? parsed.envelope, dek, opts);
  const remoteRev = env?.syncRev ?? 1;
  const remoteId = env?.syncId;
  writeConfig({
    lastRev: remoteRev,
    lastPullAt: new Date().toISOString(),
    lastError: null,
    dirty: false,
    conflict: false,
    ...(remoteId ? { syncId: remoteId } : {}),
  });
}

export async function runSync(opts?: { reason?: string; force?: "push" | "pull"; password?: string; silent?: boolean }) {
  const cfg = readConfig();
  if (!cfg.enabled && !opts?.force) return { action: "noop" as const };
  if (busy) return { action: "busy" as const };
  if (!getDek() && opts?.force !== "pull") return { action: "locked" as const };
  busy = true;
  emit();
  try {
    if (await folderNeedsGesture()) {
      needsGesture = true;
      emit();
      return { action: "gesture" as const };
    }
    needsGesture = false;
    if (opts?.force === "push") {
      await pushNow();
      if (!opts.silent) toast.success("Копия записана в папку");
      return { action: "push" as const };
    }
    if (opts?.force === "pull") {
      await pullNow(opts.password, { keepLocalPrefs: cfg.lastRev > 0 });
      if (!opts.silent) toast.success("Взята копия из папки");
      return { action: "pull" as const };
    }
    const remote = await readSyncFile();
    const env = remote ? parseEnvelope(remote.bytes) : null;
    const action = decideSync({
      hasRemote: Boolean(remote),
      dirty: cfg.dirty,
      lastRev: cfg.lastRev,
      remoteRev: env?.syncRev ?? (remote ? 1 : null),
      localSyncId: cfg.syncId,
      remoteSyncId: env?.syncId,
      remoteDeviceId: env?.deviceId,
      localDeviceId: deviceId(),
    });
    if (action === "init" || action === "push") {
      await pushNow();
    } else if (action === "pull") {
      await pullNow(opts?.password, { keepLocalPrefs: cfg.lastRev > 0 });
    } else if (action === "conflict") {
      writeConfig({ conflict: true, lastError: null });
    } else {
      writeConfig({ lastError: null });
    }
    return { action };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Не удалось синхронизировать";
    writeConfig({ lastError: message });
    if (!opts?.silent) toast.error(message);
    return { action: "error" as const, error: message };
  } finally {
    busy = false;
    emit();
  }
}

export async function connectFolder(kind: "drive" | "opfs") {
  const picked = kind === "opfs" ? await pickOpfsFolder() : await pickDriveFolder();
  const local = useClinic.getState();
  const hasLocal = hasVault() && hasPasswordAccount(local.doctors);
  let syncId = readConfig().syncId;
  if (!syncId) syncId = uid("sync");
  writeConfig({
    enabled: true,
    folderName: picked.name,
    kind: picked.kind,
    syncId,
    lastError: null,
    conflict: false,
  });
  const remote = await readSyncFile();
  if (!remote) {
    if (!hasLocal || !getDek()) {
      await forgetFolder();
      writeConfig({ enabled: false, folderName: "", kind: "none" });
      return { status: "empty" as const, folderName: picked.name };
    }
    await pushNow();
    toast.success(`Файл ${SYNC_FILE_NAME} записан в «${picked.name}»`);
    return { status: "pushed" as const, folderName: picked.name };
  }
  if (!hasLocal) {
    return { status: "need-password" as const, folderName: picked.name };
  }
  const env = parseEnvelope(remote.bytes);
  const dek = getDek();
  if (env && dek) {
    try {
      await decryptBytes(dek, base64ToBytes(env.iv), base64ToBytes(env.ct));
      if (env.syncId) writeConfig({ syncId: env.syncId });
    } catch {
      writeConfig({ conflict: true });
      toast.message("В папке другой кабинет. Можно взять его вместо этого или выбрать другую папку.");
      return { status: "conflict" as const, folderName: picked.name };
    }
  }
  if (readConfig().lastRev === 0) {
    await pushNow();
    toast.success("Кабинет записан в папку");
    return { status: "pushed" as const, folderName: picked.name };
  }
  const result = await runSync({ silent: true });
  if (result.action === "conflict") {
    toast.message("В папке другая копия. Выберите, какую оставить.");
  } else if (result.action === "pull") {
    toast.success("Кабинет взят из папки");
  } else if (result.action === "push" || result.action === "init") {
    toast.success("Кабинет записан в папку");
  }
  return { status: result.action === "error" ? "error" : "connected", folderName: picked.name, ...result };
}

export async function openCabinetFromFolder(password: string) {
  if (savedFolderKind() === "none") {
    try {
      await connectFolder("drive");
    } catch (err) {
      const msg = String((err as { message?: string })?.message || err);
      if (msg.includes("canceled") || msg.includes("picker-unavailable")) {
        return { ok: false as const, error: "Выберите папку Google Диска. В этом окне браузер может не открыть выбор — откройте программу на телефоне или в Chrome." };
      }
      throw err;
    }
  }
  const remote = await readSyncFile();
  if (!remote) return { ok: false as const, error: "В папке нет файла ClinicOS-cabinet.denta. Сначала подключите папку на основном устройстве." };
  const env = parseEnvelope(remote.bytes);
  if (!env) return { ok: false as const, error: "Файл в папке не похож на зашифрованную копию кабинета." };
  const opened = await unlockDekFromBackup(env, password);
  if (!opened) return { ok: false as const, error: "Неверный пароль или ключ восстановления.", needPassword: true };
  setDek(opened.dek);
  const parsed = await parseBackupFile(asFile(remote.bytes, SYNC_FILE_NAME), password);
  if (!parsed.ok) return { ok: false as const, error: parsed.error, needPassword: parsed.needPassword };
  let syncId = env.syncId || readConfig().syncId || uid("sync");
  writeConfig({
    enabled: true,
    folderName: readConfig().folderName || "Папка",
    kind: savedFolderKind(),
    syncId,
    lastRev: env.syncRev ?? 1,
    lastPullAt: new Date().toISOString(),
    lastError: null,
    dirty: false,
    conflict: false,
  });
  await applyPreview(parsed, env, opened.dek, { keepLocalPrefs: false });
  const doctorId = opened.doctorId || useClinic.getState().doctors.find((d) => d.passwordHash)?.id || "";
  return { ok: true as const, doctorId };
}

export async function disconnectSync() {
  await forgetFolder();
  writeConfig(idleConfig());
}

export async function resolveConflict(choice: "local" | "remote") {
  writeConfig({ conflict: false, dirty: choice === "local" });
  if (choice === "local") await runSync({ force: "push" });
  else await runSync({ force: "pull" });
}

export function startSyncWatch() {
  if (started || typeof window === "undefined") return;
  started = true;
  void (async () => {
    const restored = await restoreFolder();
    if (restored && readConfig().enabled) {
      writeConfig({ folderName: restored.name, kind: restored.kind });
    }
    needsGesture = await folderNeedsGesture();
    emit();
    if (readConfig().enabled && getDek() && !needsGesture) void runSync({ silent: true });
  })();
  useClinic.subscribe(() => markDirty());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && readConfig().enabled) void runSync({ silent: true });
  });
  pullTimer = window.setInterval(() => {
    if (readConfig().enabled && !readConfig().conflict) void runSync({ silent: true });
  }, PULL_EVERY_MS);
}

export function formatSyncTime(iso: string | null) {
  if (!iso) return "ещё не было";
  try {
    return new Date(iso).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}
