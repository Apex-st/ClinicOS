import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Phone, Plus, Send, Stethoscope, Trash2 } from "lucide-react";
import { lazy, Suspense, useEffect, useState } from "react";
import { toast } from "sonner";
import { Odontogram } from "@/components/odontogram";
import { PatientDialog } from "@/components/patient-dialog";
import { PatientPlans } from "@/components/plan-editor";
import { PatientRecall } from "@/components/patient-recall";
import { PhotoArchive } from "@/components/photo-archive";
import { MedicalAlertDialog, MedicalBanner } from "@/components/medical-alert";
import { SendPatientDialog } from "@/components/send-patient";
import { ConfirmDialog } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/field";
import { VisitDialog } from "@/components/visit-dialog";
import { describeDiscount } from "@/lib/discounts";
import { ageYears, DISCOUNT_CATEGORY_LABEL, formatDate, fullName, groupLabel, money, PAYMENT_LABEL, phoneHref, pluralYears, todayISO } from "@/lib/format";
import { optionLabel, VISIT_KIND_LABEL } from "@/lib/diary";
import { patientHasAlert, sourceLabel } from "@/lib/patient-meta";
import { useClinic } from "@/lib/store";
import type { ToothState, ToothStatus, Visit } from "@/lib/types";
import { cn } from "@/lib/utils";

const OrthoCardPanel = lazy(() => import("@/components/ortho-card").then((m) => ({ default: m.OrthoCardPanel })));
const ProsthoCardPanel = lazy(() => import("@/components/prostho-card").then((m) => ({ default: m.ProsthoCardPanel })));

export const Route = createFileRoute("/patients/$id")({ component: PatientPage });

const TABS = [
  { id: "overview", label: "Обзор" },
  { id: "chart", label: "Формула" },
  { id: "ortho", label: "Ортодонтия" },
  { id: "prostho", label: "Ортопедия" },
  { id: "photos", label: "Фотоархив" },
  { id: "plans", label: "Планы" },
  { id: "discounts", label: "Скидки" },
  { id: "recall", label: "Приглашения" },
] as const;

type Tab = (typeof TABS)[number]["id"];

function PatientPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const patients = useClinic((s) => s.patients);
  const patient = patients.find((p) => p.id === id);
  const chart = useClinic((s) => s.charts[id]);
  const allVisits = useClinic((s) => s.visits);
  const allAppointments = useClinic((s) => s.appointments);
  const visits = allVisits.filter((v) => v.patientId === id);
  const appointments = allAppointments
    .filter((a) => a.patientId === id && a.date >= todayISO() && a.status !== "cancelled")
    .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  const services = useClinic((s) => s.services);
  const discounts = useClinic((s) => s.discounts);
  const photos = useClinic((s) => s.photos);
  const plans = useClinic((s) => s.plans);
  const setTooth = useClinic((s) => s.setTooth);
  const deletePatient = useClinic((s) => s.deletePatient);
  const updatePatient = useClinic((s) => s.updatePatient);

  const [edit, setEdit] = useState(false);
  const [visitOpen, setVisitOpen] = useState(false);
  const [viewVisit, setViewVisit] = useState<Visit | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");
  const [send, setSend] = useState(false);
  const [medOpen, setMedOpen] = useState(false);

  const patientsAll = patients;
  const tags = useClinic((s) => s.tags);
  const customSocials = useClinic((s) => s.customSocials);

  useEffect(() => {
    if (patient && patientHasAlert(patient)) setMedOpen(true);
    else setMedOpen(false);
  }, [patient?.id]);

  if (!patient) {
    return (
      <div className="py-16 text-center">
        <p className="font-display text-2xl">Пациент не найден</p>
        <Link to="/patients" className="mt-3 inline-block text-sm text-primary">
          К списку
        </Link>
      </div>
    );
  }

  const age = ageYears(patient.birthDate);
  const bal = visits.filter((v) => !v.voidedAt).reduce((s, v) => s + (v.total - v.paid), 0);
  const referrer = patients.find((p) => p.id === patient.referredById);
  const assigned = discounts.find((d) => d.id === patient.discountTypeId);
  const photoCount = photos.filter((p) => p.patientId === id).length;
  const planCount = plans.filter((p) => p.patientId === id).length;
  const lastVisit = [...visits].filter((v) => !v.voidedAt).sort((a, b) => b.date.localeCompare(a.date))[0];
  const namedTags = tags.filter((t) => (patient.tagIds ?? []).includes(t.id));
  const origin = sourceLabel(patient, patientsAll, customSocials);

  function onTooth(fdi: number, status: ToothStatus, note: string, surfaces?: ToothState["surfaces"]) {
    setTooth(patient!.id, fdi, status, note, surfaces);
  }

  return (
    <div className="flex flex-col gap-5">
      <Link to="/patients" className="inline-flex w-fit items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4" />
        Пациенты
      </Link>

      <header className="flex flex-col gap-4 rounded-xl bg-surface p-5 shadow-[var(--shadow-card)] sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[12px] text-muted">Карта {patient.cardNumber || "без номера"} · ID {patient.id}</p>
          <h1 className="font-display text-3xl">{fullName(patient)}</h1>
          <p className="mt-1 text-sm text-muted">
            {age != null ? pluralYears(age) : "возраст не указан"}
            {patient.birthDate ? ` · ${formatDate(patient.birthDate, "d MMMM yyyy")}` : ""}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {patientHasAlert(patient) ? <Badge tone="danger">Мед. предупреждение</Badge> : null}
            {namedTags.map((t) => (
              <Badge key={t.id} tone="primary">
                {t.name}
              </Badge>
            ))}
            {bal > 0 ? <Badge tone="danger">Долг {money(bal)}</Badge> : <Badge tone="ok">Счета закрыты</Badge>}
            {assigned ? <Badge tone="primary">{assigned.name}</Badge> : null}
            {lastVisit?.kind ? (
              <Badge tone="muted">Последний: {VISIT_KIND_LABEL[lastVisit.kind]}</Badge>
            ) : null}
          </div>
          {patientHasAlert(patient) ? (
            <div className="mt-3 max-w-xl">
              <MedicalBanner patient={patient} />
            </div>
          ) : null}
          {patient.phone ? (
            <a href={phoneHref(patient.phone)} className="mt-3 inline-flex items-center gap-2 text-sm text-primary">
              <Phone className="size-4" />
              {patient.phone}
            </a>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setEdit(true)}>
            Изменить
          </Button>
          <Button variant="outline" type="button" onClick={() => setSend(true)}>
            <Send className="size-4" />
            Отправить
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              navigate({
                to: "/schedule/new",
                search: { date: todayISO(), start: "10:00", patientId: patient.id },
              } as never)
            }
          >
            <Plus className="size-4" />
            Записать
          </Button>
          <Button onClick={() => setVisitOpen(true)}>
            <Stethoscope className="size-4" />
            Приём
          </Button>
        </div>
      </header>

      <div className="flex gap-1 overflow-x-auto rounded-lg bg-surface-2 p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "h-10 shrink-0 rounded-md px-3 text-sm font-medium",
              tab === t.id ? "bg-surface text-ink shadow-[var(--shadow-card)]" : "text-muted hover:text-ink",
            )}
          >
            {t.label}
            {t.id === "photos" && photoCount ? ` ${photoCount}` : ""}
            {t.id === "plans" && planCount ? ` ${planCount}` : ""}
          </button>
        ))}
      </div>

      {tab === "overview" ? (
        <>
          <div className="flex flex-col gap-4">
            <section className="rounded-xl bg-surface p-4 shadow-[var(--shadow-card)] sm:p-5">
              <h2 className="font-display text-lg">Карточка</h2>
              <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                <Row label="Адрес" value={patient.address || "—"} />
                <Row label="Почта" value={patient.email || "—"} />
                <Row label="Откуда узнали" value={origin} />
                <Row
                  label="Группы"
                  value={namedTags.length ? namedTags.map((t) => t.name).join(", ") : "—"}
                />
                <Row
                  label="Кто рекомендовал"
                  value={referrer ? fullName(referrer) : patient.referredById ? patient.referredById : "—"}
                />
                <Row label="Заметки" value={patient.notes || "—"} />
              </dl>
              {appointments[0] ? (
                <p className="mt-3 text-sm text-muted">
                  Следующая запись: {formatDate(appointments[0].date, "d MMMM")} в {appointments[0].start}
                </p>
              ) : (
                <p className="mt-3 text-sm text-muted">Нет ближайших записей</p>
              )}
            </section>
            <Odontogram
              chart={chart ?? {}}
              onChange={onTooth}
              patientAge={age}
              dentition={patient.dentitionMode}
              onDentitionChange={(mode) => updatePatient(patient.id, { dentitionMode: mode })}
            />
          </div>
          <VisitHistory visits={visits} services={services} onOpen={setViewVisit} />
        </>
      ) : null}

      {tab === "chart" ? (
        <Odontogram
          chart={chart ?? {}}
          onChange={onTooth}
          patientAge={age}
          dentition={patient.dentitionMode}
          onDentitionChange={(mode) => updatePatient(patient.id, { dentitionMode: mode })}
        />
      ) : null}
      {tab === "ortho" ? (
        <Suspense fallback={<p className="text-sm text-muted">Загрузка ортодонтической карты…</p>}>
          <OrthoCardPanel patientId={patient.id} />
        </Suspense>
      ) : null}
      {tab === "prostho" ? (
        <Suspense fallback={<p className="text-sm text-muted">Загрузка ортопедической карты…</p>}>
          <ProsthoCardPanel patientId={patient.id} />
        </Suspense>
      ) : null}
      {tab === "photos" ? <PhotoArchive patientId={patient.id} /> : null}
      {tab === "plans" ? <PatientPlans patientId={patient.id} /> : null}
      {tab === "discounts" ? (
        <section className="rounded-xl bg-surface p-5 shadow-[var(--shadow-card)]">
          <h2 className="font-display text-lg">Скидки пациента</h2>
          <p className="mt-1 text-sm text-muted">
            На карточке действует один тип. Второй не суммируется — он заменяет текущий.
          </p>
          <div className="mt-4 max-w-md">
            <Field label="Назначенная скидка">
              <Select
                value={patient.discountTypeId}
                onChange={(e) => {
                  const next = e.target.value;
                  if (patient.discountTypeId && next && next !== patient.discountTypeId) {
                    const n = discounts.find((d) => d.id === next);
                    toast.message("Скидки не суммируются", {
                      description: n ? `Будет применено: ${describeDiscount(n)}` : "",
                    });
                  }
                  updatePatient(patient.id, { discountTypeId: next });
                }}
              >
                <option value="">Нет</option>
                {discounts
                  .filter((d) => d.active)
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} · {describeDiscount(d)} · {DISCOUNT_CATEGORY_LABEL[d.category]}
                    </option>
                  ))}
              </Select>
            </Field>
          </div>
          {referrer ? (
            <p className="mt-4 text-sm">
              Реферальная связь: рекомендовал{" "}
              <Link to="/patients/$id" params={{ id: referrer.id }} className="text-primary">
                {fullName(referrer)}
              </Link>
            </p>
          ) : null}
        </section>
      ) : null}
      {tab === "recall" ? <PatientRecall patient={patient} /> : null}

      <Button
        type="button"
        variant="ghost"
        className="self-start text-danger hover:bg-danger/10"
        onClick={() => setDeleteOpen(true)}
      >
        <Trash2 className="size-4" />
        Удалить карточку
      </Button>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Удалить карточку?"
        description={`${fullName(patient)} — вместе с записями, приёмами, фото и планами. Это нельзя отменить.`}
        confirmLabel="Удалить"
        onConfirm={() => {
          deletePatient(patient.id);
          toast.success("Карточка удалена");
          void navigate({ to: "/patients" });
        }}
      />

      <PatientDialog open={edit} onOpenChange={setEdit} patient={patient} />
      <SendPatientDialog open={send} onOpenChange={setSend} patient={patient} />
      <MedicalAlertDialog patient={patient} open={medOpen} onOpenChange={setMedOpen} />
      <VisitDialog open={visitOpen} onOpenChange={setVisitOpen} patientId={patient.id} />
      <VisitDialog
        open={Boolean(viewVisit)}
        onOpenChange={(o) => {
          if (!o) setViewVisit(null);
        }}
        visit={viewVisit}
        patientId={patient.id}
      />
    </div>
  );
}

function VisitHistory({
  visits,
  services,
  onOpen,
}: {
  visits: Visit[];
  services: Array<{ id: string; name: string; category: string }>;
  onOpen: (v: Visit) => void;
}) {
  const groups = useClinic((s) => s.groups);
  const diagnoses = useClinic((s) => s.diagnoses);
  return (
    <section>
      <h2 className="mb-3 font-display text-xl">История приёмов</h2>
      {visits.length === 0 ? (
        <p className="text-sm text-muted">Приёмов пока нет</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {visits
            .slice()
            .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
            .map((v) => {
              const findings = v.diary?.findings ?? [];
              return (
                <li key={v.id} className={v.voidedAt ? "opacity-60" : ""}>
                  <button
                    type="button"
                    className="w-full rounded-lg bg-surface px-4 py-3 text-left shadow-[var(--shadow-card)] hover:bg-surface-2"
                    onClick={() => onOpen(v)}
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="font-medium">
                        {formatDate(v.date, "d MMMM yyyy")}
                        {v.kind ? (
                          <span className="ml-2 text-[13px] font-normal text-muted">
                            {VISIT_KIND_LABEL[v.kind]}
                          </span>
                        ) : null}
                        {v.voidedAt ? (
                          <span className="ml-2 text-[13px] font-normal text-danger">аннулирован</span>
                        ) : null}
                      </p>
                      <p className="text-sm tabular-nums">
                        {money(v.total)}
                        {v.voidedAt ? (
                          <span className="text-muted"> · не в кассе</span>
                        ) : v.paid < v.total ? (
                          <span className="text-danger"> · долг {money(v.total - v.paid)}</span>
                        ) : (
                          <span className="text-muted">
                            {" "}
                            · {v.paymentMethod ? PAYMENT_LABEL[v.paymentMethod] : "оплачено"}
                          </span>
                        )}
                      </p>
                    </div>
                    {findings.length ? (
                      <ul className="mt-2 text-[13px] text-muted">
                        {findings.map((f) => (
                          <li key={f.id}>
                            {f.toothFdi ? `${f.toothFdi} зуб — ` : ""}
                            {f.diagnosisText || optionLabel("diagnosis", f.diagnosisId, diagnoses) || "диагноз"}
                            {f.treatments.length
                              ? ` · ${f.treatments.map((t) => optionLabel("treatments", t)).join(", ")}`
                              : ""}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <ul className="mt-2 text-[13px] text-muted">
                        {v.items.map((it) => {
                          const svc = services.find((s) => s.id === it.serviceId);
                          return (
                            <li key={it.id}>
                              {svc?.name ?? "Услуга"}
                              {it.toothFdi ? ` · зуб ${it.toothFdi}` : ""}
                              {svc ? ` · ${groupLabel(groups, svc.category)}` : ""}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                    {v.diary?.text ? (
                      <p className="mt-2 line-clamp-3 text-sm whitespace-pre-line">{v.diary.text}</p>
                    ) : v.notes ? (
                      <p className="mt-2 text-sm">{v.notes}</p>
                    ) : null}
                  </button>
                </li>
              );
            })}
        </ul>
      )}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[12px] text-muted">{label}</dt>
      <dd className="mt-0.5">{value}</dd>
    </div>
  );
}
