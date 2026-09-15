import { wrapDek, unwrapDek, type KeyWrap } from "./crypto";

export const VAULT_KEY = "denta-vault-v1";
export const CLINIC_PERSIST_KEY = "denta-clinic-v1";
export const PERSIST_ENC_KIND = "denta-clinic-enc";
export const BACKUP_ENC_KIND = "denta-backup-enc";

export type VaultWrap = KeyWrap & {
  doctorId: string;
  login: string;
};

export type VaultPublic = {
  clinicName: string;
  welcomeName: string;
  welcomeMode: "auto" | "custom";
  welcomeText: string;
};

export type VaultFile = VaultPublic & {
  kind: "denta-vault";
  v: 1;
  wraps: VaultWrap[];
  recovery: KeyWrap | null;
  createdAt: string;
  /** false — кабинет открывается без пароля на этом устройстве. */
  requireLogin?: boolean;
};

export type PersistEnvelope = {
  kind: typeof PERSIST_ENC_KIND;
  v: 1;
  iv: string;
  ct: string;
};

export type BackupEnvelope = {
  kind: typeof BACKUP_ENC_KIND;
  v: 1;
  appVersion: string;
  exportedAt: string;
  wraps: VaultWrap[];
  recovery: KeyWrap | null;
  iv: string;
  ct: string;
  /** Общая папка: какой кабинет и какая ревизия файла. */
  syncId?: string;
  syncRev?: number;
  deviceId?: string;
};

function canUseStorage() {
  return typeof localStorage !== "undefined";
}

export function readVault(): VaultFile | null {
  if (!canUseStorage()) return null;
  try {
    const raw = localStorage.getItem(VAULT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as VaultFile;
    if (parsed?.kind !== "denta-vault" || !Array.isArray(parsed.wraps)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeVault(vault: VaultFile) {
  if (!canUseStorage()) return;
  localStorage.setItem(VAULT_KEY, JSON.stringify(vault));
}

export function hasVault() {
  return readVault() != null;
}

export function vaultRequiresLogin() {
  const vault = readVault();
  if (!vault) return false;
  return vault.requireLogin !== false;
}

export function isPersistEncrypted(name = CLINIC_PERSIST_KEY) {
  if (!canUseStorage()) return false;
  try {
    const raw = localStorage.getItem(name);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { kind?: string };
    return parsed?.kind === PERSIST_ENC_KIND;
  } catch {
    return false;
  }
}

export function isEncryptedEnvelope(value: unknown): value is PersistEnvelope {
  return Boolean(value && typeof value === "object" && (value as PersistEnvelope).kind === PERSIST_ENC_KIND);
}

export function isBackupEnvelope(value: unknown): value is BackupEnvelope {
  return Boolean(value && typeof value === "object" && (value as BackupEnvelope).kind === BACKUP_ENC_KIND);
}

export function emptyVault(pub: VaultPublic): VaultFile {
  return {
    kind: "denta-vault",
    v: 1,
    wraps: [],
    recovery: null,
    createdAt: new Date().toISOString(),
    requireLogin: true,
    clinicName: pub.clinicName || "ClinicOS",
    welcomeName: pub.welcomeName || "",
    welcomeMode: pub.welcomeMode === "custom" ? "custom" : "auto",
    welcomeText: pub.welcomeText || "",
  };
}

export function patchVaultPublic(patch: Partial<VaultPublic>) {
  const vault = readVault();
  if (!vault) return;
  writeVault({
    ...vault,
    clinicName: patch.clinicName ?? vault.clinicName,
    welcomeName: patch.welcomeName ?? vault.welcomeName,
    welcomeMode: patch.welcomeMode === "custom" || patch.welcomeMode === "auto" ? patch.welcomeMode : vault.welcomeMode,
    welcomeText: patch.welcomeText ?? vault.welcomeText,
  });
}

export function patchVaultRequireLogin(on: boolean) {
  const vault = readVault();
  if (!vault) return;
  writeVault({ ...vault, requireLogin: on });
}

export function upsertVaultWrap(wrap: VaultWrap) {
  const vault = readVault();
  if (!vault) return;
  const rest = vault.wraps.filter((w) => w.doctorId !== wrap.doctorId);
  writeVault({ ...vault, wraps: [...rest, wrap] });
}

export function patchVaultLogin(doctorId: string, login: string) {
  const vault = readVault();
  if (!vault) return;
  writeVault({
    ...vault,
    wraps: vault.wraps.map((w) => (w.doctorId === doctorId ? { ...w, login } : w)),
  });
}

export function removeVaultWrap(doctorId: string) {
  const vault = readVault();
  if (!vault) return;
  writeVault({ ...vault, wraps: vault.wraps.filter((w) => w.doctorId !== doctorId) });
}

export function findVaultWrap(login: string): VaultWrap | undefined {
  const vault = readVault();
  const q = login.trim().toLowerCase();
  return vault?.wraps.find((w) => w.login.trim().toLowerCase() === q);
}

export async function makeDoctorWrap(
  dek: Uint8Array,
  doctorId: string,
  login: string,
  password: string,
): Promise<VaultWrap> {
  const wrap = await wrapDek(dek, password);
  return { ...wrap, doctorId, login };
}

export async function openWrap(wrap: VaultWrap, password: string): Promise<Uint8Array | null> {
  if (!wrap.ct) return null;
  return unwrapDek(wrap, password);
}
