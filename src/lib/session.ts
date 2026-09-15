import { create } from "zustand";
import { clearDek, clearDekUnlock } from "./crypto-session";
import { vaultRequiresLogin } from "./vault";

const KEY = "denta-session-v1";
export const AUTO_SESSION_KEY = "denta-session-auto-v1";

function readStored(store: Storage, name: string): string | null {
  try {
    const raw = store.getItem(name);
    return raw ? (JSON.parse(raw) as { doctorId?: string }).doctorId ?? null : null;
  } catch {
    return null;
  }
}

function writeStored(store: Storage, name: string, doctorId: string) {
  try {
    store.setItem(name, JSON.stringify({ doctorId }));
  } catch {
    /* ignore */
  }
}

interface SessionState {
  doctorId: string | null;
  login: (doctorId: string) => void;
  logout: () => void;
  hydrate: () => void;
}

export const useSession = create<SessionState>((set) => ({
  doctorId: null,
  login: (doctorId) => {
    if (typeof sessionStorage !== "undefined") writeStored(sessionStorage, KEY, doctorId);
    if (typeof localStorage !== "undefined" && !vaultRequiresLogin()) {
      writeStored(localStorage, AUTO_SESSION_KEY, doctorId);
    }
    set({ doctorId });
  },
  logout: () => {
    clearDek();
    clearDekUnlock();
    try {
      sessionStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    try {
      localStorage.removeItem(AUTO_SESSION_KEY);
    } catch {
      /* ignore */
    }
    set({ doctorId: null });
  },
  hydrate: () => {
    try {
      let doctorId = typeof sessionStorage !== "undefined" ? readStored(sessionStorage, KEY) : null;
      if (!doctorId && typeof localStorage !== "undefined" && !vaultRequiresLogin()) {
        doctorId = readStored(localStorage, AUTO_SESSION_KEY);
      }
      set({ doctorId });
    } catch {
      set({ doctorId: null });
    }
  },
}));
