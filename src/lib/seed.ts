import { addDays, format, subDays } from "date-fns";
import { seedBudgetCategories } from "./budget";
import { seedStockGroups, seedStockItems } from "./stock";
import { DEFAULT_DIARY_TEMPLATES, emptyDiary, emptyFinding } from "./diary";
import { ALL_CHART_FDI, defaultToothStatuses } from "./teeth";
import type {
  Appointment,
  Chart,
  ContactLog,
  DiaryTemplate,
  DiscountType,
  Doctor,
  Patient,
  Service,
  ServiceGroup,
  Settings,
  ToothState,
  TreatmentPlan,
  Visit,
} from "./types";

function emptyChart(): Chart {
  const chart: Chart = {};
  for (const fdi of ALL_CHART_FDI) {
    chart[fdi] = { status: "healthy", note: "" };
  }
  return chart;
}

function withTeeth(entries: Array<[number, ToothState]>): Chart {
  const chart = emptyChart();
  for (const [fdi, state] of entries) chart[fdi] = state;
  return chart;
}

export function defaultSettings(): Settings {
  return {
    clinicName: "ClinicOS",
    doctorName: "Иванов А. С.",
    phone: "+7 (495) 120-40-18",
    address: "Москва, один кабинет",
    legalName: "ClinicOS",
    inn: "",
    requisites: "",
    slotMinutes: 30,
    theme: "light",
    recallDays: 180,
    referralDiscountId: "d_referral",
    loyaltyDiscountId: "d_loyalty",
    requireLogin: false,
    remindersEnabled: true,
    reminderMinutes: 60,
    diaryExtras: { complaints: [], anamnesis: [], exam: [], treatments: [], recommendations: [] },
    welcomeMode: "auto",
    welcomeText: "",
    welcomeDoctorId: "",
    openingBalance: 0,
    openingDate: "",
    customPayMethods: [],
    scheduleShowOccupancy: true,
    scheduleShowFillColors: true,
    scheduleShowMiniMonth: true,
    scheduleShowDayTime: true,
    scheduleShowVisitKind: true,
    toothStatuses: defaultToothStatuses(),
    workHours: {
      0: { start: "10:00", end: "14:00", off: true },
      1: { start: "09:00", end: "18:00", off: false },
      2: { start: "09:00", end: "18:00", off: false },
      3: { start: "09:00", end: "18:00", off: false },
      4: { start: "09:00", end: "18:00", off: false },
      5: { start: "09:00", end: "18:00", off: false },
      6: { start: "10:00", end: "14:00", off: false },
    },
  };
}

export function seedServices(): Service[] {
  return [
    { id: "s_consult", category: "diagnostics", name: "Консультация", price: 1500, durationMin: 20, active: true },
    { id: "s_exam", category: "diagnostics", name: "Осмотр", price: 800, durationMin: 15, active: true },
    { id: "s_plan", category: "diagnostics", name: "План лечения", price: 1000, durationMin: 20, active: true },
    { id: "s_xray", category: "xray", name: "Прицельный снимок", price: 800, durationMin: 10, active: true },
    { id: "s_opg", category: "xray", name: "Ортопантомограмма", price: 1800, durationMin: 15, active: true },
    { id: "s_anest_a", category: "anesthesia", name: "Аппликационная анестезия", price: 400, durationMin: 5, active: true },
    { id: "s_anest_i", category: "anesthesia", name: "Инфильтрационная анестезия", price: 700, durationMin: 10, active: true },
    { id: "s_anest_p", category: "anesthesia", name: "Проводниковая анестезия", price: 900, durationMin: 10, active: true },
    { id: "s_caries1", category: "therapy", name: "Лечение кариеса, 1 поверхность", price: 4500, durationMin: 40, impliesStatus: "filling", active: true },
    { id: "s_caries2", category: "therapy", name: "Лечение кариеса, 2 поверхности", price: 6200, durationMin: 50, impliesStatus: "filling", active: true },
    { id: "s_caries3", category: "therapy", name: "Лечение кариеса, 3 поверхности", price: 7800, durationMin: 60, impliesStatus: "filling", active: true },
    { id: "s_fill", category: "therapy", name: "Световая пломба", price: 5500, durationMin: 40, impliesStatus: "filling", active: true },
    { id: "s_pulp1", category: "therapy", name: "Лечение пульпита, 1 канал", price: 8500, durationMin: 60, impliesStatus: "filling", active: true },
    { id: "s_pulp2", category: "therapy", name: "Лечение пульпита, 2 канала", price: 12000, durationMin: 80, impliesStatus: "filling", active: true },
    { id: "s_temp", category: "therapy", name: "Временная пломба", price: 1500, durationMin: 20, active: true },
    { id: "s_hygiene", category: "hygiene", name: "Профгигиена", price: 4500, durationMin: 45, active: true },
    { id: "s_airflow", category: "hygiene", name: "Air Flow", price: 3500, durationMin: 30, active: true },
    { id: "s_hygiene_full", category: "hygiene", name: "Комплексная гигиена", price: 6500, durationMin: 60, active: true },
    { id: "s_fluor", category: "hygiene", name: "Фторирование", price: 1500, durationMin: 15, active: true },
    { id: "s_extract", category: "surgery", name: "Удаление зуба простое", price: 3500, durationMin: 30, impliesStatus: "extracted", active: true },
    { id: "s_extract_c", category: "surgery", name: "Удаление зуба сложное", price: 7000, durationMin: 50, impliesStatus: "extracted", active: true },
    { id: "s_wisdom", category: "surgery", name: "Удаление зуба мудрости", price: 9500, durationMin: 60, impliesStatus: "extracted", active: true },
    { id: "s_suture", category: "surgery", name: "Наложение швов", price: 1200, durationMin: 15, active: true },
    { id: "s_crown_mc", category: "prosthetics", name: "Коронка металлокерамическая", price: 18000, durationMin: 40, impliesStatus: "crown", active: true },
    { id: "s_crown_zr", category: "prosthetics", name: "Коронка циркониевая", price: 28000, durationMin: 40, impliesStatus: "crown", active: true },
    { id: "s_veneer", category: "prosthetics", name: "Винир", price: 25000, durationMin: 40, impliesStatus: "veneer", active: true },
    { id: "s_impression", category: "prosthetics", name: "Снятие слепка", price: 1500, durationMin: 20, active: true },
    { id: "s_temp_crown", category: "prosthetics", name: "Временная коронка", price: 3500, durationMin: 30, impliesStatus: "crown", active: true },
  ];
}

export function seedPatients(): Patient[] {
  const now = new Date().toISOString();
  return [
    {
      id: "p_ivanova",
      lastName: "Иванова",
      firstName: "Мария",
      middleName: "Сергеевна",
      birthDate: "1988-03-14",
      phone: "+7 (916) 234-11-02",
      email: "m.ivanova@example.com",
      address: "Москва, ул. Арбат, 12",
      allergies: "Лидокаин",
      chronic: "",
      notes: "Предпочитает утренние часы.",
      createdAt: now,
      cardNumber: "МК-1001",
      referredById: "",
      discountTypeId: "d_loyalty",
      recallStatus: "none",
    },
    {
      id: "p_petrov",
      lastName: "Петров",
      firstName: "Алексей",
      middleName: "Игоревич",
      birthDate: "1975-11-02",
      phone: "+7 (903) 445-90-18",
      email: "",
      address: "Москва, Ленинский пр-т, 45",
      allergies: "",
      chronic: "Гипертония",
      notes: "Измерять давление перед анестезией.",
      createdAt: now,
      cardNumber: "МК-1002",
      referredById: "",
      discountTypeId: "",
      recallStatus: "none",
    },
    {
      id: "p_sokolova",
      lastName: "Соколова",
      firstName: "Елена",
      middleName: "Дмитриевна",
      birthDate: "1994-07-22",
      phone: "+7 (926) 112-77-40",
      email: "e.sokolova@example.com",
      address: "",
      allergies: "",
      chronic: "",
      notes: "",
      createdAt: now,
      cardNumber: "МК-1003",
      referredById: "p_ivanova",
      discountTypeId: "d_referral",
      recallStatus: "call_later",
    },
    {
      id: "p_kuznetsov",
      lastName: "Кузнецов",
      firstName: "Дмитрий",
      middleName: "Павлович",
      birthDate: "1968-01-09",
      phone: "+7 (495) 320-14-55",
      email: "",
      address: "Москва, ул. Тверская, 7",
      allergies: "Пенициллин",
      chronic: "Сахарный диабет 2 типа",
      notes: "Контроль глюкозы, не назначать пенициллины.",
      createdAt: now,
      cardNumber: "МК-1004",
      referredById: "",
      discountTypeId: "",
      recallStatus: "none",
    },
    {
      id: "p_volkova",
      lastName: "Волкова",
      firstName: "Анна",
      middleName: "Олеговна",
      birthDate: "2001-05-30",
      phone: "+7 (999) 201-88-13",
      email: "",
      address: "",
      allergies: "",
      chronic: "",
      notes: "Первичный пациент.",
      createdAt: now,
      cardNumber: "МК-1005",
      referredById: "p_petrov",
      discountTypeId: "d_referral",
      recallStatus: "none",
    },
    {
      id: "p_morozov",
      lastName: "Морозов",
      firstName: "Игорь",
      middleName: "Николаевич",
      birthDate: "1982-09-17",
      phone: "+7 (910) 776-03-21",
      email: "",
      address: "",
      allergies: "",
      chronic: "",
      notes: "",
      createdAt: now,
      cardNumber: "МК-1006",
      referredById: "",
      discountTypeId: "d_loyalty",
      recallStatus: "none",
    },
    {
      id: "p_smirnova",
      lastName: "Смирнова",
      firstName: "Алиса",
      middleName: "Сергеевна",
      birthDate: "2019-04-11",
      phone: "+7 (916) 555-20-11",
      email: "",
      address: "",
      allergies: "",
      chronic: "",
      notes: "Сменный прикус. Кариес молочных моляров.",
      createdAt: now,
      cardNumber: "МК-1007",
      referredById: "p_ivanova",
      discountTypeId: "d_referral",
      recallStatus: "none",
    },
  ];
}

export function seedCharts(): Record<string, Chart> {
  return {
    p_ivanova: withTeeth([
      [16, { status: "caries", note: "Дистальная поверхность", surfaces: { D: "caries" } }],
      [26, { status: "filling", note: "2024" }],
      [36, { status: "crown", note: "Металлокерамика" }],
      [46, { status: "filling", note: "" }],
    ]),
    p_petrov: withTeeth([
      [18, { status: "extracted", note: "2021" }],
      [28, { status: "missing", note: "" }],
      [46, { status: "caries", note: "Под десной" }],
      [47, { status: "filling", note: "" }],
      [36, { status: "pulpitis", note: "Жалобы на ночную боль" }],
    ]),
    p_sokolova: withTeeth([
      [11, { status: "veneer", note: "" }],
      [21, { status: "veneer", note: "" }],
      [37, { status: "filling", note: "" }],
    ]),
    p_kuznetsov: withTeeth([
      [18, { status: "extracted", note: "" }],
      [28, { status: "extracted", note: "" }],
      [38, { status: "caries", note: "Ретинирован частично" }],
      [48, { status: "extracted", note: "" }],
      [16, { status: "crown", note: "" }],
      [26, { status: "crown", note: "" }],
      [14, { status: "filling", note: "" }],
    ]),
    p_volkova: emptyChart(),
    p_morozov: withTeeth([
      [26, { status: "caries", note: "" }],
      [27, { status: "caries", note: "" }],
      [46, { status: "implant", note: "Osstem, 2023" }],
    ]),
    p_smirnova: withTeeth([
      [54, { status: "caries", note: "Жевательная", surfaces: { O: "caries" } }],
      [64, { status: "filling", note: "2025" }],
      [75, { status: "caries", note: "" }],
      [85, { status: "pulpitis", note: "Ночная боль" }],
      [16, { status: "healthy", note: "Прорезается" }],
      [26, { status: "healthy", note: "" }],
      [36, { status: "healthy", note: "" }],
      [46, { status: "healthy", note: "" }],
    ]),
  };
}

export function seedAppointments(): Appointment[] {
  const today = format(new Date(), "yyyy-MM-dd");
  const tomorrow = format(addDays(new Date(), 1), "yyyy-MM-dd");
  const yesterday = format(subDays(new Date(), 1), "yyyy-MM-dd");
  return [
    { id: "a_today_1", patientId: "p_ivanova", doctorId: "doc_ivanov", date: today, start: "09:00", durationMin: 30, serviceId: "s_consult", status: "confirmed", notes: "" },
    { id: "a_today_2", patientId: "p_petrov", doctorId: "doc_ivanov", date: today, start: "10:00", durationMin: 60, serviceId: "s_caries2", status: "scheduled", notes: "Зуб 46" },
    { id: "a_today_3", patientId: "p_sokolova", doctorId: "doc_ivanov", date: today, start: "11:30", durationMin: 60, serviceId: "s_hygiene_full", status: "scheduled", notes: "" },
    { id: "a_today_4", patientId: "p_kuznetsov", doctorId: "doc_ivanov", date: today, start: "14:00", durationMin: 60, serviceId: "s_wisdom", status: "confirmed", notes: "38, аллергия на пенициллин" },
    { id: "a_today_5", patientId: "p_volkova", doctorId: "doc_ivanov", date: today, start: "16:00", durationMin: 30, serviceId: "s_exam", status: "scheduled", notes: "Первичный" },
    { id: "a_tom_1", patientId: "p_morozov", doctorId: "doc_ivanov", date: tomorrow, start: "10:00", durationMin: 50, serviceId: "s_caries2", status: "scheduled", notes: "26, 27" },
    { id: "a_tom_2", patientId: "p_ivanova", doctorId: "doc_ivanov", date: tomorrow, start: "12:00", durationMin: 40, serviceId: "s_fill", status: "scheduled", notes: "16" },
    { id: "a_yes_1", patientId: "p_morozov", doctorId: "doc_ivanov", date: yesterday, start: "11:00", durationMin: 45, serviceId: "s_hygiene", status: "done", notes: "" },
  ];
}

export function seedVisits(): Visit[] {
  const yesterday = format(subDays(new Date(), 1), "yyyy-MM-dd");
  const weekAgo = format(subDays(new Date(), 8), "yyyy-MM-dd");
  const twoWeeks = format(subDays(new Date(), 16), "yyyy-MM-dd");
  return [
    {
      id: "v_1",
      patientId: "p_morozov",
      appointmentId: "a_yes_1",
      date: yesterday,
      items: [
        { id: "vi_1", serviceId: "s_hygiene", price: 4500, qty: 1 },
        { id: "vi_2", serviceId: "s_fluor", price: 1500, qty: 1 },
      ],
      notes: "Рекомендована домашняя ирригация.",
      discount: 0,
      total: 6000,
      paid: 6000,
      paymentMethod: "card",
      doctorId: "doc_ivanov",
      kind: "repeat",
      diary: {
        ...emptyDiary(),
        complaints: ["none"],
        exam: ["hygiene_ok"],
        findings: [
          {
            ...emptyFinding(),
            id: "vf_v1_h",
            diagnosisId: "other",
            diagnosisText: "Профессиональная гигиена",
            treatments: ["hygiene"],
          },
        ],
        recommendations: ["hygiene", "products"],
        text: "Повторный приём. Проведена профессиональная гигиена. Рекомендована домашняя ирригация.",
      },
      createdAt: new Date().toISOString(),
    },
    {
      id: "v_2",
      patientId: "p_ivanova",
      date: weekAgo,
      items: [
        { id: "vi_3", serviceId: "s_consult", price: 1500, qty: 1 },
        { id: "vi_4", serviceId: "s_xray", price: 800, qty: 1, toothFdi: 16 },
      ],
      notes: "Кариес 16, записана на лечение.",
      discount: 0,
      total: 2300,
      paid: 2300,
      paymentMethod: "cash",
      doctorId: "doc_ivanov",
      kind: "primary",
      diary: {
        ...emptyDiary(),
        complaints: ["cold", "sweet"],
        anamnesis: ["recent", "untreated"],
        exam: ["cavity"],
        findings: [
          {
            ...emptyFinding(),
            id: "vf_v2_16",
            toothFdi: 16,
            diagnosisId: "caries",
            examChips: ["cavity", "loc_approx", "depth_dentin"],
          },
        ],
        recommendations: ["return"],
        nextKind: "repeat",
        text: "Первичный приём. 16 зуб — кариес. Записана на лечение.",
      },
      createdAt: new Date().toISOString(),
    },
    {
      id: "v_3",
      patientId: "p_petrov",
      date: twoWeeks,
      items: [
        { id: "vi_5", serviceId: "s_pulp1", price: 8500, qty: 1, toothFdi: 36 },
        { id: "vi_6", serviceId: "s_anest_p", price: 900, qty: 1 },
        { id: "vi_7", serviceId: "s_xray", price: 800, qty: 1, toothFdi: 36 },
      ],
      notes: "Пульпит 36, каналы обработаны, временная пломба. Контроль через неделю.",
      discount: 0,
      total: 10200,
      paid: 5000,
      paymentMethod: "card",
      doctorId: "doc_ivanov",
      kind: "emergency",
      diary: {
        ...emptyDiary(),
        complaints: ["spontaneous", "acute"],
        anamnesis: ["worse"],
        exam: ["cavity", "perc_pain"],
        findings: [
          {
            ...emptyFinding(),
            id: "vf_v3_36",
            toothFdi: 36,
            diagnosisId: "pulpitis",
            treatments: ["anesthesia", "endo", "canal_mech", "temp_fill"],
            examChips: ["cavity", "perc_pain", "temp_hot"],
          },
        ],
        recommendations: ["return", "pain"],
        nextKind: "control",
        text: "Экстренный приём. 36 зуб — пульпит. Проведено эндодонтическое лечение, временная пломба.",
      },
      createdAt: new Date().toISOString(),
    },
    {
      id: "v_4",
      patientId: "p_kuznetsov",
      date: weekAgo,
      items: [
        { id: "vi_8", serviceId: "s_exam", price: 800, qty: 1 },
        { id: "vi_9", serviceId: "s_opg", price: 1800, qty: 1 },
      ],
      notes: "Показано удаление 38.",
      discount: 0,
      total: 2600,
      paid: 0,
      paymentMethod: undefined,
      doctorId: "doc_ivanov",
      kind: "primary",
      diary: {
        ...emptyDiary(),
        complaints: ["chewing"],
        exam: ["hygiene_ok"],
        findings: [
          {
            ...emptyFinding(),
            id: "vf_v4_38",
            toothFdi: 38,
            diagnosisId: "other",
            diagnosisText: "Ретинированный зуб мудрости",
          },
        ],
        recommendations: ["return"],
        nextKind: "repeat",
        text: "Первичный приём. 38 зуб — ретинированный. Показано удаление.",
      },
      createdAt: new Date().toISOString(),
    },
    {
      id: "v_5",
      patientId: "p_sokolova",
      date: format(subDays(new Date(), 210), "yyyy-MM-dd"),
      items: [
        { id: "vi_10", serviceId: "s_hygiene_full", price: 6500, qty: 1 },
        { id: "vi_11", serviceId: "s_fluor", price: 1500, qty: 1 },
      ],
      notes: "Контроль гигиены через 6 месяцев.",
      discount: 800,
      discountTypeId: "d_referral",
      total: 7200,
      paid: 7200,
      paymentMethod: "card",
      doctorId: "doc_ivanov",
      kind: "control",
      diary: {
        ...emptyDiary(),
        complaints: ["none"],
        exam: ["sanitized", "hygiene_ok"],
        findings: [
          {
            ...emptyFinding(),
            id: "vf_v5_h",
            diagnosisId: "gingivitis",
            treatments: ["hygiene"],
          },
        ],
        recommendations: ["hygiene", "control"],
        nextKind: "control",
        text: "Контрольный осмотр. Проведена профессиональная гигиена.",
      },
      createdAt: new Date().toISOString(),
    },
  ];
}

export function seedDiscountTypes(): DiscountType[] {
  return [
    { id: "d_regular", name: "Обычная 10%", category: "regular", kind: "percent", value: 10, active: true },
    { id: "d_referral", name: "Реферальная 10%", category: "referral", kind: "percent", value: 10, active: true },
    { id: "d_loyalty", name: "Постоянный пациент 5%", category: "loyalty", kind: "percent", value: 5, active: true },
    { id: "d_fixed1000", name: "Фиксированная 1 000 ₽", category: "regular", kind: "fixed", value: 1000, active: true },
    { id: "d_family", name: "Семейная 7%", category: "family", kind: "percent", value: 7, active: true },
    { id: "d_bday", name: "День рождения 15%", category: "birthday", kind: "percent", value: 15, active: true },
    { id: "d_promo", name: "Акция", category: "promo", kind: "percent", value: 10, active: true },
    { id: "d_repeat", name: "Повторный приём", category: "repeat", kind: "percent", value: 5, active: true },
    { id: "d_special", name: "Специальная", category: "special", kind: "percent", value: 20, active: false },
  ];
}

export function seedPlans(): TreatmentPlan[] {
  const today = format(new Date(), "yyyy-MM-dd");
  return [
    {
      id: "pl_ivanova_1",
      patientId: "p_ivanova",
      title: "План лечения, вариант 1",
      date: today,
      doctorName: "Иванов А. С.",
      items: [
        {
          id: "pli_1",
          toothFdi: 16,
          diagnosis: "Кариес дентина",
          serviceId: "s_caries2",
          serviceName: "Лечение кариеса, 2 поверхности",
          qty: 1,
          price: 6200,
          discount: 0,
        },
        {
          id: "pli_2",
          toothFdi: 16,
          diagnosis: "Контроль",
          serviceId: "s_xray",
          serviceName: "Прицельный снимок",
          qty: 1,
          price: 800,
          discount: 0,
        },
        {
          id: "pli_3",
          diagnosis: "Профилактика",
          serviceId: "s_hygiene",
          serviceName: "Профгигиена",
          qty: 1,
          price: 4500,
          discount: 0,
        },
      ],
      discountTypeId: "d_loyalty",
      discount: 575,
      notes: "Начать с 16. Анестезия без лидокаина — аллергия.",
      recommendations: "Контрольный осмотр через 6 месяцев. Ирригатор 1 раз в день.",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];
}

export function seedContacts(): ContactLog[] {
  return [
    {
      id: "c_sok_1",
      patientId: "p_sokolova",
      at: new Date().toISOString(),
      kind: "status",
      status: "call_later",
      text: "Не дозвонились утром, перезвонить вечером.",
    },
  ];
}

export function seedDoctors(): Doctor[] {
  return [
    {
      id: "doc_ivanov",
      lastName: "Иванов",
      firstName: "Александр",
      middleName: "Сергеевич",
      specialty: "Терапевт",
      color: "#1f5c52",
      login: "admin",
      passwordHash: "",
      passwordSalt: "",
      role: "admin",
      active: true,
      sharePercent: 40,
    },
  ];
}

export function seedServiceGroups(): ServiceGroup[] {
  return [
    { id: "diagnostics", name: "Диагностика", sort: 0 },
    { id: "xray", name: "Рентген", sort: 1 },
    { id: "anesthesia", name: "Анестезия", sort: 2 },
    { id: "therapy", name: "Терапия", sort: 3 },
    { id: "hygiene", name: "Гигиена", sort: 4 },
    { id: "surgery", name: "Хирургия", sort: 5 },
    { id: "prosthetics", name: "Ортопедия", sort: 6 },
  ];
}

export function seedDiaryTemplates(): DiaryTemplate[] {
  return DEFAULT_DIARY_TEMPLATES.map((t) => ({ ...t }));
}

export function buildSeed() {
  return {
    patients: seedPatients(),
    services: seedServices(),
    appointments: seedAppointments(),
    visits: seedVisits(),
    charts: seedCharts(),
    settings: defaultSettings(),
    photos: [] as import("./types").PhotoMeta[],
    albums: [] as import("./types").PhotoAlbum[],
    plans: seedPlans(),
    discounts: seedDiscountTypes(),
    contacts: seedContacts(),
    doctors: seedDoctors(),
    groups: seedServiceGroups(),
    diaryTemplates: seedDiaryTemplates(),
    budgetOps: [] as import("./types").BudgetOp[],
    budgetCategories: seedBudgetCategories(),
    budgetVendors: [] as import("./types").BudgetVendor[],
    budgetRecurring: [] as import("./types").BudgetRecurring[],
    budgetPlans: [] as import("./types").BudgetPlan[],
    stockGroups: seedStockGroups(),
    stockItems: seedStockItems(),
    orthoCards: {} as Record<string, import("./types").OrthoCard>,
    prosthoCards: {} as Record<string, import("./types").ProsthoCard>,
  };
}
