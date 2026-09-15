import { useEffect } from "react";
import { startSyncWatch } from "@/lib/clinic-sync";

export function SyncWatch() {
  useEffect(() => {
    startSyncWatch();
  }, []);
  return null;
}
