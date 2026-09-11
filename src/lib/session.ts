import { create } from "zustand";

const KEY = "denta-session-v1";

interface SessionState {
  doctorId: string | null;
  login: (doctorId: string) => void;
  logout: () => void;
  hydrate: () => void;
}

export const useSession = create<SessionState>((set) => ({
  doctorId: null,
  login: (doctorId) => {
    try {
      sessionStorage.setItem(KEY, JSON.stringify({ doctorId }));
    } catch {
      /* ignore */
    }
    set({ doctorId });
  },
  logout: () => {
    try {
      sessionStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    set({ doctorId: null });
  },
  hydrate: () => {
    try {
      const raw = sessionStorage.getItem(KEY);
      const doctorId = raw ? (JSON.parse(raw) as { doctorId?: string }).doctorId ?? null : null;
      set({ doctorId });
    } catch {
      set({ doctorId: null });
    }
  },
}));
