import { create } from "zustand";
import { persist } from "zustand/middleware";
import { clearAllPhotoBlobs, deletePhotoBlobs } from "./photos-idb";
import { buildSeed, defaultSettings, seedCharts, seedDiaryTemplates, seedDiscountTypes, seedDoctors, seedPatients, seedServiceGroups } from "./seed";
import { diagnosisToTooth, emptyDiary, emptyFinding, enrichDiaryTemplates, suggestVisitKind, treatmentToTooth } from "./diary";
import { nextAfter, seedBudgetCategories } from "./budget";
import { seedStockGroups, seedStockItems, usedMaterialIds } from "./stock";
import { seedDiagnoses, ensureDiagnosisTemplates, defaultDiagnosisTemplate } from "./icd";
import { seedMessageTemplates, seedNotifyRules } from "./messages";
import { seedTags } from "./patient-meta";
import { emptyDiaryExtras } from "./stats";
import { mergeOrtho, mergeProstho } from "./specialty";
import { ALL_CHART_FDI, normalizeTooth, resolveToothStatuses } from "./teeth";
import { normalizePdfLayout } from "./pdf-layout";
import type {
  Appointment,
  BudgetCategory,
  BudgetOp,
  BudgetPlan,
  BudgetRecurring,
  BudgetVendor,
  Chart,
  ContactLog,
  DiagnosisDef,
  DiaryExtras,
  DiaryTemplate,
  DiscountType,
  Doctor,
  MessageTemplate,
  NotifyRule,
  Patient,
  PatientTag,
  PhotoAlbum,
  PhotoMeta,
  OrthoCard,
  ProsthoCard,
  RecallStatus,
  Service,
  ServiceGroup,
  Settings,
  StockGroup,
  StockItem,
  ToothState,
  ToothStatus,
  TreatmentPlan,
  Visit,
  VisitDiary,
  VisitItem,
  VisitKind,
} from "./types";
import { uid } from "./utils";

export type PatientDraft = Omit<Patient, "id" | "createdAt">;
export type AppointmentDraft = Omit<Appointment, "id">;
export type VisitDraft = Omit<Visit, "id" | "total" | "createdAt">;
export type ServiceDraft = Omit<Service, "id">;
export type PlanDraft = Omit<TreatmentPlan, "id" | "createdAt" | "updatedAt">;
export type DiscountDraft = Omit<DiscountType, "id">;
export type DoctorDraft = Omit<Doctor, "id">;
export type GroupDraft = Omit<ServiceGroup, "id">;

export interface ClinicData {
  patients: Patient[];
  services: Service[];
  appointments: Appointment[];
  visits: Visit[];
  charts: Record<string, Chart>;
  settings: Settings;
  photos: PhotoMeta[];
  albums: PhotoAlbum[];
  plans: TreatmentPlan[];
  discounts: DiscountType[];
  contacts: ContactLog[];
  doctors: Doctor[];
  groups: ServiceGroup[];
  diaryTemplates: DiaryTemplate[];
  tags: PatientTag[];
  diagnoses: DiagnosisDef[];
  messageTemplates: MessageTemplate[];
  notifyRules: NotifyRule[];
  customSocials: string[];
  customMedical: { id: string; name: string }[];
  budgetOps: BudgetOp[];
  budgetCategories: BudgetCategory[];
  budgetVendors: BudgetVendor[];
  budgetRecurring: BudgetRecurring[];
  budgetPlans: BudgetPlan[];
  stockGroups: StockGroup[];
  stockItems: StockItem[];
  orthoCards: Record<string, OrthoCard>;
  prosthoCards: Record<string, ProsthoCard>;
}

interface ClinicActions {
  addPatient: (draft: PatientDraft) => string;
  updatePatient: (id: string, patch: Partial<PatientDraft>) => void;
  deletePatient: (id: string) => void;
  deletePatients: (ids: string[]) => void;
  addAppointment: (draft: AppointmentDraft) => string;
  updateAppointment: (id: string, patch: Partial<Appointment>) => void;
  deleteAppointment: (id: string) => void;
  addVisit: (draft: VisitDraft) => string;
  updateVisit: (id: string, patch: Partial<Visit>) => void;
  deleteVisit: (id: string) => boolean;
  voidVisit: (id: string, reason: string, by: string) => boolean;
  addPayment: (visitId: string, amount: number, method: Visit["paymentMethod"]) => void;
  addService: (draft: ServiceDraft) => string;
  updateService: (id: string, patch: Partial<Service>) => void;
  deleteService: (id: string) => void;
  addGroup: (name: string) => string;
  updateGroup: (id: string, patch: Partial<Pick<ServiceGroup, "name" | "sort">>) => void;
  deleteGroup: (id: string, moveTo?: string, dropServices?: boolean) => void;
  setTooth: (patientId: string, fdi: number, status: ToothStatus, note?: string, surfaces?: ToothState["surfaces"]) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  addPhotoMeta: (meta: PhotoMeta) => void;
  updatePhoto: (
    id: string,
    patch: Partial<Pick<PhotoMeta, "description" | "category" | "date" | "toothFdi" | "albumId" | "visitId" | "specialty" | "shot" | "stage">>,
  ) => void;
  deletePhoto: (id: string) => void;
  addAlbum: (draft: Omit<PhotoAlbum, "id" | "createdAt">) => string;
  updateAlbum: (id: string, patch: Partial<Omit<PhotoAlbum, "id" | "patientId" | "createdAt">>) => void;
  deleteAlbum: (id: string, withPhotos: boolean) => void;
  addPlan: (draft: PlanDraft) => string;
  updatePlan: (id: string, patch: Partial<PlanDraft>) => void;
  deletePlan: (id: string) => void;
  addDiscount: (draft: DiscountDraft) => string;
  updateDiscount: (id: string, patch: Partial<DiscountType>) => void;
  deleteDiscount: (id: string) => void;
  addContact: (patientId: string, kind: ContactLog["kind"], text: string, status?: RecallStatus) => void;
  setRecallStatus: (patientId: string, status: RecallStatus, note?: string) => void;
  addDoctor: (draft: DoctorDraft) => string;
  updateDoctor: (id: string, patch: Partial<Doctor>) => void;
  deleteDoctor: (id: string) => void;
  addDiaryTemplate: (draft: Omit<DiaryTemplate, "id">) => string;
  updateDiaryTemplate: (id: string, patch: Partial<DiaryTemplate>) => void;
  deleteDiaryTemplate: (id: string) => void;
  addDiaryExtra: (bucket: keyof DiaryExtras, label: string) => void;
  removeDiaryExtra: (bucket: keyof DiaryExtras, label: string) => void;
  addTag: (name: string) => string;
  updateTag: (id: string, patch: Partial<PatientTag>) => void;
  deleteTag: (id: string) => void;
  addDiagnosis: (draft: Omit<DiagnosisDef, "id">) => string;
  updateDiagnosis: (id: string, patch: Partial<DiagnosisDef>) => void;
  deleteDiagnosis: (id: string) => void;
  addMessageTemplate: (draft: Omit<MessageTemplate, "id">) => string;
  updateMessageTemplate: (id: string, patch: Partial<MessageTemplate>) => void;
  deleteMessageTemplate: (id: string) => void;
  updateNotifyRule: (id: string, patch: Partial<NotifyRule>) => void;
  addCustomSocial: (name: string) => void;
  addCustomMedical: (name: string) => void;
  addBudgetOp: (draft: Omit<BudgetOp, "id" | "createdAt">) => string;
  updateBudgetOp: (id: string, patch: Partial<Omit<BudgetOp, "id" | "createdAt">>) => boolean;
  deleteBudgetOp: (id: string) => boolean;
  addBudgetCategory: (kind: BudgetCategory["kind"], name: string) => string;
  updateBudgetCategory: (id: string, patch: Partial<Pick<BudgetCategory, "name" | "archived" | "sort">>) => void;
  deleteBudgetCategory: (id: string, moveTo?: string) => boolean;
  addBudgetVendor: (draft: Omit<BudgetVendor, "id">) => string;
  updateBudgetVendor: (id: string, patch: Partial<Omit<BudgetVendor, "id">>) => void;
  deleteBudgetVendor: (id: string) => void;
  addBudgetRecurring: (draft: Omit<BudgetRecurring, "id">) => string;
  updateBudgetRecurring: (id: string, patch: Partial<BudgetRecurring>) => void;
  deleteBudgetRecurring: (id: string) => void;
  postDueRecurring: (today: string, by: string) => number;
  setBudgetPlan: (month: string, items: BudgetPlan["items"]) => void;
  addStockGroup: (name: string) => string;
  updateStockGroup: (id: string, patch: Partial<Pick<StockGroup, "name" | "sort">>) => void;
  deleteStockGroup: (id: string, moveTo?: string, dropItems?: boolean) => void;
  addStockItem: (draft: Omit<StockItem, "id">) => string;
  updateStockItem: (id: string, patch: Partial<Omit<StockItem, "id">>) => void;
  deleteStockItem: (id: string) => void;
  updateOrtho: (patientId: string, patch: Partial<OrthoCard>) => void;
  updateProstho: (patientId: string, patch: Partial<ProsthoCard>) => void;
  importSnapshot: (data: ClinicData) => void;
  resetDemo: () => void;
}

export type ClinicState = ClinicData & ClinicActions;

function emptyChart(): Chart {
  const chart: Chart = {};
  for (const fdi of ALL_CHART_FDI) chart[fdi] = { status: "healthy", note: "" };
  return chart;
}

function normalizeChart(chart: Chart | undefined): Chart {
  const base = emptyChart();
  if (!chart) return base;
  for (const key of Object.keys(chart)) {
    const fdi = Number(key);
    if (!Number.isFinite(fdi)) continue;
    base[fdi] = normalizeTooth(chart[fdi]);
  }
  return base;
}

function visitTotal(items: VisitItem[], discount: number) {
  const sub = items.reduce((s, i) => s + i.price * i.qty, 0);
  return Math.max(0, sub - discount);
}

function nextCardNumber(patients: Patient[]) {
  const nums = patients
    .map((p) => Number(/(\d+)/.exec(p.cardNumber ?? "")?.[1] ?? 0))
    .filter((n) => n > 0);
  const n = (nums.length ? Math.max(...nums) : 1000) + 1;
  return `МК-${n}`;
}

export function normalizeDoctor(d: Doctor): Doctor {
  return {
    ...d,
    role: d.role === "admin" || d.role === "chief" || d.role === "doctor" ? d.role : "doctor",
    sharePercent: Number.isFinite(d.sharePercent) ? Math.max(0, Math.min(100, d.sharePercent)) : 40,
  };
}

function normalizeVisit(v: Visit, all: Visit[]): Visit {
  const kind: VisitKind =
    v.kind ??
    (all.some(
      (x) =>
        x.patientId === v.patientId &&
        x.id !== v.id &&
        (x.date < v.date || (x.date === v.date && (x.createdAt || "") < (v.createdAt || ""))),
    )
      ? "repeat"
      : "primary");
  return {
    ...v,
    kind,
    diary: v.diary
      ? {
          ...emptyDiary(),
          ...v.diary,
          findings: (v.diary.findings ?? []).map((f) => ({
            ...emptyFinding(),
            ...f,
            treatments: f.treatments ?? [],
            examChips: f.examChips ?? [],
          })),
        }
      : emptyDiary(),
  };
}

function applyDiaryToChart(chart: Chart, diary: VisitDiary | undefined, diagnoses: DiagnosisDef[]): Chart {
  if (!diary?.findings.length) return chart;
  const next = { ...chart };
  for (const f of diary.findings) {
    if (f.toothFdi == null) continue;
    const fromDx = diagnosisToTooth(f.diagnosisId, diagnoses);
    const fromTx = treatmentToTooth(f.treatments);
    const status = fromTx ?? fromDx;
    if (!status) continue;
    const prev = next[f.toothFdi] ?? { status: "healthy" as const, note: "" };
    next[f.toothFdi] = { ...prev, status };
  }
  return next;
}

function normalizePatient(p: Patient): Patient {
  const flags = [...(p.medicalFlags ?? [])];
  if ((p.allergies || "").trim() && !flags.includes("allergy")) flags.push("allergy");
  const dentition =
    p.dentitionMode === "permanent" || p.dentitionMode === "primary" || p.dentitionMode === "mixed"
      ? p.dentitionMode
      : undefined;
  return {
    ...p,
    cardNumber: p.cardNumber || "",
    referredById: p.referredById || "",
    discountTypeId: p.discountTypeId || "",
    recallStatus: p.recallStatus || "none",
    sourceKind: p.sourceKind || (p.referredById ? "patient" : "none"),
    sourceSocial: p.sourceSocial || "",
    sourceNote: p.sourceNote || "",
    tagIds: p.tagIds ?? [],
    medicalFlags: flags,
    medicalNote: p.medicalNote || "",
    dentitionMode: dentition,
    updatedAt: p.updatedAt || p.createdAt || "",
  };
}

const seed = buildSeed();

function brandName(name?: string) {
  if (!name || name === "Дента" || name === "Denta") return "ClinicOS";
  return name;
}

export const useClinic = create<ClinicState>()(
  persist(
    (set, get) => ({
      ...seed,
      albums: [],
      tags: seedTags(),
      diagnoses: seedDiagnoses(),
      messageTemplates: seedMessageTemplates(),
      notifyRules: seedNotifyRules(),
      customSocials: [],
      customMedical: [],
      budgetOps: [],
      budgetCategories: seedBudgetCategories(),
      budgetVendors: [],
      budgetRecurring: [],
      budgetPlans: [],
      stockGroups: seedStockGroups(),
      stockItems: seedStockItems(),
      orthoCards: {},
      prosthoCards: {},
      addPatient: (draft) => {
        const id = uid("p");
        const patient: Patient = {
          ...normalizePatient(draft as Patient),
          id,
          cardNumber: draft.cardNumber.trim() || nextCardNumber(get().patients),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        set({
          patients: [patient, ...get().patients],
          charts: { ...get().charts, [id]: emptyChart() },
        });
        return id;
      },
      updatePatient: (id, patch) => {
        set({
          patients: get().patients.map((p) =>
            p.id === id ? normalizePatient({ ...p, ...patch, updatedAt: new Date().toISOString() }) : p,
          ),
        });
      },
      deletePatient: (id) => {
        get().deletePatients([id]);
      },
      deletePatients: (ids) => {
        const drop = new Set(ids);
        if (drop.size === 0) return;
        const { patients, appointments, visits, charts, photos, albums, plans, contacts, orthoCards, prosthoCards } = get();
        const nextCharts = { ...charts };
        const nextOrtho = { ...(orthoCards ?? {}) };
        const nextProstho = { ...(prosthoCards ?? {}) };
        for (const id of drop) {
          delete nextCharts[id];
          delete nextOrtho[id];
          delete nextProstho[id];
        }
        const photoIds = photos.filter((ph) => drop.has(ph.patientId)).map((ph) => ph.id);
        void deletePhotoBlobs(photoIds);
        set({
          patients: patients
            .filter((p) => !drop.has(p.id))
            .map((p) => (p.referredById && drop.has(p.referredById) ? { ...p, referredById: "" } : p)),
          appointments: appointments.filter((a) => !drop.has(a.patientId)),
          visits: visits.filter((v) => !drop.has(v.patientId)),
          charts: nextCharts,
          photos: photos.filter((ph) => !drop.has(ph.patientId)),
          albums: (albums ?? []).filter((a) => !drop.has(a.patientId)),
          plans: plans.filter((pl) => !drop.has(pl.patientId)),
          contacts: contacts.filter((c) => !drop.has(c.patientId)),
          orthoCards: nextOrtho,
          prosthoCards: nextProstho,
        });
      },
      addAppointment: (draft) => {
        const id = uid("a");
        const now = new Date().toISOString();
        set({ appointments: [...get().appointments, { ...draft, id, createdAt: now, updatedAt: now }] });
        return id;
      },
      updateAppointment: (id, patch) => {
        set({
          appointments: get().appointments.map((a) =>
            a.id === id ? { ...a, ...patch, updatedAt: new Date().toISOString() } : a,
          ),
        });
      },
      deleteAppointment: (id) => {
        set({ appointments: get().appointments.filter((a) => a.id !== id) });
      },
      addVisit: (draft) => {
        const id = uid("v");
        const total = visitTotal(draft.items, draft.discount);
        const fallbackDoctor = get().doctors[0]?.id ?? "doc_ivanov";
        const appt = draft.appointmentId
          ? get().appointments.find((a) => a.id === draft.appointmentId)
          : undefined;
        const visit: Visit = {
          ...draft,
          id,
          total,
          doctorId: draft.doctorId || appt?.doctorId || fallbackDoctor,
          kind: draft.kind || appt?.visitKind || suggestVisitKind(get().visits, draft.patientId),
          diary: draft.diary ?? emptyDiary(),
          createdAt: new Date().toISOString(),
        };
        const services = get().services;
        const charts = { ...get().charts };
        const chart = { ...(charts[draft.patientId] ?? emptyChart()) };
        for (const item of draft.items) {
          if (item.toothFdi == null) continue;
          const svc = services.find((s) => s.id === item.serviceId);
          if (svc?.impliesStatus) {
            const prev = chart[item.toothFdi] ?? { status: "healthy" as const, note: "" };
            chart[item.toothFdi] = { ...prev, status: svc.impliesStatus };
          }
        }
        charts[draft.patientId] = applyDiaryToChart(chart, visit.diary, get().diagnoses);
        const appointments = draft.appointmentId
          ? get().appointments.map((a) =>
              a.id === draft.appointmentId ? { ...a, status: "done" as const } : a,
            )
          : get().appointments;
        const patients = get().patients.map((p) =>
          p.id === draft.patientId && p.recallStatus !== "booked" ? { ...p, recallStatus: "none" as const } : p,
        );
        const used = usedMaterialIds(visit.diary);
        const stockItems = used.length
          ? get().stockItems.map((m) => (used.includes(m.id) ? { ...m, qty: Math.max(0, Math.round(Number(m.qty) || 0) - 1) } : m))
          : get().stockItems;
        set({ visits: [visit, ...get().visits], charts, appointments, patients, stockItems });
        return id;
      },
      updateVisit: (id, patch) => {
        const prev = get().visits.find((v) => v.id === id);
        if (!prev) return;
        const next: Visit = {
          ...prev,
          ...patch,
          id,
          total: patch.items ? visitTotal(patch.items, patch.discount ?? prev.discount) : prev.total,
          updatedAt: new Date().toISOString(),
        };
        const charts = { ...get().charts };
        if (next.diary) {
          const chart = { ...(charts[next.patientId] ?? emptyChart()) };
          charts[next.patientId] = applyDiaryToChart(chart, next.diary, get().diagnoses);
        }
        set({
          visits: get().visits.map((v) => (v.id === id ? next : v)),
          charts,
        });
      },
      deleteVisit: (id) => {
        const visit = get().visits.find((v) => v.id === id);
        if (!visit) return false;
        if (visit.paid > 0 || visit.voidedAt) return false;
        set({ visits: get().visits.filter((v) => v.id !== id) });
        return true;
      },
      voidVisit: (id, reason, by) => {
        const visit = get().visits.find((v) => v.id === id);
        if (!visit || visit.voidedAt) return false;
        set({
          visits: get().visits.map((v) =>
            v.id === id
              ? {
                  ...v,
                  voidedAt: new Date().toISOString(),
                  voidReason: reason.trim(),
                  voidedBy: by.trim() || "Администратор",
                  updatedAt: new Date().toISOString(),
                }
              : v,
          ),
        });
        return true;
      },
      addPayment: (visitId, amount, method) => {
        set({
          visits: get().visits.map((v) =>
            v.id === visitId && !v.voidedAt
              ? {
                  ...v,
                  paid: Math.min(v.total, v.paid + amount),
                  paymentMethod: method ?? v.paymentMethod,
                }
              : v,
          ),
        });
      },
      addService: (draft) => {
        const id = uid("s");
        set({ services: [...get().services, { ...draft, id }] });
        return id;
      },
      updateService: (id, patch) => {
        set({
          services: get().services.map((s) => (s.id === id ? { ...s, ...patch } : s)),
        });
      },
      deleteService: (id) => {
        set({ services: get().services.filter((s) => s.id !== id) });
      },
      addGroup: (name) => {
        const id = uid("g");
        const sort = (get().groups.at(-1)?.sort ?? -1) + 1;
        set({ groups: [...get().groups, { id, name: name.trim() || "Группа", sort }] });
        return id;
      },
      updateGroup: (id, patch) => {
        set({
          groups: get().groups.map((g) => (g.id === id ? { ...g, ...patch, name: patch.name?.trim() || g.name } : g)),
        });
      },
      deleteGroup: (id, moveTo, dropServices) => {
        const rest = get().groups.filter((g) => g.id !== id);
        if (rest.length === 0) return;
        if (dropServices) {
          set({
            groups: rest,
            services: get().services.filter((s) => s.category !== id),
          });
          return;
        }
        const fallback = moveTo && rest.some((g) => g.id === moveTo) ? moveTo : rest[0].id;
        set({
          groups: rest,
          services: get().services.map((s) => (s.category === id ? { ...s, category: fallback } : s)),
        });
      },
      setTooth: (patientId, fdi, status, note, surfaces) => {
        const charts = { ...get().charts };
        const chart = { ...(charts[patientId] ?? emptyChart()) };
        chart[fdi] = normalizeTooth({
          status,
          note: note ?? chart[fdi]?.note ?? "",
          surfaces,
        });
        charts[patientId] = chart;
        set({ charts });
      },
      updateSettings: (patch) => {
        set({ settings: { ...get().settings, ...patch } });
      },
      addPhotoMeta: (meta) => {
        set({ photos: [meta, ...get().photos] });
      },
      updatePhoto: (id, patch) => {
        set({
          photos: get().photos.map((p) => (p.id === id ? { ...p, ...patch } : p)),
        });
      },
      deletePhoto: (id) => {
        void deletePhotoBlobs([id]);
        set({ photos: get().photos.filter((p) => p.id !== id) });
      },
      addAlbum: (draft) => {
        const id = uid("alb");
        const album: PhotoAlbum = {
          ...draft,
          id,
          title: draft.title.trim() || "Папка",
          description: draft.description ?? "",
          createdAt: new Date().toISOString(),
        };
        set({ albums: [album, ...(get().albums ?? [])] });
        return id;
      },
      updateAlbum: (id, patch) => {
        const albums = get().albums ?? [];
        const prev = albums.find((a) => a.id === id);
        set({
          albums: albums.map((a) => (a.id === id ? { ...a, ...patch } : a)),
          photos: get().photos.map((p) => {
            if (p.albumId !== id) return p;
            const next = { ...p };
            if ("visitId" in patch) next.visitId = patch.visitId;
            if ("toothFdi" in patch && (p.toothFdi == null || p.toothFdi === prev?.toothFdi)) {
              next.toothFdi = patch.toothFdi;
            }
            return next;
          }),
        });
      },
      deleteAlbum: (id, withPhotos) => {
        const photos = get().photos;
        if (withPhotos) {
          const ids = photos.filter((p) => p.albumId === id).map((p) => p.id);
          void deletePhotoBlobs(ids);
          set({
            albums: (get().albums ?? []).filter((a) => a.id !== id),
            photos: photos.filter((p) => p.albumId !== id),
          });
          return;
        }
        set({
          albums: (get().albums ?? []).filter((a) => a.id !== id),
          photos: photos.map((p) => (p.albumId === id ? { ...p, albumId: undefined } : p)),
        });
      },
      addPlan: (draft) => {
        const id = uid("pl");
        const now = new Date().toISOString();
        const plan: TreatmentPlan = { ...draft, id, createdAt: now, updatedAt: now };
        set({ plans: [plan, ...get().plans] });
        return id;
      },
      updatePlan: (id, patch) => {
        set({
          plans: get().plans.map((p) =>
            p.id === id ? { ...p, ...patch, updatedAt: new Date().toISOString() } : p,
          ),
        });
      },
      deletePlan: (id) => {
        set({ plans: get().plans.filter((p) => p.id !== id) });
      },
      addDiscount: (draft) => {
        const id = uid("d");
        set({ discounts: [...get().discounts, { ...draft, id }] });
        return id;
      },
      updateDiscount: (id, patch) => {
        set({
          discounts: get().discounts.map((d) => (d.id === id ? { ...d, ...patch } : d)),
        });
      },
      deleteDiscount: (id) => {
        set({
          discounts: get().discounts.filter((d) => d.id !== id),
          patients: get().patients.map((p) =>
            p.discountTypeId === id ? { ...p, discountTypeId: "" } : p,
          ),
        });
      },
      addContact: (patientId, kind, text, status) => {
        const entry: ContactLog = {
          id: uid("c"),
          patientId,
          at: new Date().toISOString(),
          kind,
          status,
          text,
        };
        const patients = status
          ? get().patients.map((p) => (p.id === patientId ? { ...p, recallStatus: status } : p))
          : get().patients;
        set({ contacts: [entry, ...get().contacts], patients });
      },
      setRecallStatus: (patientId, status, note) => {
        get().addContact(patientId, "status", note || "", status);
      },
      addDoctor: (draft) => {
        const id = uid("doc");
        set({ doctors: [...get().doctors, normalizeDoctor({ ...draft, id })] });
        return id;
      },
      updateDoctor: (id, patch) => {
        set({
          doctors: get().doctors.map((d) => (d.id === id ? normalizeDoctor({ ...d, ...patch }) : d)),
        });
      },
      deleteDoctor: (id) => {
        const rest = get().doctors.filter((d) => d.id !== id);
        if (rest.length === 0) return;
        set({ doctors: rest });
      },
      addDiaryTemplate: (draft) => {
        const id = uid("tpl");
        set({ diaryTemplates: [...get().diaryTemplates, { ...draft, id }] });
        return id;
      },
      updateDiaryTemplate: (id, patch) => {
        set({
          diaryTemplates: get().diaryTemplates.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        });
      },
      deleteDiaryTemplate: (id) => {
        set({ diaryTemplates: get().diaryTemplates.filter((t) => t.id !== id) });
      },
      addDiaryExtra: (bucket, label) => {
        const name = label.trim();
        if (!name) return;
        const extras: DiaryExtras = {
          ...emptyDiaryExtras(),
          ...get().settings.diaryExtras,
        };
        if (extras[bucket].includes(name)) return;
        extras[bucket] = [...extras[bucket], name];
        set({ settings: { ...get().settings, diaryExtras: extras } });
      },
      removeDiaryExtra: (bucket, label) => {
        const extras: DiaryExtras = {
          ...emptyDiaryExtras(),
          ...get().settings.diaryExtras,
        };
        extras[bucket] = extras[bucket].filter((x) => x !== label);
        set({ settings: { ...get().settings, diaryExtras: extras } });
      },
      addTag: (name) => {
        const id = uid("tag");
        set({ tags: [...get().tags, { id, name: name.trim(), color: "muted" }] });
        return id;
      },
      updateTag: (id, patch) => {
        set({ tags: get().tags.map((t) => (t.id === id ? { ...t, ...patch } : t)) });
      },
      deleteTag: (id) => {
        set({
          tags: get().tags.filter((t) => t.id !== id),
          patients: get().patients.map((p) => ({ ...p, tagIds: (p.tagIds ?? []).filter((x) => x !== id) })),
        });
      },
      addDiagnosis: (draft) => {
        const id = uid("dx");
        const row: DiagnosisDef = {
          ...draft,
          id,
          template: draft.template?.trim() || "",
        };
        if (!row.template) row.template = defaultDiagnosisTemplate(row);
        set({ diagnoses: [...get().diagnoses, row] });
        return id;
      },
      updateDiagnosis: (id, patch) => {
        set({ diagnoses: get().diagnoses.map((d) => (d.id === id ? { ...d, ...patch } : d)) });
      },
      deleteDiagnosis: (id) => {
        set({ diagnoses: get().diagnoses.filter((d) => d.id !== id) });
      },
      addMessageTemplate: (draft) => {
        const id = uid("mt");
        set({ messageTemplates: [...get().messageTemplates, { ...draft, id }] });
        return id;
      },
      updateMessageTemplate: (id, patch) => {
        set({
          messageTemplates: get().messageTemplates.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        });
      },
      deleteMessageTemplate: (id) => {
        if (get().messageTemplates.length <= 1) return;
        set({ messageTemplates: get().messageTemplates.filter((t) => t.id !== id) });
      },
      updateNotifyRule: (id, patch) => {
        set({
          notifyRules: get().notifyRules.map((r) => (r.id === id ? { ...r, ...patch } : r)),
        });
      },
      addCustomSocial: (name) => {
        const n = name.trim();
        if (!n || get().customSocials.includes(n)) return;
        set({ customSocials: [...get().customSocials, n] });
      },
      addCustomMedical: (name) => {
        const n = name.trim();
        if (!n) return;
        const id = uid("med");
        set({ customMedical: [...get().customMedical, { id, name: n }] });
      },
      addBudgetOp: (draft) => {
        const amount = Math.round(Number(draft.amount) || 0);
        if (amount <= 0) return "";
        const id = uid("bop");
        const row: BudgetOp = {
          ...draft,
          id,
          amount,
          title: (draft.title || "").trim() || (draft.kind === "income" ? "Поступление" : "Расход"),
          note: draft.note || "",
          createdAt: new Date().toISOString(),
        };
        set({ budgetOps: [row, ...get().budgetOps] });
        return id;
      },
      updateBudgetOp: (id, patch) => {
        if (id.startsWith("visit:")) return false;
        const prev = get().budgetOps.find((o) => o.id === id);
        if (!prev) return false;
        const amount = patch.amount != null ? Math.round(Number(patch.amount) || 0) : prev.amount;
        if (amount <= 0) return false;
        set({
          budgetOps: get().budgetOps.map((o) =>
            o.id === id
              ? {
                  ...o,
                  ...patch,
                  amount,
                  title: (patch.title ?? o.title).trim() || o.title,
                  updatedAt: new Date().toISOString(),
                }
              : o,
          ),
        });
        return true;
      },
      deleteBudgetOp: (id) => {
        if (id.startsWith("visit:")) return false;
        if (!get().budgetOps.some((o) => o.id === id)) return false;
        set({ budgetOps: get().budgetOps.filter((o) => o.id !== id) });
        return true;
      },
      addBudgetCategory: (kind, name) => {
        const n = name.trim();
        if (!n) return "";
        const id = uid(kind === "income" ? "inc" : "exp");
        const sort = (get().budgetCategories.filter((c) => c.kind === kind).at(-1)?.sort ?? -1) + 1;
        set({ budgetCategories: [...get().budgetCategories, { id, kind, name: n, sort }] });
        return id;
      },
      updateBudgetCategory: (id, patch) => {
        set({
          budgetCategories: get().budgetCategories.map((c) =>
            c.id === id ? { ...c, ...patch, name: patch.name?.trim() || c.name } : c,
          ),
        });
      },
      deleteBudgetCategory: (id, moveTo) => {
        const cat = get().budgetCategories.find((c) => c.id === id);
        if (!cat || cat.locked) return false;
        const used =
          get().budgetOps.some((o) => o.categoryId === id) ||
          get().budgetRecurring.some((r) => r.categoryId === id) ||
          get().budgetPlans.some((p) => p.items.some((it) => it.categoryId === id));
        if (used && !moveTo) {
          set({
            budgetCategories: get().budgetCategories.map((c) => (c.id === id ? { ...c, archived: true } : c)),
          });
          return true;
        }
        if (used && moveTo) {
          set({
            budgetOps: get().budgetOps.map((o) => (o.categoryId === id ? { ...o, categoryId: moveTo } : o)),
            budgetRecurring: get().budgetRecurring.map((r) => (r.categoryId === id ? { ...r, categoryId: moveTo } : r)),
            budgetPlans: get().budgetPlans.map((p) => ({
              ...p,
              items: p.items.map((it) => (it.categoryId === id ? { ...it, categoryId: moveTo } : it)),
            })),
            budgetCategories: get().budgetCategories.filter((c) => c.id !== id),
          });
          return true;
        }
        set({ budgetCategories: get().budgetCategories.filter((c) => c.id !== id) });
        return true;
      },
      addBudgetVendor: (draft) => {
        const id = uid("ven");
        set({ budgetVendors: [...get().budgetVendors, { ...draft, id, name: draft.name.trim() || "Поставщик" }] });
        return id;
      },
      updateBudgetVendor: (id, patch) => {
        set({
          budgetVendors: get().budgetVendors.map((v) =>
            v.id === id ? { ...v, ...patch, name: (patch.name ?? v.name).trim() || v.name } : v,
          ),
        });
      },
      deleteBudgetVendor: (id) => {
        set({
          budgetVendors: get().budgetVendors.filter((v) => v.id !== id),
          budgetOps: get().budgetOps.map((o) => (o.vendorId === id ? { ...o, vendorId: "" } : o)),
          budgetRecurring: get().budgetRecurring.map((r) => (r.vendorId === id ? { ...r, vendorId: undefined } : r)),
        });
      },
      addBudgetRecurring: (draft) => {
        const id = uid("br");
        set({
          budgetRecurring: [
            ...get().budgetRecurring,
            { ...draft, id, title: draft.title.trim() || "Регулярный расход", amount: Math.round(Number(draft.amount) || 0) },
          ],
        });
        return id;
      },
      updateBudgetRecurring: (id, patch) => {
        set({
          budgetRecurring: get().budgetRecurring.map((r) =>
            r.id === id
              ? {
                  ...r,
                  ...patch,
                  title: (patch.title ?? r.title).trim() || r.title,
                  amount: patch.amount != null ? Math.round(Number(patch.amount) || 0) : r.amount,
                }
              : r,
          ),
        });
      },
      deleteBudgetRecurring: (id) => {
        set({ budgetRecurring: get().budgetRecurring.filter((r) => r.id !== id) });
      },
      postDueRecurring: (today, by) => {
        let posted = 0;
        const ops = [...get().budgetOps];
        const rec = get().budgetRecurring.map((r) => ({ ...r }));
        for (const r of rec) {
          if (!r.active || r.amount <= 0) continue;
          let guard = 0;
          while (r.nextDate && r.nextDate <= today && guard < 36) {
            guard += 1;
            const exists = ops.some((o) => o.recurringId === r.id && o.date === r.nextDate);
            if (!exists) {
              ops.unshift({
                id: uid("bop"),
                kind: "expense",
                amount: Math.round(r.amount),
                date: r.nextDate,
                categoryId: r.categoryId,
                method: r.method,
                title: r.title,
                note: "Регулярный расход",
                vendorId: r.vendorId,
                recurringId: r.id,
                createdAt: new Date().toISOString(),
                createdBy: by,
              });
              posted += 1;
            }
            r.lastPosted = r.nextDate;
            r.nextDate = nextAfter(r.nextDate, r.cadence);
          }
        }
        if (posted || rec.some((r, i) => r.nextDate !== get().budgetRecurring[i]?.nextDate)) {
          set({ budgetOps: ops, budgetRecurring: rec });
        }
        return posted;
      },
      setBudgetPlan: (month, items) => {
        const rest = get().budgetPlans.filter((p) => p.month !== month);
        set({ budgetPlans: [...rest, { month, items: items.filter((it) => Math.round(it.amount) > 0) }] });
      },
      addStockGroup: (name) => {
        const id = uid("stg");
        const sort = (get().stockGroups.at(-1)?.sort ?? -1) + 1;
        set({ stockGroups: [...get().stockGroups, { id, name: name.trim() || "Группа", sort }] });
        return id;
      },
      updateStockGroup: (id, patch) => {
        set({
          stockGroups: get().stockGroups.map((g) => (g.id === id ? { ...g, ...patch, name: patch.name?.trim() || g.name } : g)),
        });
      },
      deleteStockGroup: (id, moveTo, dropItems) => {
        const rest = get().stockGroups.filter((g) => g.id !== id);
        if (rest.length === 0) return;
        if (dropItems) {
          set({
            stockGroups: rest,
            stockItems: get().stockItems.filter((m) => m.groupId !== id),
          });
          return;
        }
        const fallback = moveTo && rest.some((g) => g.id === moveTo) ? moveTo : rest[0]!.id;
        set({
          stockGroups: rest,
          stockItems: get().stockItems.map((m) => (m.groupId === id ? { ...m, groupId: fallback } : m)),
        });
      },
      addStockItem: (draft) => {
        const id = uid("mat");
        set({
          stockItems: [
            ...get().stockItems,
            {
              ...draft,
              id,
              name: draft.name.trim() || "Материал",
              unit: draft.unit.trim() || "шт",
              qty: Math.max(0, Math.round(Number(draft.qty) || 0)),
              minQty: Math.max(0, Math.round(Number(draft.minQty) || 0)),
              note: draft.note ?? "",
              active: draft.active !== false,
            },
          ],
        });
        return id;
      },
      updateStockItem: (id, patch) => {
        set({
          stockItems: get().stockItems.map((m) => {
            if (m.id !== id) return m;
            const next = { ...m, ...patch };
            if (patch.name != null) next.name = patch.name.trim() || m.name;
            if (patch.unit != null) next.unit = patch.unit.trim() || m.unit;
            if (patch.qty != null) next.qty = Math.max(0, Math.round(Number(patch.qty) || 0));
            if (patch.minQty != null) next.minQty = Math.max(0, Math.round(Number(patch.minQty) || 0));
            return next;
          }),
        });
      },
      deleteStockItem: (id) => {
        set({ stockItems: get().stockItems.filter((m) => m.id !== id) });
      },
      updateOrtho: (patientId, patch) => {
        const prev = mergeOrtho(patientId, get().orthoCards?.[patientId]);
        const next = mergeOrtho(patientId, {
          ...prev,
          ...patch,
          patientId,
          updatedAt: new Date().toISOString(),
        });
        set({ orthoCards: { ...(get().orthoCards ?? {}), [patientId]: next } });
      },
      updateProstho: (patientId, patch) => {
        const prev = mergeProstho(patientId, get().prosthoCards?.[patientId]);
        const next = mergeProstho(patientId, {
          ...prev,
          ...patch,
          patientId,
          updatedAt: new Date().toISOString(),
        });
        set({ prosthoCards: { ...(get().prosthoCards ?? {}), [patientId]: next } });
      },
      importSnapshot: (data) => {
        set({
          patients: data.patients.map(normalizePatient),
          services: data.services,
          appointments: data.appointments,
          visits: data.visits,
          charts: data.charts,
          settings: { ...defaultSettings(), ...data.settings },
          photos: data.photos ?? [],
          albums: data.albums ?? [],
          plans: data.plans ?? [],
          discounts: data.discounts?.length ? data.discounts : seedDiscountTypes(),
          contacts: data.contacts ?? [],
          doctors: (data.doctors?.length ? data.doctors : seedDoctors()).map(normalizeDoctor),
          groups: data.groups?.length ? data.groups : seedServiceGroups(),
          diaryTemplates: enrichDiaryTemplates(data.diaryTemplates),
          tags: data.tags?.length ? data.tags : seedTags(),
          diagnoses: ensureDiagnosisTemplates(data.diagnoses),
          messageTemplates: data.messageTemplates?.length ? data.messageTemplates : seedMessageTemplates(),
          notifyRules: data.notifyRules?.length ? data.notifyRules : seedNotifyRules(),
          customSocials: data.customSocials ?? [],
          customMedical: data.customMedical ?? [],
          budgetOps: data.budgetOps ?? [],
          budgetCategories: data.budgetCategories?.length ? data.budgetCategories : seedBudgetCategories(),
          budgetVendors: data.budgetVendors ?? [],
          budgetRecurring: data.budgetRecurring ?? [],
          budgetPlans: data.budgetPlans ?? [],
          stockGroups: data.stockGroups?.length ? data.stockGroups : seedStockGroups(),
          stockItems: data.stockItems ?? [],
          orthoCards: Object.fromEntries(
            Object.entries(data.orthoCards ?? {}).map(([pid, card]) => [pid, mergeOrtho(pid, card)]),
          ),
          prosthoCards: Object.fromEntries(
            Object.entries(data.prosthoCards ?? {}).map(([pid, card]) => [pid, mergeProstho(pid, card)]),
          ),
        });
      },
      resetDemo: () => {
        const theme = get().settings.theme;
        const next = buildSeed();
        void clearAllPhotoBlobs();
        set({
          ...next,
          albums: [],
          tags: seedTags(),
          diagnoses: seedDiagnoses(),
          messageTemplates: seedMessageTemplates(),
          notifyRules: seedNotifyRules(),
          customSocials: [],
          customMedical: [],
          budgetOps: [],
          budgetCategories: seedBudgetCategories(),
          budgetVendors: [],
          budgetRecurring: [],
          budgetPlans: [],
          stockGroups: seedStockGroups(),
          stockItems: seedStockItems(),
          settings: { ...next.settings, theme: theme ?? "light" },
        });
      },
    }),
    {
      name: "denta-clinic-v1",
      version: 17,
      skipHydration: true,
      partialize: (s) => ({
        patients: s.patients,
        services: s.services,
        appointments: s.appointments,
        visits: s.visits,
        charts: s.charts,
        settings: s.settings,
        photos: s.photos,
        albums: s.albums ?? [],
        plans: s.plans,
        discounts: s.discounts,
        contacts: s.contacts,
        doctors: s.doctors,
        groups: s.groups,
        diaryTemplates: s.diaryTemplates,
        tags: s.tags,
        diagnoses: s.diagnoses,
        messageTemplates: s.messageTemplates,
        notifyRules: s.notifyRules,
        customSocials: s.customSocials,
        customMedical: s.customMedical,
        budgetOps: s.budgetOps ?? [],
        budgetCategories: s.budgetCategories ?? [],
        budgetVendors: s.budgetVendors ?? [],
        budgetRecurring: s.budgetRecurring ?? [],
        budgetPlans: s.budgetPlans ?? [],
        stockGroups: s.stockGroups ?? [],
        stockItems: s.stockItems ?? [],
        orthoCards: s.orthoCards ?? {},
        prosthoCards: s.prosthoCards ?? {},
      }),
      migrate: (persisted) => {
        try {
          const raw = (persisted ?? {}) as Partial<ClinicData>;
          const patients = (raw.patients ?? []).map((p) =>
            normalizePatient({
              ...p,
              cardNumber: p.cardNumber || "",
              referredById: p.referredById || "",
              discountTypeId: p.discountTypeId || "",
              recallStatus: p.recallStatus || "none",
            }),
          );
          if (!patients.some((p) => p.cardNumber)) {
            patients.forEach((p, i) => {
              if (!p.cardNumber) p.cardNumber = `МК-${1001 + i}`;
            });
          }
          if (!patients.some((p) => p.id === "p_smirnova")) {
            const child = seedPatients().find((p) => p.id === "p_smirnova");
            if (child) patients.push(child);
          }
          const charts = raw.charts
            ? Object.fromEntries(Object.entries(raw.charts).map(([pid, ch]) => [pid, normalizeChart(ch as Chart)]))
            : {};
          if (!charts.p_smirnova) {
            const seeded = seedCharts().p_smirnova;
            if (seeded) charts.p_smirnova = seeded;
          }
          return {
            ...raw,
            patients,
            photos: raw.photos ?? [],
            albums: raw.albums ?? [],
            charts,
            plans: (raw.plans ?? []).map((p) => ({
              ...p,
              doctorName: p.doctorName || "",
              doctorId: p.doctorId,
              items: (p.items ?? []).map((it) => ({ ...it, note: it.note ?? "" })),
            })),
            discounts: raw.discounts?.length ? raw.discounts : seedDiscountTypes(),
            contacts: raw.contacts ?? [],
            doctors: (raw.doctors?.length ? raw.doctors : seedDoctors()).map(normalizeDoctor),
            groups: raw.groups?.length ? raw.groups : seedServiceGroups(),
            diaryTemplates: enrichDiaryTemplates(raw.diaryTemplates),
            tags: raw.tags?.length ? raw.tags : seedTags(),
            diagnoses: ensureDiagnosisTemplates(raw.diagnoses),
            messageTemplates: raw.messageTemplates?.length ? raw.messageTemplates : seedMessageTemplates(),
            notifyRules: raw.notifyRules?.length ? raw.notifyRules : seedNotifyRules(),
            customSocials: raw.customSocials ?? [],
            customMedical: raw.customMedical ?? [],
            budgetOps: raw.budgetOps ?? [],
            budgetCategories: raw.budgetCategories?.length ? raw.budgetCategories : seedBudgetCategories(),
            budgetVendors: raw.budgetVendors ?? [],
            budgetRecurring: raw.budgetRecurring ?? [],
            budgetPlans: raw.budgetPlans ?? [],
            stockGroups: raw.stockGroups?.length ? raw.stockGroups : seedStockGroups(),
            stockItems: raw.stockItems ?? seedStockItems(),
            orthoCards: Object.fromEntries(
              Object.entries(raw.orthoCards ?? {}).map(([pid, card]) => [pid, mergeOrtho(pid, card)]),
            ),
            prosthoCards: Object.fromEntries(
              Object.entries(raw.prosthoCards ?? {}).map(([pid, card]) => [pid, mergeProstho(pid, card)]),
            ),
            visits: (raw.visits ?? []).map((v, _, all) => normalizeVisit(v, all)),
            appointments: (raw.appointments ?? []).map((a) => ({
              ...a,
              doctorId: a.doctorId || "doc_ivanov",
            })),
            settings: {
              ...defaultSettings(),
              ...raw.settings,
              diaryExtras: {
                ...emptyDiaryExtras(),
                ...raw.settings?.diaryExtras,
              },
              welcomeMode: raw.settings?.welcomeMode === "custom" ? "custom" : "auto",
              welcomeText: raw.settings?.welcomeText ?? "",
              welcomeDoctorId: raw.settings?.welcomeDoctorId ?? "",
              openingBalance: Math.round(Number(raw.settings?.openingBalance) || 0),
              openingDate: raw.settings?.openingDate || "",
              customPayMethods: raw.settings?.customPayMethods ?? [],
              toothStatuses: resolveToothStatuses(raw.settings?.toothStatuses),
              pdfLayout: normalizePdfLayout(raw.settings?.pdfLayout),
              clinicName: brandName(raw.settings?.clinicName),
              legalName: brandName(raw.settings?.legalName),
            },
          } as ClinicData;
        } catch {
          return buildSeed();
        }
      },
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<ClinicData>;
        return {
          ...current,
          ...p,
          patients: (p.patients ?? current.patients).map(normalizePatient),
          charts: Object.fromEntries(
            Object.entries(
              p.charts && Object.keys(p.charts).length ? p.charts : current.charts,
            ).map(([pid, ch]) => [pid, normalizeChart(ch as Chart)]),
          ),
          settings: {
            ...current.settings,
            ...p.settings,
            welcomeMode: p.settings?.welcomeMode === "custom" ? "custom" : current.settings.welcomeMode ?? "auto",
            welcomeText: p.settings?.welcomeText ?? current.settings.welcomeText ?? "",
            welcomeDoctorId: p.settings?.welcomeDoctorId ?? current.settings.welcomeDoctorId ?? "",
            openingBalance: Math.round(Number(p.settings?.openingBalance ?? current.settings.openingBalance) || 0),
            openingDate: p.settings?.openingDate ?? current.settings.openingDate ?? "",
            customPayMethods: p.settings?.customPayMethods ?? current.settings.customPayMethods ?? [],
            toothStatuses: resolveToothStatuses(p.settings?.toothStatuses ?? current.settings.toothStatuses),
            pdfLayout: normalizePdfLayout(p.settings?.pdfLayout ?? current.settings.pdfLayout),
            clinicName: brandName(p.settings?.clinicName ?? current.settings.clinicName),
            legalName: brandName(p.settings?.legalName ?? current.settings.legalName),
          },
          photos: p.photos ?? current.photos ?? [],
          albums: p.albums ?? current.albums ?? [],
          plans: p.plans ?? current.plans ?? [],
          discounts: p.discounts?.length ? p.discounts : current.discounts,
          contacts: p.contacts ?? current.contacts ?? [],
          doctors: (p.doctors?.length ? p.doctors : current.doctors).map(normalizeDoctor),
          groups: p.groups?.length ? p.groups : current.groups?.length ? current.groups : seedServiceGroups(),
          diaryTemplates: enrichDiaryTemplates(p.diaryTemplates?.length ? p.diaryTemplates : current.diaryTemplates),
          tags: p.tags?.length ? p.tags : current.tags?.length ? current.tags : seedTags(),
          diagnoses: ensureDiagnosisTemplates(p.diagnoses?.length ? p.diagnoses : current.diagnoses),
          messageTemplates: p.messageTemplates?.length ? p.messageTemplates : current.messageTemplates?.length ? current.messageTemplates : seedMessageTemplates(),
          notifyRules: p.notifyRules?.length ? p.notifyRules : current.notifyRules?.length ? current.notifyRules : seedNotifyRules(),
          customSocials: p.customSocials ?? current.customSocials ?? [],
          customMedical: p.customMedical ?? current.customMedical ?? [],
          budgetOps: p.budgetOps ?? current.budgetOps ?? [],
          budgetCategories: p.budgetCategories?.length ? p.budgetCategories : current.budgetCategories?.length ? current.budgetCategories : seedBudgetCategories(),
          budgetVendors: p.budgetVendors ?? current.budgetVendors ?? [],
          budgetRecurring: p.budgetRecurring ?? current.budgetRecurring ?? [],
          budgetPlans: p.budgetPlans ?? current.budgetPlans ?? [],
          stockGroups: p.stockGroups?.length ? p.stockGroups : current.stockGroups?.length ? current.stockGroups : seedStockGroups(),
          stockItems: p.stockItems ?? current.stockItems ?? seedStockItems(),
          orthoCards: Object.fromEntries(
            Object.entries(p.orthoCards ?? current.orthoCards ?? {}).map(([pid, card]) => [
              pid,
              mergeOrtho(pid, card),
            ]),
          ),
          prosthoCards: Object.fromEntries(
            Object.entries(p.prosthoCards ?? current.prosthoCards ?? {}).map(([pid, card]) => [
              pid,
              mergeProstho(pid, card),
            ]),
          ),
          visits: (p.visits ?? current.visits).map((v, _, all) => normalizeVisit(v, all)),
          appointments: (p.appointments ?? current.appointments).map((a) => ({
            ...a,
            doctorId: a.doctorId || current.doctors[0]?.id || "doc_ivanov",
          })),
        };
      },
    },
  ),
);

export { emptyChart };
