import type { PersistStorage, StorageValue } from "zustand/middleware";
import { decryptJson, encryptJson } from "./crypto";
import { getDek, hasDek, clearDek } from "./crypto-session";
import {
  CLINIC_PERSIST_KEY,
  hasVault,
  isEncryptedEnvelope,
  isPersistEncrypted,
  patchVaultPublic,
  type PersistEnvelope,
} from "./vault";

let writeChain: Promise<void> = Promise.resolve();

function enqueue(job: () => Promise<void>) {
  const next = writeChain.then(job, job);
  writeChain = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

export function waitForPersistWrites() {
  return writeChain;
}

function syncPublic(value: StorageValue<unknown>) {
  const state = value?.state as
    | {
        settings?: {
          clinicName?: string;
          doctorName?: string;
          welcomeMode?: "auto" | "custom";
          welcomeText?: string;
        };
        doctors?: Array<{ lastName?: string; firstName?: string; middleName?: string; active?: boolean }>;
      }
    | undefined;
  if (!state?.settings || !hasVault()) return;
  const doc = (state.doctors ?? []).find((d) => d.active !== false) ?? state.doctors?.[0];
  const welcomeName =
    state.settings.doctorName ||
    [doc?.lastName, doc?.firstName, doc?.middleName].filter(Boolean).join(" ");
  patchVaultPublic({
    clinicName: state.settings.clinicName || "ClinicOS",
    welcomeName,
    welcomeMode: state.settings.welcomeMode === "custom" ? "custom" : "auto",
    welcomeText: state.settings.welcomeText || "",
  });
}

export const securePersistStorage: PersistStorage<unknown> = {
  getItem: async (name) => {
    if (typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem(name);
    if (!raw) return null;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return null;
    }
    if (isEncryptedEnvelope(parsed)) {
      const dek = getDek();
      if (!dek) return null;
      try {
        return await decryptJson<StorageValue<unknown>>(dek, parsed.iv, parsed.ct);
      } catch {
        clearDek();
        throw new Error("decrypt-failed");
      }
    }
    return parsed as StorageValue<unknown>;
  },
  setItem: (name, value) => {
    return enqueue(async () => {
      if (typeof localStorage === "undefined") return;
      const mustEncrypt = hasVault() || isPersistEncrypted(name);
      if (mustEncrypt) {
        const dek = getDek();
        if (!dek) return;
        try {
          const { iv, ct } = await encryptJson(dek, value);
          const env: PersistEnvelope = { kind: "denta-clinic-enc", v: 1, iv, ct };
          localStorage.setItem(name, JSON.stringify(env));
          syncPublic(value as StorageValue<unknown>);
        } catch {
          /* keep previous blob */
        }
        return;
      }
      localStorage.setItem(name, JSON.stringify(value));
    });
  },
  removeItem: (name) => {
    if (typeof localStorage === "undefined") return;
    localStorage.removeItem(name);
  },
};

export { CLINIC_PERSIST_KEY };
export { hasDek };
