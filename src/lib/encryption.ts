import {
  cryptoAvailable,
  formatRecoveryKey,
  parseRecoveryKey,
  randomBytes,
  recoverySecret,
  RECOVERY_BYTES,
  unwrapDek,
  wrapDek,
} from "./crypto";
import { clearDek, getDek, setDek, setPendingRecoveryKey } from "./crypto-session";
import { encryptAllPlainPhotos } from "./photos-idb";
import { waitForPersistWrites } from "./secure-storage";
import { useClinic } from "./store";
import {
  emptyVault,
  findVaultWrap,
  hasVault,
  makeDoctorWrap,
  readVault,
  upsertVaultWrap,
  writeVault,
  type VaultPublic,
} from "./vault";

export type UnlockFail = "bad" | "no-wrap" | "no-crypto";

function pubFromState(): VaultPublic {
  const s = useClinic.getState();
  return {
    clinicName: s.settings.clinicName || "ClinicOS",
    welcomeName: s.settings.doctorName || "",
    welcomeMode: s.settings.welcomeMode === "custom" ? "custom" : "auto",
    welcomeText: s.settings.welcomeText || "",
  };
}

async function flushClinic() {
  useClinic.setState((s) => ({
    settings: { ...s.settings, requireLogin: true },
  }));
  await Promise.resolve();
  await waitForPersistWrites();
}

export async function enableEncryption(opts: {
  doctorId: string;
  login: string;
  password: string;
  clinicName?: string;
  welcomeName?: string;
}): Promise<string> {
  if (!cryptoAvailable()) throw new Error("no-crypto");
  const dek = randomBytes(32);
  const recoveryBytes = randomBytes(RECOVERY_BYTES);
  const recoveryKey = formatRecoveryKey(recoveryBytes);
  const doctorWrap = await makeDoctorWrap(dek, opts.doctorId, opts.login, opts.password);
  const recovery = await wrapDek(dek, recoverySecret(recoveryKey));
  const pub = pubFromState();
  const vault = emptyVault({
    ...pub,
    clinicName: opts.clinicName || pub.clinicName,
    welcomeName: opts.welcomeName || pub.welcomeName,
  });
  const state = useClinic.getState();
  const extra = (state.doctors ?? [])
    .filter((d) => d.id !== opts.doctorId && d.login)
    .map((d) => ({
      doctorId: d.id,
      login: d.login,
      kdf: "pbkdf2" as const,
      iter: 0,
      salt: "",
      iv: "",
      ct: "",
    }));
  vault.wraps = [doctorWrap, ...extra];
  vault.recovery = recovery;
  writeVault(vault);
  setDek(dek);
  await encryptAllPlainPhotos();
  await flushClinic();
  setPendingRecoveryKey(recoveryKey);
  return recoveryKey;
}

export async function migrateToEncryptionIfNeeded(opts: {
  doctorId: string;
  login: string;
  password: string;
}): Promise<string | null> {
  if (hasVault()) return null;
  return enableEncryption(opts);
}

export async function wrapDoctorPassword(doctorId: string, login: string, password: string) {
  const dek = getDek();
  if (!dek || !hasVault()) return;
  const wrap = await makeDoctorWrap(dek, doctorId, login, password);
  upsertVaultWrap(wrap);
}

export async function unlockWithPassword(
  login: string,
  password: string,
): Promise<{ doctorId: string } | { fail: UnlockFail }> {
  if (!cryptoAvailable()) return { fail: "no-crypto" };
  const wrap = findVaultWrap(login);
  if (!wrap) return { fail: "bad" };
  if (!wrap.ct) return { fail: "no-wrap" };
  const dek = await unwrapDek(wrap, password);
  if (!dek) return { fail: "bad" };
  setDek(dek);
  return { doctorId: wrap.doctorId };
}

export async function unlockWithRecovery(
  key: string,
): Promise<{ doctorId: string } | { fail: UnlockFail }> {
  if (!cryptoAvailable()) return { fail: "no-crypto" };
  const parsed = parseRecoveryKey(key);
  if (!parsed) return { fail: "bad" };
  const vault = readVault();
  if (!vault?.recovery) return { fail: "bad" };
  const dek = await unwrapDek(vault.recovery, recoverySecret(key));
  if (!dek) return { fail: "bad" };
  setDek(dek);
  const first = vault.wraps.find((w) => w.ct) ?? vault.wraps[0];
  return { doctorId: first?.doctorId || "" };
}

export async function rotateRecoveryKey(): Promise<string> {
  const dek = getDek();
  if (!dek) throw new Error("no-dek");
  const vault = readVault();
  if (!vault) throw new Error("no-vault");
  const recoveryBytes = randomBytes(RECOVERY_BYTES);
  const recoveryKey = formatRecoveryKey(recoveryBytes);
  vault.recovery = await wrapDek(dek, recoverySecret(recoveryKey));
  writeVault(vault);
  setPendingRecoveryKey(recoveryKey);
  return recoveryKey;
}

export function lockCabinet() {
  clearDek();
}
