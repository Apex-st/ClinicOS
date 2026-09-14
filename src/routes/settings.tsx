import { createFileRoute, useRouter, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Bell,
  BookOpen,
  Building2,
  ChevronRight,
  Clock,
  Contact,
  FileText,
  HardDrive,
  Info,
  MessageSquare,
  Palette,
  Stethoscope,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/alert-dialog";
import { ChipGroup } from "@/components/chip-toggle";
import { StaffPanel } from "@/components/staff-panel";
import { ThemePicker } from "@/components/theme-picker";
import { SaveFileDialog } from "@/components/save-file-dialog";
import { Field, Select } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fullName, greetingDoctorName, todayHeadline, todayISO } from "@/lib/format";
import { icsBlob } from "@/lib/calendar-ics";
import { NotifySetup } from "@/components/notify-setup";
import { ImportDialog } from "@/components/import-dialog";
import { CalendarImportDialog } from "@/components/calendar-import";
import { OccupancyLegend } from "@/components/occupancy-legend";
import { IosSwitch } from "@/components/ios-switch";
import { TableImportDialog } from "@/components/table-import-dialog";
import {
  AboutPanel,
  DiagnosesPanel,
  MessageTemplatesPanel,
  NotifyRulesPanel,
  PdfDocsPanel,
  TagsPanel,
  ToothStatusesPanel,
} from "@/components/settings-plus";
import { DiagnosisField } from "@/components/diagnosis-field";
import { MaterialPicker } from "@/components/material-picker";
import { allSectionIds, EXPORT_SECTIONS, type ExportSectionId, type ImportPreview } from "@/lib/export-data";
import { buildBackupZip, parseBackupFile } from "@/lib/backup-file";
import { saveNativeFile } from "@/lib/native-file";
import { useClinic } from "@/lib/store";
import { useSession } from "@/lib/session";
import { cn } from "@/lib/utils";
import { APP_VERSION_LABEL } from "@/lib/version";
import type { DiaryCatalog } from "@/lib/diary";
import type { DiaryTemplate, WorkDay } from "@/lib/types";
import {
  ANAMNESIS_OPTIONS,
  COMPLAINT_OPTIONS,
  EXAM_OPTIONS,
  RECOMMEND_OPTIONS,
  TREATMENT_OPTIONS,
} from "@/lib/diary";

export const Route = createFileRoute("/settings")({ component: SettingsPage });

const DAYS: Array<{ n: number; label: string; short: string }> = [
  { n: 1, label: "Понедельник", short: "Пн" },
  { n: 2, label: "Вторник", short: "Вт" },
  { n: 3, label: "Среда", short: "Ср" },
  { n: 4, label: "Четверг", short: "Чт" },
  { n: 5, label: "Пятница", short: "Пт" },
  { n: 6, label: "Суббота", short: "Сб" },
  { n: 0, label: "Воскресенье", short: "Вс" },
];

const SETTINGS_SECTIONS = [
  { id: "clinic", title: "Кабинет", hint: "Название, адрес, приветствие", icon: Building2 },
  { id: "card", title: "Карточка", hint: "Формула, статусы зубов, группы", icon: Contact },
  { id: "staff", title: "Врачи", hint: "Профили, пароли, роли", icon: Users },
  { id: "diary", title: "Дневник", hint: "Шаблоны и кнопки приёма", icon: BookOpen },
  { id: "pdf", title: "Документы PDF", hint: "Какие поля в каждом PDF", icon: FileText },
  { id: "diagnoses", title: "Диагнозы", hint: "Справочник МКБ-10", icon: Stethoscope },
  { id: "messages", title: "Сообщения", hint: "SMS, WhatsApp, почта", icon: MessageSquare },
  { id: "schedule", title: "Расписание", hint: "Часы работы, вид сетки, календарь", icon: Clock },
  { id: "notify", title: "Уведомления", hint: "Шторка и календарь", icon: Bell },
  { id: "look", title: "Оформление", hint: "Светлая и тёмная тема", icon: Palette },
  { id: "backup", title: "Копия", hint: "Сохранить и восстановить", icon: HardDrive },
  { id: "about", title: "О программе", hint: "Версия и список изменений", icon: Info },
] as const;

type SettingsSection = (typeof SETTINGS_SECTIONS)[number]["id"];

function SettingsPage() {
  const settings = useClinic((s) => s.settings);
  const doctors = useClinic((s) => s.doctors);
  const discounts = useClinic((s) => s.discounts);
  const updateSettings = useClinic((s) => s.updateSettings);
  const resetDemo = useClinic((s) => s.resetDemo);
  const sessionDoctorId = useSession((s) => s.doctorId);
  const router = useRouter();
  const hash = useRouterState({ select: (s) => (s.location.hash || "").replace(/^#/, "") });
  const [demoOpen, setDemoOpen] = useState(false);
  const [icsFile, setIcsFile] = useState<{ blob: Blob; name: string } | null>(null);
  const [exportSections, setExportSections] = useState<ExportSectionId[]>(allSectionIds());
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [tableOpen, setTableOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [backupBusy, setBackupBusy] = useState(false);
  const section = SETTINGS_SECTIONS.some((s) => s.id === hash) ? (hash as SettingsSection) : null;
  const fileRef = useRef<HTMLInputElement>(null);

  function go(id: SettingsSection | null) {
    router.history.push(id ? `/settings#${id}` : "/settings");
  }

  function toggleSection(id: ExportSectionId) {
    setExportSections((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  async function exportBackup() {
    if (exportSections.length === 0) {
      toast.error("Отметьте хотя бы один раздел");
      return;
    }
    setBackupBusy(true);
    toast.message("Собираю копию…");
    try {
      const { blob, name } = await buildBackupZip(useClinic.getState(), exportSections);
      const result = await saveNativeFile(blob, name, { share: true });
      if (result.how === "aborted") {
        toast.message(result.path ? `Копия уже в «${result.path}». Отправка отменена.` : "Отмена");
      } else if (result.how === "documents") {
        toast.success(`Копия сохранена в «${result.path}»`);
      } else if (result.how === "shared") {
        toast.success("Выберите, куда сохранить файл");
      } else {
        toast.success("Файл скачивается. В Android-программе копия пишется в Документы/ClinicOS.");
      }
    } catch {
      toast.error("Не удалось сохранить копию");
    } finally {
      setBackupBusy(false);
    }
  }

  async function importBackup(file: File) {
    try {
      const parsed = await parseBackupFile(file);
      if (!parsed.ok) {
        toast.error(parsed.error);
        return;
      }
      setImportPreview(parsed);
    } catch {
      toast.error("Не удалось прочитать файл");
    }
  }

  function setDay(n: number, patch: Partial<WorkDay>) {
    updateSettings({
      workHours: {
        ...settings.workHours,
        [n]: { ...settings.workHours[n], ...patch },
      },
    });
  }

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <header>
        {section ? (
          <button
            type="button"
            onClick={() => go(null)}
            className="mb-2 inline-flex min-h-11 items-center gap-1 text-sm text-muted hover:text-ink"
          >
            <ArrowLeft className="size-4" />
            Все настройки
          </button>
        ) : (
          <p className="text-[13px] text-muted">Кабинет</p>
        )}
        <h1 className="font-display text-3xl">
          {section ? SETTINGS_SECTIONS.find((s) => s.id === section)?.title : "Настройки"}
        </h1>
      </header>

      {!section ? (
        <nav className="overflow-hidden rounded-xl bg-surface shadow-[var(--shadow-card)]">
          {SETTINGS_SECTIONS.map((s, i) => {
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => go(s.id)}
                className={cn(
                  "flex min-h-12 w-full items-center gap-3 px-4 py-2 text-left",
                  i > 0 && "border-t border-line",
                )}
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                  <Icon className="size-4" strokeWidth={1.8} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-medium">{s.title}</span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-subtle" strokeWidth={1.8} />
              </button>
            );
          })}
        </nav>
      ) : null}

      {section === "clinic" ? (
        <>
      <section className="rounded-xl bg-surface p-5 shadow-[var(--shadow-card)]">
        <h2 className="font-display text-lg">О кабинете</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Название">
            <Input
              value={settings.clinicName}
              onChange={(e) => updateSettings({ clinicName: e.target.value })}
            />
          </Field>
          <Field label="Врач">
            <Input
              value={settings.doctorName}
              onChange={(e) => updateSettings({ doctorName: e.target.value })}
            />
          </Field>
          <Field label="Телефон">
            <Input value={settings.phone} onChange={(e) => updateSettings({ phone: e.target.value })} />
          </Field>
          <Field label="Адрес">
            <Input value={settings.address} onChange={(e) => updateSettings({ address: e.target.value })} />
          </Field>
          <Field label="Юридическое название">
            <Input
              value={settings.legalName ?? ""}
              onChange={(e) => updateSettings({ legalName: e.target.value })}
            />
          </Field>
          <Field label="ИНН">
            <Input value={settings.inn ?? ""} onChange={(e) => updateSettings({ inn: e.target.value })} />
          </Field>
          <Field label="Реквизиты для PDF" className="sm:col-span-2">
            <Input
              value={settings.requisites ?? ""}
              onChange={(e) => updateSettings({ requisites: e.target.value })}
              placeholder="р/с, банк — если нужно в бланке"
            />
          </Field>
          <Field label="Шаг сетки, мин">
            <Select
              value={String(settings.slotMinutes)}
              onChange={(e) => updateSettings({ slotMinutes: Number(e.target.value) })}
            >
              <option value="15">15</option>
              <option value="30">30</option>
            </Select>
          </Field>
        </div>
      </section>

      <section className="rounded-xl bg-surface p-5 shadow-[var(--shadow-card)]">
        <h2 className="font-display text-lg">Приветствие</h2>
        <p className="mt-1 text-sm text-muted">Показывается на экране загрузки вместо названия «ClinicOS».</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Фраза">
            <Select
              value={settings.welcomeMode === "custom" ? "custom" : "auto"}
              onChange={(e) =>
                updateSettings({ welcomeMode: e.target.value === "custom" ? "custom" : "auto" })
              }
            >
              <option value="auto">Авто: доброе утро / день / вечер</option>
              <option value="custom">Своя фраза</option>
            </Select>
          </Field>
          <Field label="Своя фраза">
            <Input
              value={settings.welcomeText ?? ""}
              onChange={(e) => updateSettings({ welcomeText: e.target.value, welcomeMode: "custom" })}
              placeholder="Добро пожаловать"
              disabled={settings.welcomeMode !== "custom"}
            />
          </Field>
          <Field label="Врач в приветствии" className="sm:col-span-2">
            <Select
              value={settings.welcomeDoctorId || ""}
              onChange={(e) => updateSettings({ welcomeDoctorId: e.target.value })}
            >
              <option value="">Кто вошёл, иначе первый в списке</option>
              {doctors
                .filter((d) => d.active)
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {fullName(d)}
                  </option>
                ))}
            </Select>
          </Field>
        </div>
        <p className="mt-3 text-[12px] text-muted">
          В своей фразе напишите {"{фио}"} — подставится фамилия, имя и отчество выбранного врача. Без метки ФИО добавится после запятой.
        </p>
        <p className="mt-2 rounded-lg bg-surface-2 px-3 py-2 text-sm">
          Сейчас:{" "}
          <span className="font-medium">
            {todayHeadline(settings, greetingDoctorName(settings, doctors, sessionDoctorId))}
          </span>
        </p>
      </section>

      <section className="rounded-xl bg-surface p-5 shadow-[var(--shadow-card)]">
        <h2 className="font-display text-lg">Скидки по умолчанию</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Реферальная">
            <Select
              value={settings.referralDiscountId ?? ""}
              onChange={(e) => updateSettings({ referralDiscountId: e.target.value })}
            >
              <option value="">Не задана</option>
              {discounts.filter((d) => d.active).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Постоянный пациент">
            <Select
              value={settings.loyaltyDiscountId ?? ""}
              onChange={(e) => updateSettings({ loyaltyDiscountId: e.target.value })}
            >
              <option value="">Не задана</option>
              {discounts.filter((d) => d.active).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </section>
        </>
      ) : null}

      {section === "card" ? (
        <>
          <ToothStatusesPanel />
          <TagsPanel />
        </>
      ) : null}

      {section === "staff" ? <StaffPanel /> : null}
      {section === "diary" ? <DiaryTemplatesPanel /> : null}
      {section === "pdf" ? <PdfDocsPanel /> : null}
      {section === "diagnoses" ? <DiagnosesPanel /> : null}
      {section === "messages" ? <MessageTemplatesPanel /> : null}

      {section === "schedule" ? (
        <>
      <section className="rounded-xl bg-surface p-5 shadow-[var(--shadow-card)]">
        <h2 className="font-display text-lg">Часы работы</h2>
        <ul className="mt-4 flex flex-col gap-3">
          {DAYS.map(({ n, label }) => {
            const d = settings.workHours[n] ?? { start: "09:00", end: "18:00", off: false };
            return (
              <li key={n} className="flex flex-col gap-2 rounded-lg bg-surface-2/70 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium">{label}</p>
                  <label className="flex items-center gap-2 text-sm text-muted">
                    <input type="checkbox" checked={d.off} onChange={(e) => setDay(n, { off: e.target.checked })} />
                    Выходной
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="time"
                    className="h-11 min-w-0 flex-1"
                    value={d.start}
                    disabled={d.off}
                    onChange={(e) => setDay(n, { start: e.target.value })}
                  />
                  <span className="shrink-0 text-muted">–</span>
                  <Input
                    type="time"
                    className="h-11 min-w-0 flex-1"
                    value={d.end}
                    disabled={d.off}
                    onChange={(e) => setDay(n, { end: e.target.value })}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </section>
      <section className="rounded-xl bg-surface p-5 shadow-[var(--shadow-card)]">
        <h2 className="font-display text-lg">Из календаря телефона</h2>
        <p className="mt-1 text-sm text-muted">
          Перенести события из календаря телефона в расписание. Если пациента ещё нет — карточка создастся.
        </p>
        <div className="mt-4">
          <Button type="button" onClick={() => setCalendarOpen(true)}>
            Из календаря
          </Button>
        </div>
      </section>
      <section className="rounded-xl bg-surface p-5 shadow-[var(--shadow-card)]">
        <h2 className="font-display text-lg">Вид и компоновка</h2>
        <p className="mt-1 text-sm text-muted">Что показывать в сетке дня, недели, месяца и года.</p>
        <ul className="mt-4 divide-y divide-line">
          {(
            [
              {
                key: "scheduleShowOccupancy",
                title: "Проценты заполняемости",
                hint: "Цифра занятости в дне, неделе, месяце и годе",
                on: settings.scheduleShowOccupancy !== false,
              },
              {
                key: "scheduleShowFillColors",
                title: "Цвета заполненности",
                hint: "День красится от зелёного к красному по занятости",
                on: settings.scheduleShowFillColors !== false,
              },
              {
                key: "scheduleShowMiniMonth",
                title: "Мини-месяц",
                hint: "Иконка календаря поверх сетки. Долгое нажатие — перетащить",
                on: settings.scheduleShowMiniMonth !== false,
              },
              {
                key: "scheduleShowDayTime",
                title: "Время на записи в дне",
                hint: "Часы начала в правом верхнем углу карточки",
                on: settings.scheduleShowDayTime !== false,
              },
              {
                key: "scheduleShowVisitKind",
                title: "Вид приёма на записи",
                hint: "Осмотр, лечение и остальное в подписи карточки",
                on: settings.scheduleShowVisitKind !== false,
              },
            ] as const
          ).map((row) => (
            <li key={row.key} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="text-sm font-medium">{row.title}</p>
                <p className="mt-0.5 text-[12px] text-muted">{row.hint}</p>
              </div>
              <IosSwitch
                on={row.on}
                label={row.title}
                onChange={(next) => updateSettings({ [row.key]: next })}
              />
            </li>
          ))}
        </ul>
      </section>
      <section className="rounded-xl bg-surface p-5 shadow-[var(--shadow-card)]">
        <h2 className="font-display text-lg">Цвета заполненности</h2>
        <p className="mt-1 text-sm text-muted">
          В виде «Год» и в маленьком месяце день красится по занятости рабочего времени.
        </p>
        <OccupancyLegend className="mt-4" />
      </section>
        </>
      ) : null}

      {section === "notify" ? (
        <>
      <section className="rounded-xl bg-surface p-5 shadow-[var(--shadow-card)]">
        <h2 className="font-display text-lg">Уведомления и календарь</h2>
        <p className="mt-1 text-sm text-muted">
          Шторка телефона — системное уведомление Денты. Календарь — запасной вариант, если программу
          закрыли.
        </p>
        <NotifySetup />
        <p className="mt-4 text-sm text-muted">
          Чтобы приём был в календаре телефона: откройте запись → «В календарь», либо выгрузите все
          ближайшие приёмы файлом.
        </p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted">
          <li>Google Календарь: откроется событие — нажмите «Сохранить».</li>
          <li>Apple: откройте файл .ics в «Календаре».</li>
        </ol>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            variant="outline"
            type="button"
            onClick={() => {
              const s = useClinic.getState();
              const upcoming = s.appointments.filter(
                (a) => a.status !== "cancelled" && a.status !== "no_show" && a.date >= todayISO(),
              );
              if (!upcoming.length) {
                toast.message("Ближайших записей нет");
                return;
              }
              setIcsFile({
                blob: icsBlob(upcoming, s.patients, s.settings, s.services, s.settings.reminderMinutes ?? 60),
                name: "denta-raspisanie.ics",
              });
            }}
          >
            Все записи файлом .ics
          </Button>
        </div>
      </section>

      <NotifyRulesPanel />
        </>
      ) : null}

      {section === "schedule" ? (
      <section className="rounded-xl bg-surface p-5 shadow-[var(--shadow-card)]">
        <h2 className="font-display text-lg">Повторное приглашение</h2>
        <p className="mt-1 text-sm text-muted">Пациенты без визита дольше этого срока попадают в список «Повторно».</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {[
            { l: "3 месяца", d: 90 },
            { l: "6 месяцев", d: 180 },
            { l: "9 месяцев", d: 270 },
            { l: "12 месяцев", d: 365 },
          ].map((p) => (
            <Button
              key={p.d}
              size="sm"
              variant={(settings.recallDays ?? 180) === p.d ? "default" : "secondary"}
              onClick={() => updateSettings({ recallDays: p.d })}
            >
              {p.l}
            </Button>
          ))}
        </div>
        <Field label="Свой интервал, дни" className="mt-3 max-w-xs">
          <Input
            type="number"
            min={1}
            value={settings.recallDays ?? 180}
            onChange={(e) => updateSettings({ recallDays: Math.max(1, Number(e.target.value) || 180) })}
          />
        </Field>
      </section>
      ) : null}

      {section === "look" ? (
      <section className="rounded-xl bg-surface p-5 shadow-[var(--shadow-card)]">
        <h2 className="font-display text-lg">Оформление</h2>
        <p className="mt-1 text-sm text-muted">Светлая, тёмная или как на компьютере.</p>
        <div className="mt-4">
          <ThemePicker />
        </div>
      </section>
      ) : null}

      {section === "backup" ? (
      <section className="rounded-xl bg-surface p-5 shadow-[var(--shadow-card)]">
        <h2 className="font-display text-lg">Резервная копия</h2>
        <p className="mt-2 max-w-prose text-sm text-muted">
          Копия — файл на этом устройстве, не облако. «Сохранить копию» пишет архив zip в папку Документы/ClinicOS и
          предлагает «Поделиться» (Telegram, Диск, флешка). «Восстановить» — выберите этот архив или старый JSON.
          Совпадения карточек программа не сливает сама.
        </p>
        <ul className="mt-4 grid gap-1 sm:grid-cols-2">
          {EXPORT_SECTIONS.map((s) => (
            <label key={s.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={exportSections.includes(s.id)}
                onChange={() => toggleSection(s.id)}
              />
              {s.label}
            </label>
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" disabled={backupBusy} onClick={() => void exportBackup()}>
            {backupBusy ? "Собираю…" : "Сохранить копию"}
          </Button>
          <Button variant="outline" type="button" onClick={() => fileRef.current?.click()}>
            Восстановить из файла
          </Button>
          <Button variant="outline" type="button" onClick={() => setTableOpen(true)}>
            Импорт из таблицы
          </Button>
          <Button variant="outline" className="text-danger" onClick={() => setDemoOpen(true)}>
            Загрузить демо
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".zip,.json,application/zip,application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void importBackup(f);
            }}
          />
        </div>
      </section>
      ) : null}

      {section === "about" ? (
        <>
          <AboutPanel />
          <p className="pb-2 text-center text-[12px] text-muted">{APP_VERSION_LABEL}</p>
        </>
      ) : null}

      <SaveFileDialog
        open={Boolean(icsFile)}
        onOpenChange={(o) => {
          if (!o) setIcsFile(null);
        }}
        blob={icsFile?.blob ?? null}
        filename={icsFile?.name ?? "denta-raspisanie.ics"}
        title="Файл календаря"
        kind="ics"
      />
      {importPreview ? (
        <ImportDialog
          preview={importPreview}
          onOpenChange={(o) => {
            if (!o) setImportPreview(null);
          }}
        />
      ) : null}
      <TableImportDialog open={tableOpen} onOpenChange={setTableOpen} />
      <CalendarImportDialog open={calendarOpen} onOpenChange={setCalendarOpen} />
      <ConfirmDialog
        open={demoOpen}
        onOpenChange={setDemoOpen}
        title="Заменить данные?"
        description="Текущие пациенты, записи и касса будут заменены демонстрационными. Это нельзя отменить."
        confirmLabel="Загрузить демо"
        danger
        onConfirm={() => {
          resetDemo();
          toast.success("Демо-данные загружены");
        }}
      />
    </div>
  );
}

function DiaryTemplatesPanel() {
  const templates = useClinic((s) => s.diaryTemplates);
  const extras = useClinic((s) => s.settings.diaryExtras);
  const addDiaryTemplate = useClinic((s) => s.addDiaryTemplate);
  const updateDiaryTemplate = useClinic((s) => s.updateDiaryTemplate);
  const deleteDiaryTemplate = useClinic((s) => s.deleteDiaryTemplate);
  const addDiaryExtra = useClinic((s) => s.addDiaryExtra);
  const removeDiaryExtra = useClinic((s) => s.removeDiaryExtra);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<DiaryTemplate | null>(null);
  const [askId, setAskId] = useState<string | null>(null);

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <DiaryButtonsEditor extras={extras} onAdd={addDiaryExtra} onRemove={removeDiaryExtra} />
      <section className="rounded-xl bg-surface p-5 shadow-[var(--shadow-card)]">
        <h2 className="font-display text-lg">Шаблоны дневника</h2>
        <p className="mt-1 text-sm text-muted">
          Диагноз и лечение отмечаются отдельно, теми же кнопками, что в приёме. Свой комментарий в приёме не заполняется.
        </p>
        <ul className="mt-3 flex flex-col gap-1">
          {templates.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-2 rounded-md bg-bg px-3 py-2 text-sm">
              <button
                type="button"
                className="min-w-0 flex-1 truncate text-left font-medium"
                onClick={() => {
                  setEditing(t);
                  setOpen(true);
                }}
              >
                {t.name}
              </button>
              <button type="button" className="shrink-0 text-[12px] text-danger" onClick={() => setAskId(t.id)}>
                Удалить
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-3">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            Добавить шаблон
          </Button>
        </div>
        <TemplateDialog
          open={open}
          template={editing}
          extras={extras}
          onAddExtra={addDiaryExtra}
          onOpenChange={(o) => {
            setOpen(o);
            if (!o) setEditing(null);
          }}
          onSave={(draft, id) => {
            if (id) updateDiaryTemplate(id, draft);
            else addDiaryTemplate(draft);
            toast.success("Шаблон сохранён");
          }}
        />
        <ConfirmDialog
          open={Boolean(askId)}
          onOpenChange={(o) => {
            if (!o) setAskId(null);
          }}
          title="Удалить шаблон?"
          description="Это действие нельзя отменить."
          confirmLabel="Удалить"
          onConfirm={() => {
            if (askId) deleteDiaryTemplate(askId);
            setAskId(null);
          }}
        />
      </section>
    </div>
  );
}

const EXTRA_BUCKETS: Array<{ id: DiaryCatalog; title: string }> = [
  { id: "complaints", title: "Жалобы" },
  { id: "anamnesis", title: "Анамнез" },
  { id: "exam", title: "Объективно" },
  { id: "treatments", title: "Лечение" },
  { id: "recommendations", title: "Рекомендации" },
];

function DiaryButtonsEditor({
  extras,
  onAdd,
  onRemove,
}: {
  extras: ReturnType<typeof useClinic.getState>["settings"]["diaryExtras"];
  onAdd: (bucket: DiaryCatalog, label: string) => void;
  onRemove: (bucket: DiaryCatalog, label: string) => void;
}) {
  const [drafts, setDrafts] = useState<Record<DiaryCatalog, string>>({
    complaints: "",
    anamnesis: "",
    exam: "",
    treatments: "",
    recommendations: "",
  });
  const lists = extras ?? {
    complaints: [],
    anamnesis: [],
    exam: [],
    treatments: [],
    recommendations: [],
  };

  return (
    <section className="rounded-xl bg-surface p-5 shadow-[var(--shadow-card)]">
      <h2 className="font-display text-lg">Кнопки дневника</h2>
      <p className="mt-1 text-sm text-muted">
        Новая кнопка появляется в приёме рядом со стандартными. Диагноз берётся из справочника МКБ, лечение — отдельным списком.
      </p>
      <div className="mt-4 flex flex-col gap-4">
        {EXTRA_BUCKETS.map((b) => (
          <div key={b.id} className="min-w-0">
            <p className="mb-1.5 text-[13px] font-medium">{b.title}</p>
            <div className="flex flex-wrap gap-1.5">
              {(lists[b.id] ?? []).length === 0 ? (
                <p className="text-[13px] text-muted">Пока только стандартные кнопки</p>
              ) : (
                (lists[b.id] ?? []).map((label) => (
                  <span
                    key={label}
                    className="inline-flex max-w-full items-center gap-1 rounded-full bg-surface-2 py-1.5 pr-1.5 pl-3 text-[13px]"
                  >
                    <span className="min-w-0 truncate">{label}</span>
                    <button
                      type="button"
                      className="grid size-7 shrink-0 place-items-center rounded-full text-muted hover:bg-surface hover:text-danger"
                      onClick={() => onRemove(b.id, label)}
                      aria-label={`Удалить ${label}`}
                    >
                      ×
                    </button>
                  </span>
                ))
              )}
            </div>
            <div className="mt-2 flex min-w-0 gap-2">
              <Input
                value={drafts[b.id]}
                onChange={(e) => setDrafts((d) => ({ ...d, [b.id]: e.target.value }))}
                placeholder="Новая кнопка"
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  const name = drafts[b.id].trim();
                  if (!name) return;
                  onAdd(b.id, name);
                  setDrafts((d) => ({ ...d, [b.id]: "" }));
                }}
              />
              <Button
                type="button"
                variant="secondary"
                className="shrink-0"
                onClick={() => {
                  const name = drafts[b.id].trim();
                  if (!name) return;
                  onAdd(b.id, name);
                  setDrafts((d) => ({ ...d, [b.id]: "" }));
                }}
              >
                Добавить
              </Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function emptyTpl(): Omit<DiaryTemplate, "id"> {
  return {
    name: "",
    complaints: [],
    complaintsNote: "",
    anamnesis: [],
    anamnesisNote: "",
    exam: [],
    examNote: "",
    recommendations: [],
    recommendationsNote: "",
    diagnosisId: "",
    diagnosisText: "",
    treatments: [],
    materialIds: [],
  };
}

function TemplateDialog({
  open,
  template,
  extras,
  onAddExtra,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  template: DiaryTemplate | null;
  extras: ReturnType<typeof useClinic.getState>["settings"]["diaryExtras"];
  onAddExtra: (bucket: "complaints" | "anamnesis" | "exam" | "treatments" | "recommendations", label: string) => void;
  onOpenChange: (o: boolean) => void;
  onSave: (draft: Omit<DiaryTemplate, "id">, id?: string) => void;
}) {
  const [draft, setDraft] = useState(emptyTpl());
  useEffect(() => {
    if (!open) return;
    setDraft(
      template
        ? {
            name: template.name,
            complaints: template.complaints ?? [],
            complaintsNote: template.complaintsNote ?? "",
            anamnesis: template.anamnesis ?? [],
            anamnesisNote: template.anamnesisNote ?? "",
            exam: template.exam ?? [],
            examNote: template.examNote ?? "",
            recommendations: template.recommendations ?? [],
            recommendationsNote: template.recommendationsNote ?? "",
            diagnosisId: template.diagnosisId ?? "",
            diagnosisText: template.diagnosisText ?? "",
            treatments: template.treatments ?? [],
            materialIds: template.materialIds ?? [],
          }
        : emptyTpl(),
    );
  }, [open, template]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent placement="sheet" className="min-w-0">
        <DialogHeader>
          <DialogTitle>{template ? "Шаблон дневника" : "Новый шаблон"}</DialogTitle>
        </DialogHeader>
        <Field label="Название">
          <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Лечение кариеса" />
        </Field>
        <section className="min-w-0 rounded-lg bg-bg p-3">
          <p className="mb-2 text-[13px] font-bold text-ink">Жалобы</p>
          <ChipGroup
            options={COMPLAINT_OPTIONS}
            extra={extras?.complaints}
            value={draft.complaints}
            onChange={(complaints) => setDraft({ ...draft, complaints })}
            onAdd={(l) => onAddExtra("complaints", l)}
          />
        </section>
        <section className="min-w-0 rounded-lg bg-bg p-3">
          <p className="mb-2 text-[13px] font-bold text-ink">Анамнез</p>
          <ChipGroup
            options={ANAMNESIS_OPTIONS}
            extra={extras?.anamnesis}
            value={draft.anamnesis}
            onChange={(anamnesis) => setDraft({ ...draft, anamnesis })}
            onAdd={(l) => onAddExtra("anamnesis", l)}
          />
        </section>
        <section className="min-w-0 rounded-lg bg-bg p-3">
          <p className="mb-2 text-[13px] font-bold text-ink">Объективно</p>
          <ChipGroup
            options={EXAM_OPTIONS}
            extra={extras?.exam}
            value={draft.exam}
            onChange={(exam) => setDraft({ ...draft, exam })}
            onAdd={(l) => onAddExtra("exam", l)}
          />
        </section>
        <section className="min-w-0 rounded-lg bg-bg p-3">
          <p className="mb-2 text-[13px] font-bold text-ink">Диагноз</p>
          <DiagnosisField
            diagnosisId={draft.diagnosisId}
            diagnosisText={draft.diagnosisText ?? ""}
            onChange={({ diagnosisId, diagnosisText }) => setDraft({ ...draft, diagnosisId, diagnosisText })}
          />
        </section>
        <section className="min-w-0 rounded-lg bg-bg p-3">
          <p className="mb-2 text-[13px] font-bold text-ink">Лечение</p>
          <ChipGroup
            options={TREATMENT_OPTIONS}
            extra={extras?.treatments}
            value={draft.treatments}
            onChange={(treatments) => setDraft({ ...draft, treatments })}
            onAdd={(l) => onAddExtra("treatments", l)}
          />
        </section>
        <section className="min-w-0 rounded-lg bg-bg p-3">
          <p className="mb-2 text-[13px] font-bold text-ink">Материалы</p>
          <MaterialPicker
            value={draft.materialIds ?? []}
            onChange={(materialIds) => setDraft({ ...draft, materialIds })}
          />
        </section>
        <section className="min-w-0 rounded-lg bg-bg p-3">
          <p className="mb-2 text-[13px] font-bold text-ink">Рекомендации</p>
          <ChipGroup
            options={RECOMMEND_OPTIONS}
            extra={extras?.recommendations}
            value={draft.recommendations}
            onChange={(recommendations) => setDraft({ ...draft, recommendations })}
            onAdd={(l) => onAddExtra("recommendations", l)}
          />
        </section>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="ghost" type="button" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button
            type="button"
            onClick={() => {
              if (!draft.name.trim()) return toast.error("Укажите название");
              onSave(
                {
                  ...draft,
                  name: draft.name.trim(),
                  complaintsNote: "",
                  anamnesisNote: "",
                  examNote: "",
                  recommendationsNote: "",
                },
                template?.id,
              );
              onOpenChange(false);
            }}
          >
            Сохранить
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
