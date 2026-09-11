import type { ThemeMode } from "./theme";

export type { ThemeMode };

export type AppointmentStatus =
  | "scheduled"
  | "confirmed"
  | "in_chair"
  | "done"
  | "cancelled"
  | "no_show";

export type ToothStatus =
  | "healthy"
  | "caries"
  | "filling"
  | "pulpitis"
  | "periodontitis"
  | "crown"
  | "veneer"
  | "implant"
  | "root"
  | "missing"
  | "extracted"
  | "bridge";

/** M медиальная, O жевательная/режущая, D дистальная, B вестибулярная, L оральная */
export type ToothSurface = "M" | "O" | "D" | "B" | "L";

export type PaymentMethod = "cash" | "card" | "transfer";

export type VisitKind = "primary" | "repeat" | "control" | "emergency";

export interface VisitFinding {
  id: string;
  toothFdi?: number;
  diagnosisId: string;
  diagnosisText: string;
  treatments: string[];
  treatmentNote: string;
  examNote: string;
  examChips?: string[];
  materialIds?: string[];
}

export interface VisitDiary {
  complaints: string[];
  complaintsNote: string;
  anamnesis: string[];
  anamnesisNote: string;
  exam: string[];
  examNote: string;
  extra: string;
  findings: VisitFinding[];
  recommendations: string[];
  recommendationsNote: string;
  materialIds?: string[];
  nextKind: "none" | "repeat" | "control" | "continue" | "prosthetics" | "other";
  nextDate: string;
  nextTime: string;
  nextDurationMin: number;
  nextNote: string;
  text: string;
}

export interface DiaryTemplate {
  id: string;
  name: string;
  complaints: string[];
  complaintsNote?: string;
  anamnesis: string[];
  anamnesisNote?: string;
  exam: string[];
  examNote?: string;
  recommendations: string[];
  recommendationsNote?: string;
  /** Отдельно от лечения — диагноз шаблона. */
  diagnosisId?: string;
  diagnosisText?: string;
  treatments: string[];
  materialIds?: string[];
}

export interface DiaryExtras {
  complaints: string[];
  anamnesis: string[];
  exam: string[];
  treatments: string[];
  recommendations: string[];
}

export type ServiceCategory = string;

export interface ServiceGroup {
  id: string;
  name: string;
  sort: number;
}

export type PhotoCategory =
  | "before"
  | "during"
  | "after"
  | "xray"
  | "teeth"
  | "construction"
  | "ortho"
  | "prostho"
  | "other";

export type DiscountKind = "percent" | "fixed";

export type DiscountCategory =
  | "regular"
  | "referral"
  | "loyalty"
  | "individual"
  | "promo"
  | "family"
  | "birthday"
  | "repeat"
  | "special"
  | "other";

export type RecallStatus =
  | "none"
  | "contacted"
  | "interested"
  | "booked"
  | "refused"
  | "no_answer"
  | "call_later";

export type ContactKind = "call" | "message" | "note" | "status";

export type PatientSourceKind =
  | "none"
  | "patient"
  | "social"
  | "internet"
  | "nearby"
  | "search"
  | "ads"
  | "family"
  | "other";

export type MedicalFlag = "allergy" | "infection" | "coagulation" | "other" | string;

export interface Patient {
  id: string;
  cardNumber: string;
  lastName: string;
  firstName: string;
  middleName: string;
  birthDate: string;
  phone: string;
  email: string;
  address: string;
  allergies: string;
  chronic: string;
  notes: string;
  referredById: string;
  sourceKind?: PatientSourceKind;
  sourceSocial?: string;
  sourceNote?: string;
  tagIds?: string[];
  medicalFlags?: string[];
  medicalNote?: string;
  discountTypeId: string;
  recallStatus: RecallStatus;
  createdAt: string;
  updatedAt?: string;
}

export interface ToothState {
  status: ToothStatus;
  note: string;
  /** Поверхности, к которым относится status (или свой статус на клетке). Пусто = весь зуб. */
  surfaces?: Partial<Record<ToothSurface, ToothStatus>>;
}

export type Chart = Record<number, ToothState>;

export interface Service {
  id: string;
  category: ServiceCategory;
  name: string;
  price: number;
  durationMin: number;
  impliesStatus?: ToothStatus;
  active: boolean;
}

export interface Appointment {
  id: string;
  patientId: string;
  doctorId: string;
  date: string;
  start: string;
  durationMin: number;
  serviceId?: string;
  status: AppointmentStatus;
  notes: string;
  visitKind?: VisitKind;
  createdAt?: string;
  updatedAt?: string;
}

export interface VisitItem {
  id: string;
  serviceId: string;
  toothFdi?: number;
  price: number;
  qty: number;
}

export interface Visit {
  id: string;
  patientId: string;
  appointmentId?: string;
  date: string;
  items: VisitItem[];
  notes: string;
  discount: number;
  discountTypeId?: string;
  total: number;
  paid: number;
  paymentMethod?: PaymentMethod;
  doctorId?: string;
  kind?: VisitKind;
  diary?: VisitDiary;
  createdAt: string;
  updatedAt?: string;
  voidedAt?: string;
  voidReason?: string;
  voidedBy?: string;
}

export interface WorkDay {
  start: string;
  end: string;
  off: boolean;
}

export interface Settings {
  clinicName: string;
  doctorName: string;
  phone: string;
  address: string;
  legalName: string;
  inn: string;
  requisites: string;
  slotMinutes: number;
  workHours: Record<number, WorkDay>;
  theme: ThemeMode;
  recallDays: number;
  referralDiscountId: string;
  loyaltyDiscountId: string;
  requireLogin: boolean;
  remindersEnabled: boolean;
  reminderMinutes: number;
  diaryExtras?: DiaryExtras;
  /** auto — утро/день/вечер; custom — своя фраза с вкладки Сегодня */
  welcomeMode?: "auto" | "custom";
  welcomeText?: string;
  /** Врач, чьё ФИО подставляется в приветствие, если вход не требуется */
  welcomeDoctorId?: string;
  /** Остаток на дату начала учёта бюджета. Целые рубли. */
  openingBalance?: number;
  openingDate?: string;
  customPayMethods?: string[];
  /** Проценты занятости в дне / неделе / месяце / годе. По умолчанию включено. */
  scheduleShowOccupancy?: boolean;
  /** Цвета заполненности в месяце, годе и мини-месяце. */
  scheduleShowFillColors?: boolean;
  /** Иконка мини-месяца поверх сетки. */
  scheduleShowMiniMonth?: boolean;
  /** Время начала на карточке записи в дне. */
  scheduleShowDayTime?: boolean;
  /** Вид приёма (осмотр, лечение…) на карточке записи в дне. */
  scheduleShowVisitKind?: boolean;
}

export interface PhotoMeta {
  id: string;
  patientId: string;
  createdAt: string;
  date: string;
  category: PhotoCategory;
  description: string;
  visitId?: string;
  toothFdi?: number;
  albumId?: string;
  /** Специальность: ортодонтия / ортопедия. Пусто — общий архив. */
  specialty?: "ortho" | "prostho";
  shot?: string;
  stage?: "before" | "during" | "after";
}

export interface PhotoAlbum {
  id: string;
  patientId: string;
  title: string;
  date: string;
  visitId?: string;
  toothFdi?: number;
  description: string;
  createdAt: string;
}

export interface DiscountType {
  id: string;
  name: string;
  category: DiscountCategory;
  kind: DiscountKind;
  value: number;
  active: boolean;
}

export interface PlanItem {
  id: string;
  toothFdi?: number;
  diagnosis: string;
  diagnosisId?: string;
  serviceId?: string;
  serviceName: string;
  qty: number;
  price: number;
  discount: number;
  note?: string;
}

export interface TreatmentPlan {
  id: string;
  patientId: string;
  title: string;
  date: string;
  doctorName: string;
  doctorId?: string;
  items: PlanItem[];
  discountTypeId: string;
  discount: number;
  notes: string;
  recommendations: string;
  createdAt: string;
  updatedAt: string;
}

export interface ContactLog {
  id: string;
  patientId: string;
  at: string;
  kind: ContactKind;
  status?: RecallStatus;
  text: string;
}

export type DoctorRole = "admin" | "doctor";

export interface Doctor {
  id: string;
  lastName: string;
  firstName: string;
  middleName: string;
  specialty: string;
  color: string;
  login: string;
  passwordHash: string;
  passwordSalt: string;
  role: DoctorRole;
  active: boolean;
  sharePercent: number;
}

export interface PatientTag {
  id: string;
  name: string;
  color: string;
}

export interface DiagnosisDef {
  id: string;
  name: string;
  displayName: string;
  code: string;
  description: string;
  category: string;
  template: string;
}

export interface MessageTemplate {
  id: string;
  name: string;
  kind: "reminder" | "recall" | "control" | "unfinished" | "plan" | "birthday" | "custom";
  body: string;
}

export interface NotifyRule {
  id: string;
  kind: MessageTemplate["kind"];
  enabled: boolean;
  channel: "system" | "sms" | "whatsapp" | "email";
  templateId: string;
  minutesBefore: number;
}

export type BudgetKind = "income" | "expense";
export type BudgetCadence = "day" | "week" | "month" | "year";

export interface BudgetCategory {
  id: string;
  kind: BudgetKind;
  name: string;
  archived?: boolean;
  sort: number;
  locked?: boolean;
}

export interface BudgetVendor {
  id: string;
  name: string;
  phone: string;
  note: string;
}

export interface BudgetOp {
  id: string;
  kind: BudgetKind;
  amount: number;
  date: string;
  categoryId: string;
  method: string;
  title: string;
  note: string;
  patientId?: string;
  vendorId?: string;
  recurringId?: string;
  createdAt: string;
  updatedAt?: string;
  createdBy?: string;
}

export interface BudgetRecurring {
  id: string;
  title: string;
  amount: number;
  categoryId: string;
  method: string;
  cadence: BudgetCadence;
  nextDate: string;
  notifyDays: number;
  vendorId?: string;
  active: boolean;
  lastPosted?: string;
}

export interface BudgetPlan {
  month: string;
  items: { categoryId: string; amount: number }[];
}

export interface StockGroup {
  id: string;
  name: string;
  sort: number;
}

export interface StockItem {
  id: string;
  groupId: string;
  name: string;
  unit: string;
  qty: number;
  minQty: number;
  note: string;
  active: boolean;
}

export type PhotoStage = "before" | "during" | "after";

export interface SpecMeasure {
  id: string;
  name: string;
  value: string;
  unit: string;
}

export interface SpecStudy {
  id: string;
  date: string;
  kind: string;
  photoId?: string;
  notes: string;
  conclusion: string;
}

export interface SpecVisit {
  id: string;
  date: string;
  time: string;
  doctorId: string;
  complaints: string;
  actions: string;
  status: string;
  nextDate: string;
  notes: string;
  recommendations: string;
}

export interface OrthoCard {
  patientId: string;
  complaints: string[];
  complaintsNote: string;
  anamnesis: string[];
  anamnesisNote: string;
  face: {
    symmetry: string;
    profile: string;
    faceType: string;
    proportions: string;
    lips: string;
    chin: string;
  };
  oral: {
    mucosa: string;
    hygiene: string;
    teeth: string;
    periodontium: string;
  };
  teethMarks: Record<string, string[]>;
  dentition: string;
  biteSagittal: string;
  biteVertical: string;
  biteTransverse: string;
  arches: {
    form: string;
    width: string;
    length: string;
    crowding: string;
    trema: string;
    diastema: string;
    symmetry: string;
  };
  measurements: SpecMeasure[];
  studies: SpecStudy[];
  diagnosisId: string;
  diagnosisText: string;
  plan: {
    goal: string;
    method: string;
    appliance: string;
    stages: string;
    duration: string;
    notes: string;
    linkedPlanId?: string;
  };
  appliance: {
    type: string;
    bracketType: string;
    system: string;
    material: string;
    installedOn: string;
    alignerBrand: string;
    alignerTotal: string;
    alignerCurrent: string;
    notes: string;
  };
  visits: SpecVisit[];
  retention: {
    activeEnd: string;
    retainerType: string;
    installedOn: string;
    notes: string;
    recallPlan: string;
  };
  epicrisis: string;
  updatedAt: string;
}

export interface ProsthoLab {
  name: string;
  technician: string;
  sentOn: string;
  receivedOn: string;
  cost: number;
  notes: string;
}

export interface ProsthoStage {
  id: string;
  name: string;
  date: string;
  done: boolean;
}

export interface ProsthoConstruction {
  id: string;
  teeth: number[];
  kind: string;
  material: string;
  color: string;
  colorOther: string;
  price: number;
  status: string;
  stages: ProsthoStage[];
  lab: ProsthoLab;
  notes: string;
}

export interface ProsthoCard {
  patientId: string;
  complaints: string[];
  complaintsNote: string;
  anamnesis: string;
  exam: string;
  teethMarks: Record<string, string[]>;
  occlusion: string;
  tmj: string;
  studies: SpecStudy[];
  diagnosisId: string;
  diagnosisText: string;
  planNotes: string;
  linkedPlanId?: string;
  constructions: ProsthoConstruction[];
  visits: SpecVisit[];
  result: string;
  customMaterials: string[];
  updatedAt: string;
}

