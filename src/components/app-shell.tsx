import { Link, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  CalendarClock,
  CalendarDays,
  CircleDollarSign,
  ClipboardList,
  FileText,
  Images,
  LayoutGrid,
  LogOut,
  MoreHorizontal,
  Package,
  Percent,
  Settings,
  Users,
  Wallet,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { applyTheme } from "@/lib/theme";
import { shortName } from "@/lib/format";
import { useSession } from "@/lib/session";
import { useClinic } from "@/lib/store";
import { cn } from "@/lib/utils";
import { BackGesture } from "./back-gesture";
import { LockScreen } from "./lock-screen";
import { ReminderWatch } from "./reminder-watch";
import { Sheet, SheetContent, SheetTitle } from "./ui/sheet";

const NAV = [
  { to: "/", label: "Сегодня", icon: LayoutGrid },
  { to: "/schedule", label: "Расписание", icon: CalendarDays },
  { to: "/patients", label: "Пациенты", icon: Users },
  { to: "/finance", label: "Касса", icon: Wallet },
] as const;

const MORE = [
  { to: "/budget", label: "Бюджет", icon: CircleDollarSign },
  { to: "/stock", label: "Склад", icon: Package },
  { to: "/stats", label: "Статистика", icon: BarChart3 },
  { to: "/recall", label: "Повторно", icon: CalendarClock },
  { to: "/plans", label: "Планы", icon: FileText },
  { to: "/photos", label: "Фотоархив", icon: Images },
  { to: "/discounts", label: "Скидки", icon: Percent },
  { to: "/price", label: "Прайс", icon: ClipboardList },
  { to: "/settings", label: "Настройки", icon: Settings },
] as const;

function NavLink({
  to,
  label,
  icon: Icon,
  variant,
}: {
  to: string;
  label: string;
  icon: typeof LayoutGrid;
  variant: "rail" | "bottom" | "sheet";
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const active = to === "/" ? pathname === "/" : pathname === to || pathname.startsWith(`${to}/`);
  return (
    <Link
      to={to}
      className={cn(
        "flex items-center gap-3 rounded-md transition-colors duration-150",
        variant === "rail" &&
          cn(
            "h-11 px-3 text-sm text-rail-muted hover:bg-rail-fg/10 hover:text-rail-fg",
            active && "bg-rail-fg/10 text-rail-fg",
          ),
        variant === "bottom" &&
          cn(
            "min-h-12 flex-1 flex-col justify-center gap-0.5 text-[11px] text-muted",
            active && "text-primary",
          ),
        variant === "sheet" &&
          cn("h-12 px-3 text-sm text-ink hover:bg-surface-2", active && "bg-surface-2"),
      )}
    >
      <Icon className={cn("size-5", variant === "bottom" && "size-[22px]")} strokeWidth={1.7} />
      {label}
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [more, setMore] = useState(false);
  const settings = useClinic((s) => s.settings);
  const doctors = useClinic((s) => s.doctors);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const theme = settings.theme ?? "light";
  const doctorId = useSession((s) => s.doctorId);
  const logout = useSession((s) => s.logout);
  const hydrate = useSession((s) => s.hydrate);
  const current = doctors.find((d) => d.id === doctorId);
  const doctorLabel = current ? shortName(current) : settings.doctorName;

  useEffect(() => {
    hydrate();
    let done = false;
    const started = Date.now();
    const mark = () => {
      if (done) return;
      done = true;
      const wait = Math.max(0, 900 - (Date.now() - started));
      window.setTimeout(() => document.documentElement.classList.add("denta-ready"), wait);
    };
    if (useClinic.persist.hasHydrated()) mark();
    const unsub = useClinic.persist.onFinishHydration(mark);
    void useClinic.persist.rehydrate();
    const fallback = window.setTimeout(mark, 1200);
    return () => {
      unsub();
      window.clearTimeout(fallback);
    };
  }, [hydrate]);

  useEffect(() => {
    applyTheme(theme);
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  useEffect(() => {
    setMore(false);
  }, [pathname]);

  if (settings.requireLogin && !doctorId) {
    return <LockScreen />;
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-bg">
      <BackGesture />
      <ReminderWatch />
      <aside className="hidden h-full w-56 shrink-0 flex-col overflow-y-auto bg-rail px-3 py-5 md:flex">
        <div className="px-3 pb-6">
          <p className="font-display text-2xl text-rail-fg">{settings.clinicName}</p>
          <p className="mt-1 text-[12px] text-rail-muted">Кабинет врача</p>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5">
          {NAV.map((item) => (
            <NavLink key={item.to} {...item} variant="rail" />
          ))}
          <div className="my-3 h-px bg-rail-fg/10" />
          {MORE.map((item) => (
            <NavLink key={item.to} {...item} variant="rail" />
          ))}
        </nav>
        <div className="flex items-center justify-between px-3 pt-4">
          <div>
            <p className="text-[12px] text-rail-muted">Врач</p>
            <p className="text-sm text-rail-fg">{doctorLabel}</p>
          </div>
          {settings.requireLogin ? (
            <button
              type="button"
              onClick={logout}
              className="grid size-9 place-items-center rounded-md text-rail-muted hover:bg-rail-fg/10 hover:text-rail-fg"
              aria-label="Выйти"
            >
              <LogOut className="size-4" />
            </button>
          ) : null}
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
        {pathname === "/" ? (
          <header className="flex items-center justify-between px-4 py-3 md:hidden">
            <div>
              <p className="font-display text-xl text-ink">{settings.clinicName}</p>
              <p className="text-[12px] text-muted">{doctorLabel}</p>
            </div>
          </header>
        ) : null}
        <main
          className={cn(
            "mx-auto w-full max-w-6xl flex-1 px-4 pb-24 md:px-8 md:pb-10 md:pt-8",
            pathname === "/" ? "pt-1" : "pt-4",
          )}
        >
          {children}
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden">
        {NAV.map((item) => (
          <NavLink key={item.to} {...item} variant="bottom" />
        ))}
        <button
          type="button"
          onClick={() => setMore(true)}
          className={cn(
            "flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] text-muted",
            (pathname === "/price" ||
              pathname === "/settings" ||
              pathname === "/recall" ||
              pathname === "/plans" ||
              pathname === "/photos" ||
              pathname === "/discounts" ||
              pathname === "/stats" ||
              pathname === "/budget" ||
              pathname === "/stock") && "text-primary",
          )}
        >
          <MoreHorizontal className="size-[22px]" strokeWidth={1.7} />
          Ещё
        </button>
      </nav>

      <Sheet open={more} onOpenChange={setMore}>
        <SheetContent>
          <SheetTitle className="mb-3">Ещё</SheetTitle>
          <div className="flex flex-col gap-1">
            {MORE.map((item) => (
              <NavLink key={item.to} {...item} variant="sheet" />
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
