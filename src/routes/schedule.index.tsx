import { createFileRoute, useRouter } from "@tanstack/react-router";
import {
  addDays,
  addMonths,
  addYears,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  getYear,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ru } from "date-fns/locale";
import { Lock, LockOpen, UnfoldVertical, FoldVertical } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { toast } from "sonner";
import { CalendarImportDialog } from "@/components/calendar-import";
import { DateJump } from "@/components/date-jump";
import { MovableFab } from "@/components/movable-fab";
import { PeriodSwitch } from "@/components/period-switch";
import { dayAppointments, isBlocking, slotTaken } from "@/lib/clinic";
import { suggestVisitKind, VISIT_KIND_LABEL } from "@/lib/diary";
import { fromMinutes, fullName, minutesOf, shortName, todayISO } from "@/lib/format";
import { useSession } from "@/lib/session";
import {
  appointmentEditPath,
  appointmentNewPath,
  dayFill,
  fillCaption,
  fillStyle,
  loadScheduleView,
  saveScheduleView,
  snapMinutes,
  busyTimes,
  compactIndex,
  compactSpan,
  type ScheduleScale,
  SCHEDULE_SCALES,
  scheduleLayout,
} from "@/lib/schedule";
import { clampMiniDock, defaultMiniDock, loadMiniDock, saveMiniDock, MINI_SIZE } from "@/lib/mini-month-dock";
import { useClinic } from "@/lib/store";
import { splitSyllables } from "@/lib/syllables";
import type { Appointment } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useApptDrag } from "@/lib/use-appt-drag";
import { useApptResize } from "@/lib/use-appt-resize";
import { usePeriodSwipe } from "@/lib/use-period-swipe";
import { usePinchZoom } from "@/lib/use-pinch-zoom";
import { useTimeSqueeze } from "@/lib/use-time-squeeze";

export const Route = createFileRoute("/schedule/")({ component: SchedulePage });

function SchedulePage() {
  const router = useRouter();
  const saved = useMemo(() => loadScheduleView(), []);
  const [date, setDate] = useState(saved.date);
  const [scale, setScale] = useState<ScheduleScale>(saved.scale);
  const [doctorFilter, setDoctorFilter] = useState<string>(saved.doctorFilter);
  const [monthZoom, setMonthZoom] = useState(saved.monthZoom);
  const [yearZoom, setYearZoom] = useState(saved.yearZoom);
  const [dragLocked, setDragLocked] = useState(saved.dragLocked);
  const [timeCompact, setTimeCompact] = useState<boolean | null>(saved.timeCompact);
  const [fabOpen, setFabOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [miniOpen, setMiniOpen] = useState(false);
  const busy = useRef(false);

  const settings = useClinic((s) => s.settings);
  const appointments = useClinic((s) => s.appointments);
  const doctors = useClinic((s) => s.doctors);
  const updateAppointment = useClinic((s) => s.updateAppointment);
  const sessionDoctor = useSession((s) => s.doctorId);

  useEffect(() => {
    saveScheduleView({ date, scale, doctorFilter, monthZoom, yearZoom, dragLocked, timeCompact });
  }, [date, scale, doctorFilter, monthZoom, yearZoom, dragLocked, timeCompact]);

  const day = parseISO(date);
  const weekStart = startOfWeek(day, { weekStartsOn: 1 });
  const week = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const visible = useMemo(() => {
    if (doctorFilter === "all") return appointments;
    return appointments.filter((a) => a.doctorId === doctorFilter);
  }, [appointments, doctorFilter]);

  function setBusy(v: boolean) {
    busy.current = v;
  }

  function book(iso: string, start: string, doctorId?: string) {
    router.history.push(
      appointmentNewPath({
        date: iso,
        start,
        doctorId: doctorId || sessionDoctor || doctors[0]?.id,
      }),
    );
  }

  function openAppt(a: Appointment) {
    router.history.push(appointmentEditPath(a.id));
  }

  function pickDay(iso: string) {
    setDate(iso);
    setScale("day");
  }

  function moveAppt(a: Appointment, nextDate: string, nextTime?: string) {
    const start = nextTime ?? a.start;
    if (a.date === nextDate && a.start === start) return;
    if (slotTaken(appointments, nextDate, start, a.durationMin, a.id)) {
      toast.error("Это время уже занято");
      return;
    }
    updateAppointment(a.id, { date: nextDate, start });
    toast.success(`Перенесено на ${start}`);
  }

  function resizeAppt(a: Appointment, next: { startMin: number; durationMin: number }) {
    const durationMin = snapMinutes(next.durationMin, settings.slotMinutes || 30);
    const start = fromMinutes(next.startMin);
    if (start === a.start && durationMin === a.durationMin) return;
    if (slotTaken(appointments, a.date, start, durationMin, a.id)) {
      toast.error("Так запись пересечётся с другой");
      return;
    }
    updateAppointment(a.id, { start, durationMin });
    toast.success(`${start} · ${durationMin} мин`);
  }

  function shift(dir: number) {
    if (scale === "day") setDate(format(addDays(day, dir), "yyyy-MM-dd"));
    else if (scale === "week") setDate(format(addDays(day, dir * 7), "yyyy-MM-dd"));
    else if (scale === "month") setDate(format(addMonths(day, dir), "yyyy-MM-dd"));
    else setDate(format(addYears(day, dir), "yyyy-MM-dd"));
  }

  const swipe = usePeriodSwipe((dir) => shift(dir), {
    busy: () => busy.current,
    enabled: () =>
      !((scale === "month" && monthZoom > 1.05) || (scale === "year" && yearZoom > 1.05)),
  });

  const fillToday = dayFill(visible, settings.workHours, date);
  const layout = scheduleLayout(settings);
  const dayListLen = dayAppointments(visible, date).filter((a) => a.status !== "cancelled").length;
  const weekListLen = visible.filter((a) => {
    if (a.status === "cancelled") return false;
    return week.some((d) => format(d, "yyyy-MM-dd") === a.date);
  }).length;
  const compactNow =
    timeCompact ?? (scale === "week" ? weekListLen > 0 : scale === "day" ? dayListLen > 0 : false);

  const title =
    scale === "day"
      ? format(day, "d MMMM yyyy, EEEE", { locale: ru })
      : scale === "week"
        ? `${format(weekStart, "d MMM", { locale: ru })} — ${format(addDays(weekStart, 6), "d MMM yyyy", { locale: ru })}`
        : scale === "month"
          ? format(day, "LLLL yyyy", { locale: ru })
          : format(day, "yyyy", { locale: ru });

  return (
    <div
      className={cn(
        "relative flex flex-col gap-3",
        scale === "year"
          ? "h-[calc(100svh-9.5rem)] overflow-hidden pb-2 md:h-[calc(100svh-5rem)]"
          : "min-h-[calc(100svh-9.5rem)] pb-16 md:min-h-[calc(100svh-5rem)] md:pb-8",
      )}
    >
      <header className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <DateJump value={date} onChange={setDate} compact label={title} className="min-w-0 max-w-[min(100%,16rem)]" />
        {scale === "day" && layout.occupancy && fillToday.used > 0 && !fillToday.off ? (
          <p className="shrink-0 text-[11px] tabular-nums text-muted">{fillToday.pct}%</p>
        ) : null}
        <button type="button" className="shrink-0 text-[12px] text-primary" onClick={() => setDate(todayISO())}>
          Сегодня
        </button>
        <PeriodSwitch value={scale} onChange={setScale} options={SCHEDULE_SCALES} compact className="min-w-[13rem] flex-1" />
      </header>

      {doctors.length > 1 ? (
        <div className="flex flex-wrap gap-1">
          <FilterChip active={doctorFilter === "all"} onClick={() => setDoctorFilter("all")} label="Все" />
          {doctors
            .filter((d) => d.active)
            .map((d) => (
              <FilterChip
                key={d.id}
                active={doctorFilter === d.id}
                onClick={() => setDoctorFilter(d.id)}
                label={shortName(d)}
                color={d.color}
              />
            ))}
        </div>
      ) : null}

      <div className={cn("relative min-h-0", scale === "year" && "min-h-0 flex-1 overflow-hidden")}>
        <div className="cal-live" {...swipe}>
        {scale === "day" ? (
          <DayView
            date={date}
            appointments={visible}
            compactUser={timeCompact}
            onCompact={setTimeCompact}
            onBook={(start) => book(date, start)}
            onOpen={openAppt}
            onMove={moveAppt}
            onResize={resizeAppt}
            onBusy={setBusy}
          />
        ) : null}
        {scale === "week" ? (
          <WeekView
            week={week}
            date={date}
            appointments={visible}
            compactUser={timeCompact}
            onCompact={setTimeCompact}
            onPickDate={pickDay}
            onOpen={openAppt}
            onMove={moveAppt}
            onResize={resizeAppt}
            onBusy={setBusy}
            dragLocked={dragLocked}
          />
        ) : null}
        {scale === "month" ? (
          <MonthView
            date={date}
            appointments={visible}
            zoom={monthZoom}
            onZoom={setMonthZoom}
            onPickDate={pickDay}
            onOpen={openAppt}
            onMove={moveAppt}
            onBusy={setBusy}
            dragLocked={dragLocked}
          />
        ) : null}
        {scale === "year" ? (
          <YearView
            date={date}
            appointments={visible}
            zoom={yearZoom}
            onZoom={setYearZoom}
            onPickDate={pickDay}
            onBusy={setBusy}
            onPickMonth={(iso) => {
              setDate(iso);
              setScale("month");
            }}
          />
        ) : null}
        </div>
        {layout.miniMonth && (scale === "day" || scale === "week" || scale === "year") ? (
          <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
              <MiniMonth
                date={date}
                appointments={visible}
                open={miniOpen}
                onToggle={() => setMiniOpen((v) => !v)}
                onPick={pickDay}
                onShiftMonth={(dir) => setDate(format(addMonths(parseISO(date), dir), "yyyy-MM-dd"))}
              />
          </div>
        ) : null}
      </div>

      {fabOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-[44] bg-ink/25"
          aria-label="Закрыть"
          onClick={() => setFabOpen(false)}
        />
      ) : null}
      <MovableFab
        open={fabOpen}
        label="Записать"
        extraH={(scale === "day" || scale === "week" ? 48 : 0) + (scale === "week" || scale === "month" ? 48 : 0)}
        onPress={() => setFabOpen((v) => !v)}
        extra={
          scale === "day" || scale === "week" || scale === "month" ? (
            <div className="flex flex-col items-center gap-2">
              {scale === "day" || scale === "week" ? (
                <button
                  type="button"
                  onClick={() => setTimeCompact(!compactNow)}
                  className="grid size-10 place-items-center rounded-full bg-surface text-ink shadow-[var(--shadow-lift)]"
                  aria-label={compactNow ? "Развернуть часы" : "Свернуть пустые часы"}
                  aria-pressed={compactNow}
                  data-time-compact-btn={compactNow ? "1" : "0"}
                >
                  {compactNow ? <UnfoldVertical className="size-4" /> : <FoldVertical className="size-4" />}
                </button>
              ) : null}
              {scale === "week" || scale === "month" ? (
                <button
                  type="button"
                  onClick={() => setDragLocked((v) => !v)}
                  className="grid size-10 place-items-center rounded-full bg-surface text-ink shadow-[var(--shadow-lift)]"
                  aria-label={dragLocked ? "Разрешить перенос записей" : "Запретить перенос записей"}
                  aria-pressed={!dragLocked}
                  data-drag-lock={dragLocked ? "1" : "0"}
                >
                  {dragLocked ? <Lock className="size-4" /> : <LockOpen className="size-4" />}
                </button>
              ) : null}
            </div>
          ) : null
        }
        menu={
          <>
            <button
              type="button"
              className="flex h-11 items-center justify-center rounded-full bg-surface text-sm font-medium shadow-[var(--shadow-lift)]"
              onClick={() => {
                setFabOpen(false);
                book(date, (settings.workHours[parseISO(date).getDay()] ?? { start: "09:00" }).start);
              }}
            >
              Новая запись
            </button>
            <button
              type="button"
              className="flex h-11 items-center justify-center rounded-full bg-surface text-sm font-medium shadow-[var(--shadow-lift)]"
              onClick={() => {
                setFabOpen(false);
                setCalendarOpen(true);
              }}
            >
              Из календаря
            </button>
          </>
        }
      />
      <CalendarImportDialog open={calendarOpen} onOpenChange={setCalendarOpen} />
    </div>
  );
}

function FilterChip({
  active,
  label,
  onClick,
  color,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  color?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12px] font-medium",
        active ? "bg-primary text-primary-fg" : "bg-surface text-ink shadow-[var(--shadow-card)]",
      )}
    >
      {color ? <span className="size-2 rounded-full" style={{ background: color }} /> : null}
      {label}
    </button>
  );
}

function appointmentClass(status: Appointment["status"]) {
  if (status === "in_chair") return "bg-chair text-primary-fg";
  if (status === "done") return "bg-ok/15 text-ink";
  if (status === "no_show") return "bg-danger/10 text-ink";
  return "bg-primary text-primary-fg";
}

function WeekName({ name }: { name: string }) {
  const text = name.trim() || "Пациент";
  const parts = splitSyllables(text);
  const size =
    parts.length >= 5 ? "text-[8px]" : parts.length >= 4 ? "text-[9px]" : "text-[10px]";
  return (
    <span className="block h-full min-h-0 w-full overflow-hidden" data-week-name>
      <span className="hidden h-full w-full overflow-hidden px-1 py-0.5 text-left text-[11px] font-medium leading-tight text-ellipsis whitespace-nowrap md:block">
        {text}
      </span>
      <span
        className={cn(
          "flex h-full min-h-0 w-full flex-col justify-evenly overflow-hidden px-0.5 py-px text-left font-medium leading-none md:hidden",
          size,
        )}
        data-week-name-mobile
      >
        {parts.map((p, i) => (
          <span key={`${p}-${i}`} className="block overflow-hidden text-ellipsis whitespace-nowrap">
            {p}
          </span>
        ))}
      </span>
    </span>
  );
}

function DraggableAppt({
  appointment,
  className,
  style,
  children,
  onOpen,
  onMove,
  onResize,
  onBusy,
  pxPerMin,
  slotMinutes,
  dragEnabled = true,
  clip = false,
}: {
  appointment: Appointment;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
  onOpen: (a: Appointment) => void;
  onMove: (a: Appointment, date: string, time?: string) => void;
  onResize?: (a: Appointment, next: { startMin: number; durationMin: number }) => void;
  onBusy?: (v: boolean) => void;
  pxPerMin?: number;
  slotMinutes?: number;
  dragEnabled?: boolean;
  clip?: boolean;
}) {
  const drag = useApptDrag((date, time) => onMove(appointment, date, time), onBusy);
  const startMin = minutesOf(appointment.start);
  const resize = useApptResize(
    startMin,
    appointment.durationMin,
    pxPerMin ?? 1,
    slotMinutes ?? 30,
    (next) => onResize?.(appointment, next),
    onBusy,
  );
  const liveHeight =
    pxPerMin && onResize ? Math.max(resize.duration * pxPerMin - 4, 28) : undefined;
  const liveTopDelta = pxPerMin && onResize ? (resize.startMin - startMin) * pxPerMin : 0;
  const live = drag.dragging || resize.resizing;
  const canResize = Boolean(onResize && pxPerMin);
  const lifting = Boolean(drag.ghost);

  return (
    <div
      className={cn(
        "relative z-10 select-none [-webkit-touch-callout:none] [-webkit-user-select:none]",
        clip ? "min-w-0 overflow-hidden" : "overflow-visible",
        !lifting && className,
        live
          ? "z-20 transition-none"
          : "cal-live transition-[top,height,transform,opacity] duration-200 ease-[var(--ease-out)]",
        lifting && "pointer-events-none bg-transparent shadow-none",
      )}
      style={{
        ...(lifting
          ? {
              top: style?.top,
              height: style?.height ?? drag.ghost?.h,
              minHeight: drag.ghost?.h,
              left: style?.left,
              right: style?.right,
              width: style?.width ?? "100%",
              background: "transparent",
              boxShadow: "none",
            }
          : style),
        ...(liveHeight != null && !lifting ? { height: liveHeight } : null),
        transform: lifting ? undefined : liveTopDelta ? `translateY(${liveTopDelta}px)` : style?.transform,
        touchAction: live ? "none" : "pan-x pan-y",
      }}
    >
      <div
        data-appt
        data-appt-ghost={lifting ? "1" : undefined}
        className={cn("h-full min-h-0 w-full", lifting && className)}
        style={
          lifting && drag.ghost
            ? {
                ...style,
                position: "fixed",
                left: drag.ghost.x - drag.ghost.ox,
                top: drag.ghost.y - drag.ghost.oy,
                width: drag.ghost.w,
                height: drag.ghost.h,
                right: "auto",
                bottom: "auto",
                margin: 0,
                zIndex: 80,
                opacity: 1,
                transform: "none",
                visibility: "visible",
                pointerEvents: "auto",
                boxShadow: [style?.boxShadow, "var(--shadow-lift)"].filter(Boolean).join(", "),
                touchAction: "none",
              }
            : { height: "100%" }
        }
      >
        <div
          role="button"
          tabIndex={0}
          onClick={() => onOpen(appointment)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onOpen(appointment);
            }
          }}
          onPointerDown={dragEnabled ? drag.bind.onPointerDown : undefined}
          onPointerMove={dragEnabled ? drag.bind.onPointerMove : undefined}
          onPointerUp={dragEnabled ? drag.bind.onPointerUp : undefined}
          onPointerCancel={dragEnabled ? drag.bind.onPointerCancel : undefined}
          onClickCapture={dragEnabled ? drag.bind.onClickCapture : undefined}
          onContextMenu={dragEnabled ? drag.bind.onContextMenu : undefined}
          className="block h-full min-h-0 w-full cursor-pointer text-left"
        >
          {children}
        </div>
        {canResize ? (
          <>
            <div
              data-resize
              role="slider"
              aria-orientation="vertical"
              aria-label="Изменить начало"
              className="absolute inset-x-0 top-0 z-30 h-3 cursor-ns-resize touch-none"
              {...resize.topBind}
              onClick={(e) => e.stopPropagation()}
            />
            <div
              data-resize
              role="slider"
              aria-orientation="vertical"
              aria-label="Изменить конец"
              className="absolute inset-x-0 bottom-0 z-30 h-3 cursor-ns-resize touch-none"
              {...resize.bottomBind}
              onClick={(e) => e.stopPropagation()}
            />
          </>
        ) : null}
      </div>
    </div>
  );
}

function DayView({
  date,
  appointments,
  compactUser,
  onCompact,
  onBook,
  onOpen,
  onMove,
  onResize,
  onBusy,
}: {
  date: string;
  appointments: Appointment[];
  compactUser: boolean | null;
  onCompact: (next: boolean) => void;
  onBook: (start: string) => void;
  onOpen: (a: Appointment) => void;
  onMove: (a: Appointment, date: string, time?: string) => void;
  onResize: (a: Appointment, next: { startMin: number; durationMin: number }) => void;
  onBusy: (v: boolean) => void;
}) {
  const settings = useClinic((s) => s.settings);
  const layout = scheduleLayout(settings);
  const patients = useClinic((s) => s.patients);
  const services = useClinic((s) => s.services);
  const doctors = useClinic((s) => s.doctors);
  const visits = useClinic((s) => s.visits);
  const day = parseISO(date);
  const hours = settings.workHours[day.getDay()] ?? { start: "09:00", end: "18:00", off: false };
  const list = dayAppointments(appointments, date).filter((a) => a.status !== "cancelled");
  const pxPerMin = 1.35;
  const startMin = hours.off ? 0 : minutesOf(hours.start);
  const span = hours.off ? 1 : Math.max(1, minutesOf(hours.end) - startMin);
  const slotMin = settings.slotMinutes || 30;
  const allSlots = useMemo(() => {
    if (hours.off) return [];
    const out: string[] = [];
    for (let t = minutesOf(hours.start); t < minutesOf(hours.end); t += slotMin) {
      out.push(fromMinutes(t));
    }
    return out;
  }, [hours, slotMin]);
  const compact = compactUser ?? list.length > 0;
  const squeeze = useTimeSqueeze(onCompact);
  const slots = compact ? busyTimes(list, allSlots, slotMin) : allSlots;
  const slotH = slotMin * pxPerMin;
  const gridH = compact ? slots.length * slotH + 16 : span * pxPerMin + 16;

  function slotFree(start: string) {
    const a0 = minutesOf(start);
    const a1 = a0 + slotMin;
    return !list.some((b) => {
      if (!isBlocking(b.status)) return false;
      const b0 = minutesOf(b.start);
      return a0 < b0 + b.durationMin && b0 < a1;
    });
  }

  function yOf(time: string) {
    if (!compact) return (minutesOf(time) - startMin) * pxPerMin;
    return compactIndex(time, slots, slotMin) * slotH;
  }

  if (hours.off) {
    return (
      <div className="rounded-xl bg-surface px-5 py-10 text-center shadow-[var(--shadow-card)]">
        <p className="font-display text-xl">Выходной</p>
        <p className="mt-1 text-sm text-muted">В настройках можно открыть этот день.</p>
      </div>
    );
  }

  return (
    <div
      className="overflow-x-hidden rounded-xl bg-surface shadow-[var(--shadow-card)]"
      ref={squeeze.ref}
      data-time-compact={compact ? "1" : "0"}
      data-day-grid
    >
      <div className="relative overflow-visible py-2" style={{ height: gridH }}>
        {slots.map((t) => (
          <button
            key={t}
            type="button"
            data-slot-date={date}
            data-slot-time={t}
            onClick={() => slotFree(t) && onBook(t)}
            className="absolute right-0 left-0 flex border-t border-line/80 text-left hover:bg-surface-2/60"
            style={{ top: yOf(t) + 8, height: slotH }}
          >
            <span className="w-14 shrink-0 px-2 pt-1 text-[11px] tabular-nums text-subtle">{t}</span>
          </button>
        ))}
        {list.map((a) => {
          const p = patients.find((x) => x.id === a.patientId);
          const svc = services.find((s) => s.id === a.serviceId);
          const doc = doctors.find((d) => d.id === a.doctorId);
          const top = yOf(a.start);
          const height = compact
            ? Math.max(compactSpan(a.start, a.durationMin, slots, slotMin) * slotH - 4, 36)
            : Math.max(a.durationMin * pxPerMin - 4, 36);
          return (
            <DraggableAppt
              key={a.id}
              appointment={a}
              onOpen={onOpen}
              onMove={onMove}
              onResize={onResize}
              onBusy={onBusy}
              pxPerMin={pxPerMin}
              slotMinutes={slotMin}
              className={cn(
                "absolute right-3 left-14 rounded-md px-3 py-1.5 text-left shadow-[var(--shadow-card)]",
                appointmentClass(a.status),
              )}
              style={{
                top: top + 10,
                height,
                boxShadow: doc ? `inset 4px 0 0 ${doc.color}` : undefined,
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="truncate text-sm font-medium">{p ? fullName(p) : "Пациент"}</p>
                {layout.dayTime ? <span className="text-[11px] tabular-nums opacity-80">{a.start}</span> : null}
              </div>
              <p className="truncate text-[12px] opacity-80">
                {layout.visitKind
                  ? `${VISIT_KIND_LABEL[a.visitKind ?? suggestVisitKind(visits, a.patientId)]} · `
                  : ""}
                {svc?.name ?? "Приём"}
                {doc ? ` · ${shortName(doc)}` : ""}
              </p>
            </DraggableAppt>
          );
        })}
      </div>
    </div>
  );
}

function WeekView({
  week,
  date,
  appointments,
  compactUser,
  onCompact,
  onPickDate,
  onOpen,
  onMove,
  onResize,
  onBusy,
  dragLocked,
}: {
  week: Date[];
  date: string;
  appointments: Appointment[];
  compactUser: boolean | null;
  onCompact: (next: boolean) => void;
  onPickDate: (iso: string) => void;
  onOpen: (a: Appointment) => void;
  onMove: (a: Appointment, date: string, time?: string) => void;
  onResize: (a: Appointment, next: { startMin: number; durationMin: number }) => void;
  onBusy: (v: boolean) => void;
  dragLocked: boolean;
}) {
  const settings = useClinic((s) => s.settings);
  const layout = scheduleLayout(settings);
  const patients = useClinic((s) => s.patients);
  const doctors = useClinic((s) => s.doctors);
  const startMin = 9 * 60;
  const endMin = 18 * 60;
  const pxPerMin = 1.8;
  const span = endMin - startMin;
  const step = settings.slotMinutes || 30;
  const allSlots: string[] = [];
  for (let t = startMin; t < endMin; t += step) allSlots.push(fromMinutes(t));
  const weekList = appointments.filter((a) => {
    if (a.status === "cancelled") return false;
    return week.some((d) => format(d, "yyyy-MM-dd") === a.date);
  });
  const compact = compactUser ?? weekList.length > 0;
  const squeeze = useTimeSqueeze(onCompact);
  const slots = compact ? busyTimes(weekList, allSlots, step) : allSlots;
  const slotH = step * pxPerMin;
  const gridH = compact ? slots.length * slotH : span * pxPerMin;

  function yOf(time: string) {
    if (!compact) return (minutesOf(time) - startMin) * pxPerMin;
    return compactIndex(time, slots, step) * slotH;
  }

  return (
    <div
      className="overflow-x-hidden rounded-xl bg-surface shadow-[var(--shadow-card)]"
      ref={squeeze.ref}
      data-time-compact={compact ? "1" : "0"}
      data-week-grid
    >
      <div className="grid grid-cols-[36px_repeat(7,minmax(0,1fr))] border-b border-line">
        <div />
        {week.map((d) => {
          const iso = format(d, "yyyy-MM-dd");
          const active = iso === date;
          const isToday = iso === todayISO();
          const fill = dayFill(appointments, settings.workHours, iso);
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onPickDate(iso)}
              className={cn("px-0.5 py-2 text-center", active && "bg-primary/10")}
            >
              <p className="text-[10px] uppercase tracking-wide text-muted">{format(d, "EE", { locale: ru })}</p>
              <p
                className={cn(
                  "mx-auto mt-0.5 grid size-7 place-items-center rounded-full text-sm font-medium",
                  isToday && "bg-primary text-primary-fg",
                )}
              >
                {format(d, "d")}
              </p>
              {!fill.off ? (
                layout.occupancy && fill.used > 0 ? (
                  <p className="mt-0.5 text-[10px] tabular-nums text-muted">{fill.pct}%</p>
                ) : (
                  <p className="mt-0.5 text-[10px] text-subtle">&nbsp;</p>
                )
              ) : (
                <p className="mt-0.5 text-[10px] text-subtle">вых</p>
              )}
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-[36px_repeat(7,minmax(0,1fr))]">
        <div className="relative" style={{ height: gridH }}>
          {slots.map((t) => (
            <p
              key={t}
              className="absolute left-0 w-9 px-0.5 text-[10px] tabular-nums text-subtle"
              style={{ top: yOf(t) }}
            >
              {t}
            </p>
          ))}
        </div>
        {week.map((d) => {
          const iso = format(d, "yyyy-MM-dd");
          const hours = settings.workHours[d.getDay()] ?? { start: "09:00", end: "18:00", off: false };
          const list = dayAppointments(appointments, iso).filter((a) => a.status !== "cancelled");
          return (
            <div key={iso} className="relative min-w-0 border-l border-line/80" style={{ height: gridH }}>
              {hours.off ? (
                <button type="button" className="absolute inset-0 bg-surface-2/60" onClick={() => onPickDate(iso)} aria-label={iso} />
              ) : (
                slots.map((t) => (
                  <button
                    key={t}
                    type="button"
                    data-slot-date={iso}
                    data-slot-time={t}
                    className="absolute right-0 left-0 border-t border-line/50 hover:bg-surface-2/70"
                    style={{
                      top: yOf(t),
                      height: slotH,
                    }}
                    onClick={() => onPickDate(iso)}
                    aria-label={`${iso} ${t}`}
                  />
                ))
              )}
              {list.map((a) => {
                const p = patients.find((x) => x.id === a.patientId);
                const doc = doctors.find((d0) => d0.id === a.doctorId);
                const top = yOf(a.start);
                const height = compact
                  ? Math.max(compactSpan(a.start, a.durationMin, slots, step) * slotH - 3, 22)
                  : Math.max(a.durationMin * pxPerMin - 3, 22);
                return (
                  <DraggableAppt
                    key={a.id}
                    appointment={a}
                    onOpen={onOpen}
                    onMove={onMove}
                    onResize={onResize}
                    onBusy={onBusy}
                    pxPerMin={pxPerMin}
                    slotMinutes={step}
                    dragEnabled={!dragLocked}
                    clip
                    className={cn(
                      "absolute right-0.5 left-0.5 overflow-hidden rounded text-left",
                      appointmentClass(a.status),
                    )}
                    style={{
                      top: top + 1,
                      height,
                      boxShadow: doc ? `inset 3px 0 0 ${doc.color}` : undefined,
                    }}
                  >
                    <WeekName name={p ? p.lastName : "Пациент"} />
                  </DraggableAppt>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MonthView({
  date,
  appointments,
  zoom,
  onZoom,
  onPickDate,
  onOpen,
  onMove,
  onBusy,
  dragLocked,
}: {
  date: string;
  appointments: Appointment[];
  zoom: number;
  onZoom: (z: number) => void;
  onPickDate: (iso: string) => void;
  onOpen: (a: Appointment) => void;
  onMove: (a: Appointment, date: string, time?: string) => void;
  onBusy: (v: boolean) => void;
  dragLocked: boolean;
}) {
  const settings = useClinic((s) => s.settings);
  const layout = scheduleLayout(settings);
  const patients = useClinic((s) => s.patients);
  const doctors = useClinic((s) => s.doctors);
  const day = parseISO(date);
  const gridStart = startOfWeek(startOfMonth(day), { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(day), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
  const labels = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];
  const pinch = usePinchZoom(zoom, onZoom, { min: 1, max: 2.8 });
  const shown = 4;

  useEffect(() => {
    onBusy(pinch.pinching);
    return () => onBusy(false);
  }, [pinch.pinching]);

  return (
    <div className="overflow-hidden rounded-xl bg-surface shadow-[var(--shadow-card)]">
      <div
        ref={pinch.scroller}
        data-month-zoom
        className="max-h-[min(70dvh,40rem)] overflow-auto overscroll-contain"
        style={{ touchAction: "none" }}
      >
        <div ref={pinch.sizer}>
          <div ref={pinch.inner}>
            <div className="grid grid-cols-7 border-b border-line">
              {labels.map((l) => (
                <p key={l} className="px-1 py-2 text-center text-[11px] uppercase tracking-wide text-muted">
                  {l}
                </p>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {days.map((d) => {
                const iso = format(d, "yyyy-MM-dd");
                const inMonth = isSameMonth(d, day);
                const isToday = iso === todayISO();
                const list = dayAppointments(appointments, iso).filter(
                  (a) => a.status !== "cancelled" && a.status !== "no_show",
                );
                const fill = dayFill(appointments, settings.workHours, iso);
                const cap = layout.occupancy ? fillCaption(fill) : fill.off ? "вых" : "";
                return (
                  <div
                    key={iso}
                    data-slot-date={iso}
                    className={cn("min-w-0 overflow-hidden border-t border-l border-line/80 p-1", !inMonth && "bg-bg/60")}
                    style={{ minHeight: 72 }}
                  >
                    <button
                      type="button"
                      onClick={() => onPickDate(iso)}
                      className="mb-1 flex w-full items-center justify-between gap-1"
                    >
                      <span
                        className={cn(
                          "grid size-7 place-items-center rounded-full text-[13px] font-medium",
                          isToday && "bg-primary text-primary-fg",
                          !inMonth && "text-subtle",
                        )}
                      >
                        {format(d, "d")}
                      </span>
                      {cap ? (
                        <span
                          className="rounded-full px-1.5 py-0.5 text-[10px] font-medium tabular-nums"
                          style={layout.fillColors ? fillStyle(fill.pct, fill.off, fill.used) : undefined}
                        >
                          {cap}
                        </span>
                      ) : null}
                    </button>
                    <div className="flex min-w-0 flex-col gap-0.5 overflow-hidden">
                      {list.slice(0, shown).map((a) => {
                        const p = patients.find((x) => x.id === a.patientId);
                        const doc = doctors.find((x) => x.id === a.doctorId);
                        return (
                          <DraggableAppt
                            key={a.id}
                            appointment={a}
                            onOpen={onOpen}
                            onMove={onMove}
                            onBusy={onBusy}
                            dragEnabled={!dragLocked}
                            clip
                            className="min-w-0 w-full truncate rounded px-1 py-0.5 text-left text-[10px] leading-tight text-primary-fg"
                            style={{ background: doc?.color ?? "var(--color-primary)" }}
                          >
                            <span className="block truncate">{p?.lastName ?? "Пациент"}</span>
                          </DraggableAppt>
                        );
                      })}
                      {list.length > shown ? (
                        <button type="button" className="text-[10px] text-muted" onClick={() => onPickDate(iso)}>
                          ещё {list.length - shown}
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniMonth({
  date,
  appointments,
  open,
  onToggle,
  onPick,
  onShiftMonth,
}: {
  date: string;
  appointments: Appointment[];
  open: boolean;
  onToggle: () => void;
  onPick: (iso: string) => void;
  onShiftMonth: (dir: -1 | 1) => void;
}) {
  const settings = useClinic((s) => s.settings);
  const layout = scheduleLayout(settings);
  const day = parseISO(date);
  const gridStart = startOfWeek(startOfMonth(day), { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(day), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
  const labels = ["п", "в", "с", "ч", "п", "с", "в"];
  const swipe = usePeriodSwipe(onShiftMonth);
  const monthShort = format(day, "LLL", { locale: ru });
  const host = useRef<HTMLDivElement>(null);
  const [dock, setDock] = useState(() =>
    typeof window === "undefined" ? { x: 8, y: 8 } : defaultMiniDock(Math.max(280, window.innerWidth - 32), 480),
  );
  const [lifted, setLifted] = useState(false);
  const dragging = useRef(false);
  const skipClick = useRef(false);
  const hold = useRef(0);
  const start = useRef({ x: 0, y: 0, px: 0, py: 0 });

  function parentSize() {
    const p = host.current?.parentElement;
    return { w: p?.clientWidth ?? 320, h: p?.clientHeight ?? 480 };
  }

  useLayoutEffect(() => {
    function apply() {
      const { w, h } = parentSize();
      if (w < 80 || h < 80) return false;
      setDock(loadMiniDock(w, h));
      return true;
    }
    if (apply()) return;
    const p = host.current?.parentElement;
    const ro = p && typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => apply()) : null;
    ro?.observe(p!);
    const id = window.requestAnimationFrame(() => apply());
    return () => {
      ro?.disconnect();
      window.cancelAnimationFrame(id);
    };
  }, []);

  useEffect(() => {
    function onResize() {
      const { w, h } = parentSize();
      if (w < 80 || h < 80) return;
      setDock((p) => {
        const next = clampMiniDock(p, w, h);
        saveMiniDock(next, w, h);
        return next;
      });
    }
    window.addEventListener("resize", onResize);
    const p = host.current?.parentElement;
    const ro = p && typeof ResizeObserver !== "undefined" ? new ResizeObserver(onResize) : null;
    if (p && ro) ro.observe(p);
    return () => {
      window.removeEventListener("resize", onResize);
      ro?.disconnect();
    };
  }, []);

  function clearHold() {
    window.clearTimeout(hold.current);
    hold.current = 0;
  }

  function onPointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    dragging.current = false;
    skipClick.current = false;
    start.current = { x: e.clientX, y: e.clientY, px: dock.x, py: dock.y };
    const pointerId = e.pointerId;
    const target = e.currentTarget;
    clearHold();
    hold.current = window.setTimeout(() => {
      dragging.current = true;
      skipClick.current = true;
      setLifted(true);
      try {
        target.setPointerCapture(pointerId);
      } catch {
        /* ignore */
      }
      try {
        navigator.vibrate?.(12);
      } catch {
        /* ignore */
      }
    }, 420);
  }

  function onPointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    const dx = e.clientX - start.current.x;
    const dy = e.clientY - start.current.y;
    if (!dragging.current) {
      if (Math.hypot(dx, dy) > 12) clearHold();
      return;
    }
    e.preventDefault();
    const { w, h } = parentSize();
    setDock(clampMiniDock({ x: start.current.px + dx, y: start.current.py + dy }, w, h));
  }

  function finishDrag() {
    clearHold();
    if (!dragging.current) return false;
    dragging.current = false;
    setLifted(false);
    const { w, h } = parentSize();
    setDock((p) => {
      const next = clampMiniDock(p, w, h);
      saveMiniDock(next, w, h);
      return next;
    });
    return true;
  }

  function onPointerUp(e: React.PointerEvent<HTMLButtonElement>) {
    if (finishDrag()) return;
    if (skipClick.current) return;
    if (Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 10) return;
    onToggle();
  }

  const { w: parentW } = parentSize();
  const flipDown = dock.y < 160;
  const alignStart = dock.x + MINI_SIZE / 2 < parentW / 2;

  return (
    <div
      ref={host}
      data-mini-month
      data-mini-month-dock={`${Math.round(dock.x)},${Math.round(dock.y)}`}
      className="pointer-events-auto absolute z-20"
      style={{ left: dock.x, top: dock.y, width: MINI_SIZE }}
    >
      <button
        type="button"
        data-mini-month-toggle
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          finishDrag();
        }}
        onContextMenu={(e) => e.preventDefault()}
        aria-expanded={open}
        aria-label={open ? "Скрыть календарь" : "Показать календарь"}
        className={cn(
          "grid size-11 place-items-center rounded-lg bg-surface/95 shadow-[var(--shadow-lift)] backdrop-blur-sm",
          "touch-none select-none [-webkit-touch-callout:none]",
          open && "ring-1 ring-primary",
          lifted && "scale-105 ring-1 ring-primary",
        )}
      >
        <span className="flex flex-col items-center leading-none">
          <span className="text-[8px] font-semibold uppercase tracking-wide text-danger">{monthShort}</span>
          <span className="font-display text-[17px] tabular-nums leading-none">{format(day, "d")}</span>
        </span>
      </button>
      {open ? (
        <div
          data-mini-month-panel
          {...swipe}
          className={cn(
            "absolute z-10 w-[8.75rem] rounded-lg bg-surface/95 p-1.5 shadow-[var(--shadow-lift)] backdrop-blur-sm",
            flipDown ? "top-full mt-1.5" : "bottom-full mb-1.5",
            alignStart ? "left-0" : "right-0",
          )}
        >
          <p className="px-0.5 pb-1 text-center text-[11px] font-medium capitalize">
            {format(day, "LLLL", { locale: ru })}
          </p>
          <div className="grid grid-cols-7">
            {labels.map((l, i) => (
              <p key={`${l}-${i}`} className="text-center text-[8px] uppercase text-subtle">
                {l}
              </p>
            ))}
            {days.map((d) => {
              const iso = format(d, "yyyy-MM-dd");
              const inMonth = isSameMonth(d, day);
              const fill = dayFill(appointments, settings.workHours, iso);
              const selected = iso === date;
              const isToday = iso === todayISO();
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => onPick(iso)}
                  className={cn(
                    "grid aspect-square place-items-center rounded-[3px] text-[9px] leading-none",
                    !inMonth && "text-subtle",
                    selected && "ring-1 ring-ink",
                    isToday && !selected && "font-semibold",
                  )}
                  style={inMonth && layout.fillColors ? fillStyle(fill.pct, fill.off, fill.used) : undefined}
                  aria-label={iso}
                >
                  {format(d, "d")}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function YearView({
  date,
  appointments,
  zoom,
  onZoom,
  onPickDate,
  onPickMonth,
  onBusy,
}: {
  date: string;
  appointments: Appointment[];
  zoom: number;
  onZoom: (z: number) => void;
  onPickDate: (iso: string) => void;
  onPickMonth: (iso: string) => void;
  onBusy: (v: boolean) => void;
}) {
  const settings = useClinic((s) => s.settings);
  const layout = scheduleLayout(settings);
  const year = getYear(parseISO(date));
  const months = Array.from({ length: 12 }, (_, i) => new Date(year, i, 1));
  const labels = ["п", "в", "с", "ч", "п", "с", "в"];
  const pinch = usePinchZoom(zoom, onZoom, { min: 1, max: 2.8 });

  useEffect(() => {
    onBusy(pinch.pinching);
    return () => onBusy(false);
  }, [pinch.pinching]);

  useEffect(() => {
    const now = new Date();
    if (year !== now.getFullYear()) return;
    const key = `${year}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const id = window.requestAnimationFrame(() => {
      const sc = pinch.scroller.current;
      const el = sc?.querySelector(`[data-year-month="${key}"]`) as HTMLElement | null;
      if (!sc || !el) return;
      const top = el.offsetTop - sc.clientHeight / 2 + el.offsetHeight / 2;
      if (top <= 8 && el.offsetTop + el.offsetHeight <= sc.clientHeight + 8) return;
      sc.scrollTo({ top: Math.max(0, top) });
    });
    return () => window.cancelAnimationFrame(id);
  }, [year]);

  return (
    <div className="flex h-[calc(100dvh-12.5rem)] max-h-[calc(100dvh-12.5rem)] flex-col overflow-hidden rounded-xl md:h-[calc(100dvh-8rem)] md:max-h-[calc(100dvh-8rem)]">
      <div
        ref={pinch.scroller}
        data-year-zoom
        className="h-full min-h-0 overflow-auto overscroll-contain"
        style={{ touchAction: "none" }}
      >
        <div ref={pinch.sizer} className="min-h-full">
          <div ref={pinch.inner} className="min-h-full">
            <div className="grid min-h-full grid-cols-2 grid-rows-6 gap-2 sm:grid-cols-3 sm:grid-rows-4 lg:grid-cols-4 lg:grid-rows-3">
        {months.map((monthDate) => {
          const gridStart = startOfWeek(startOfMonth(monthDate), { weekStartsOn: 1 });
          const gridEnd = endOfWeek(endOfMonth(monthDate), { weekStartsOn: 1 });
          const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
          const isoMonth = format(monthDate, "yyyy-MM-dd");
          return (
            <section key={isoMonth} data-year-month={format(monthDate, "yyyy-MM")} className="flex h-full min-h-0 flex-col rounded-xl bg-surface p-2 shadow-[var(--shadow-card)]">
              <button
                type="button"
                className="mb-1 w-full rounded-md px-1 py-1 text-left text-sm font-medium capitalize hover:bg-surface-2"
                onClick={() => onPickMonth(isoMonth)}
              >
                {format(monthDate, "LLLL", { locale: ru })}
              </button>
              <div className="grid flex-1 grid-cols-7">
                {labels.map((l, i) => (
                  <p key={`${l}-${i}`} className="text-center text-[9px] uppercase text-subtle">
                    {l}
                  </p>
                ))}
                {days.map((d) => {
                  const iso = format(d, "yyyy-MM-dd");
                  const inMonth = isSameMonth(d, monthDate);
                  const fill = dayFill(appointments, settings.workHours, iso);
                  const isToday = iso === todayISO();
                  return (
                    <button
                      key={iso}
                      type="button"
                      disabled={!inMonth}
                      onClick={() => inMonth && onPickDate(iso)}
                      className={cn(
                        "mx-auto my-0.5 flex min-h-7 w-full flex-col items-center justify-center rounded-md px-0.5 text-[10px] leading-tight tabular-nums transition-colors duration-200 ease-[var(--ease-out)]",
                        !inMonth && "opacity-0",
                        isToday && "ring-1 ring-ink",
                      )}
                      style={inMonth && layout.fillColors ? fillStyle(fill.pct, fill.off, fill.used) : undefined}
                      title={fill.off ? "Выходной" : fill.used > 0 ? `${fill.pct}%` : undefined}
                    >
                      {inMonth ? format(d, "d") : ""}
                      {layout.occupancy && inMonth && fill.used > 0 && !fill.off ? (
                        <span className="text-[8px] font-medium">{fill.pct}%</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
              </section>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
