import { greetingDoctorName, todayHeadline } from "./format";

function readVaultPublic() {
  try {
    const vault = JSON.parse(localStorage.getItem("denta-vault-v1") || "null") as {
      kind?: string;
      clinicName?: string;
      welcomeName?: string;
      welcomeMode?: "auto" | "custom";
      welcomeText?: string;
    } | null;
    if (vault?.kind !== "denta-vault") return null;
    return vault;
  } catch {
    return null;
  }
}

export function readBootGreeting() {
  try {
    const vault = readVaultPublic();
    const clinic = JSON.parse(localStorage.getItem("denta-clinic-v1") || "{}") as {
      kind?: string;
      state?: {
        settings?: {
          doctorName?: string;
          welcomeMode?: "auto" | "custom";
          welcomeText?: string;
          welcomeDoctorId?: string;
        };
        doctors?: Array<{
          id: string;
          lastName: string;
          firstName: string;
          middleName: string;
          active?: boolean;
        }>;
      };
      settings?: {
        doctorName?: string;
        welcomeMode?: "auto" | "custom";
        welcomeText?: string;
        welcomeDoctorId?: string;
      };
      doctors?: Array<{
        id: string;
        lastName: string;
        firstName: string;
        middleName: string;
        active?: boolean;
      }>;
    };
    if (clinic.kind === "denta-clinic-enc" || vault) {
      const fio = (vault?.welcomeName || "").trim();
      const custom = (vault?.welcomeText || "").trim();
      if (vault?.welcomeMode === "custom" && custom) {
        return todayHeadline(
          { doctorName: fio, welcomeMode: "custom", welcomeText: custom },
          fio,
        );
      }
      return todayHeadline({ doctorName: fio, welcomeMode: "auto", welcomeText: "" }, fio);
    }
    const st = clinic.state || clinic;
    const settings = {
      doctorName: st.settings?.doctorName || "",
      welcomeMode: st.settings?.welcomeMode === "custom" ? "custom" as const : "auto" as const,
      welcomeText: st.settings?.welcomeText || "",
      welcomeDoctorId: st.settings?.welcomeDoctorId || "",
    };
    const doctors = st.doctors || [];
    let sessionDoctorId: string | null = null;
    try {
      const raw = sessionStorage.getItem("denta-session-v1");
      sessionDoctorId = raw ? (JSON.parse(raw) as { doctorId?: string }).doctorId ?? null : null;
    } catch {
      sessionDoctorId = null;
    }
    return todayHeadline(settings, greetingDoctorName(settings, doctors, sessionDoctorId));
  } catch {
    return todayHeadline({ doctorName: "", welcomeMode: "auto", welcomeText: "" });
  }
}

export function applyBootGreeting() {
  if (typeof document === "undefined") return;
  const node = document.getElementById("denta-boot-text");
  if (node) node.textContent = readBootGreeting();
}
