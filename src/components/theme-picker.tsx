import { Monitor, Moon, Sun } from "lucide-react";
import { applyTheme, type ThemeMode } from "@/lib/theme";
import { useClinic } from "@/lib/store";
import { cn } from "@/lib/utils";

const OPTIONS: Array<{ id: ThemeMode; label: string; icon: typeof Sun }> = [
  { id: "light", label: "Светлая", icon: Sun },
  { id: "dark", label: "Тёмная", icon: Moon },
  { id: "system", label: "Как в системе", icon: Monitor },
];

export function ThemePicker() {
  const theme = useClinic((s) => s.settings.theme ?? "light");
  const updateSettings = useClinic((s) => s.updateSettings);

  function setTheme(next: ThemeMode) {
    updateSettings({ theme: next });
    applyTheme(next);
  }

  return (
    <div className="grid grid-cols-3 gap-1 rounded-lg bg-surface-2 p-1">
      {OPTIONS.map(({ id, label, icon: Icon }) => {
        const active = theme === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => setTheme(id)}
            className={cn(
              "flex min-h-11 flex-col items-center justify-center gap-1 rounded-md px-2 py-2 text-[12px] font-medium transition-colors",
              active ? "bg-surface text-ink shadow-[var(--shadow-card)]" : "text-muted hover:text-ink",
            )}
          >
            <Icon className="size-4" strokeWidth={1.7} />
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function ThemeToggle({ variant = "rail" }: { variant?: "rail" | "header" }) {
  const theme = useClinic((s) => s.settings.theme ?? "light");
  const updateSettings = useClinic((s) => s.updateSettings);
  const resolved =
    theme === "system"
      ? typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : theme;

  function toggle() {
    const next: ThemeMode = resolved === "dark" ? "light" : "dark";
    updateSettings({ theme: next });
    applyTheme(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className={cn(
        "grid size-11 place-items-center rounded-md transition-colors",
        variant === "rail" && "text-rail-muted hover:bg-rail-fg/10 hover:text-rail-fg",
        variant === "header" && "text-muted hover:bg-surface-2 hover:text-ink",
      )}
      aria-label={resolved === "dark" ? "Включить светлую тему" : "Включить тёмную тему"}
    >
      {resolved === "dark" ? <Sun className="size-5" strokeWidth={1.7} /> : <Moon className="size-5" strokeWidth={1.7} />}
    </button>
  );
}
