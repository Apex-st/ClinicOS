import { greetingDoctorName, todayHeadline } from "./format";

export function readBootGreeting() {
  try {
    const clinic = JSON.parse(localStorage.getItem("denta-clinic-v1") || "{}") as {
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
