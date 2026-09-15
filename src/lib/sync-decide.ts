export type SyncAction = "noop" | "push" | "pull" | "conflict" | "init";

export type SyncDecideInput = {
  hasRemote: boolean;
  dirty: boolean;
  lastRev: number;
  remoteRev: number | null;
  localSyncId: string;
  remoteSyncId?: string;
  remoteDeviceId?: string;
  localDeviceId: string;
};

/** Чья копия главнее. Без доступа к диску и без шифрования. */
export function decideSync(input: SyncDecideInput): SyncAction {
  if (!input.hasRemote) return "init";
  const remoteRev = input.remoteRev ?? 0;
  const foreign = Boolean(input.remoteSyncId && input.remoteSyncId !== input.localSyncId);
  if (foreign && input.lastRev > 0) return "conflict";
  if (foreign && input.lastRev === 0) return "pull";
  if (input.remoteDeviceId === input.localDeviceId && remoteRev === input.lastRev && !input.dirty) {
    return "noop";
  }
  if (remoteRev > input.lastRev && input.dirty) return "conflict";
  if (remoteRev > input.lastRev) return "pull";
  if (input.dirty) return "push";
  if (remoteRev < input.lastRev) return "push";
  return "noop";
}
