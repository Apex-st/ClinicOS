import { bytesToBase64, base64ToBytes } from "./crypto";
import { vaultRequiresLogin } from "./vault";

const DEK_KEY = "denta-dek-v1";
const DEK_UNLOCK_KEY = "denta-dek-unlock-v1";

let dekMemory: Uint8Array | null = null;
let pendingRecovery: string | null = null;
const recoveryListeners = new Set<() => void>();

function canUseSession() {
  return typeof sessionStorage !== "undefined";
}

function canUseLocal() {
  return typeof localStorage !== "undefined";
}

export function setDek(raw: Uint8Array) {
  dekMemory = raw;
  if (!canUseSession()) return;
  try {
    sessionStorage.setItem(DEK_KEY, bytesToBase64(raw));
  } catch {
    /* quota */
  }
}

export function persistDekUnlock(raw: Uint8Array) {
  setDek(raw);
  if (!canUseLocal()) return;
  try {
    localStorage.setItem(DEK_UNLOCK_KEY, bytesToBase64(raw));
  } catch {
    /* quota */
  }
}

export function clearDekUnlock() {
  if (!canUseLocal()) return;
  try {
    localStorage.removeItem(DEK_UNLOCK_KEY);
  } catch {
    /* ignore */
  }
}

export function restoreDekUnlock(): Uint8Array | null {
  if (!canUseLocal()) return null;
  try {
    const raw = localStorage.getItem(DEK_UNLOCK_KEY);
    if (!raw) return null;
    const dek = base64ToBytes(raw);
    setDek(dek);
    return dek;
  } catch {
    return null;
  }
}

export function restoreDek(): Uint8Array | null {
  if (dekMemory) return dekMemory;
  if (canUseSession()) {
    try {
      const raw = sessionStorage.getItem(DEK_KEY);
      if (raw) {
        dekMemory = base64ToBytes(raw);
        return dekMemory;
      }
    } catch {
      /* ignore */
    }
  }
  if (!vaultRequiresLogin()) return restoreDekUnlock();
  return null;
}

export function getDek(): Uint8Array | null {
  return dekMemory ?? restoreDek();
}

export function hasDek() {
  return getDek() != null;
}

export function clearDek() {
  dekMemory = null;
  if (canUseSession()) {
    try {
      sessionStorage.removeItem(DEK_KEY);
    } catch {
      /* ignore */
    }
  }
}

export function maybePersistAutoUnlock() {
  if (vaultRequiresLogin()) return;
  const dek = getDek();
  if (dek) persistDekUnlock(dek);
}

export function setPendingRecoveryKey(key: string | null) {
  pendingRecovery = key;
  recoveryListeners.forEach((fn) => fn());
}

export function getPendingRecoveryKey() {
  return pendingRecovery;
}

export function subscribeRecoveryKey(fn: () => void) {
  recoveryListeners.add(fn);
  return () => {
    recoveryListeners.delete(fn);
  };
}
