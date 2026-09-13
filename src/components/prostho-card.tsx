import { FileDown, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ChipToggle } from "@/components/chip-toggle";
import { DiagnosisField } from "@/components/diagnosis-field";
import { Odontogram } from "@/components/odontogram";
import { SaveFileDialog } from "@/components/save-file-dialog";
import { AttachStudyPhoto, SpecPhotos } from "@/components/spec-photos";
import {
  MultiChips,
  RadioChips,
  SavedHint,
  SpecNav,
  SpecSection,
  StudyList,
  TimelineView,
  useOpenMap,
  VisitList,
} from "@/components/spec-ui";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NumericInput } from "@/components/ui/numeric-input";
import { Textarea } from "@/components/ui/textarea";
import { ageYears, formatDate, fullName, money, todayISO } from "@/lib/format";
import { emptyPlanItem } from "@/lib/plan-groups";
import { buildProsthoPdfBlob, prosthoSections, specialtyHtml } from "@/lib/specialty-pdf";
import {
  CONSTRUCTION_KIND,
  CONSTRUCTION_STATUS,
  emptyConstruction,
  joinOpt,
  MATERIALS,
  mergeProstho,
  OCCLUSION,
  optLabel,
  PROSTHO_COMPLAINTS,
  PROSTHO_MARKS,
  PROSTHO_SHOTS,
  prosthoTimeline,
  TMJ,
  VITA_COLORS,
} from "@/lib/specialty";
import { useClinic } from "@/lib/store";
import type { ProsthoCard, ProsthoConstruction, ToothState, ToothStatus } from "@/lib/types";

const NAV = [
  { id: "complaints", label: "Жалобы" },
  { id: "anamnesis", label: "Анамнез" },
  { id: "exam", label: "Осмотр" },
  { id: "teeth", label: "Формула" },
  { id: "occlusion", label: "Окклюзия" },
  { id: "studies", label: "Диагностика" },
  { id: "dx", label: "Диагноз" },
  { id: "plan", label: "План" },
  { id: "constructions", label: "Конструкции" },
  { id: "photos", label: "Фото" },
  { id: "diary", label: "Дневник" },
  { id: "timeline", label: "Этапы" },
  { id: "result", label: "Результат" },
];

export function ProsthoCardPanel({ patientId }: { patientId: string }) {
  const patients = useClinic((s) => s.patients);
  const doctors = useClinic((s) => s.doctors);
  const settings = useClinic((s) => s.settings);
  const charts = useClinic((s) => s.charts);
  const setTooth = useClinic((s) => s.setTooth);
  const updatePatient = useClinic((s) => s.updatePatient);
  const updateProstho = useClinic((s) => s.updateProstho);
  const addPlan = useClinic((s) => s.addPlan);
  const updatePlan = useClinic((s) => s.updatePlan);
  const plans = useClinic((s) => s.plans);
  const raw = useClinic((s) => s.prosthoCards?.[patientId]);
  const card = mergeProstho(patientId, raw);
  const patient = patients.find((p) => p.id === patientId);
  const { isOpen, toggle, jump } = useOpenMap("complaints");
  const [pdf, setPdf] = useState<{ blob: Blob; name: string; html: string } | null>(null);
  const [editId, setEditId] = useState<string | null>(null);

  if (!patient) return null;
  const person = patient;

  const doctor = doctors.find((d) => d.id === settings.welcomeDoctorId) ?? doctors.find((d) => d.active);
  const doctorName = doctor ? fullName(doctor) : settings.doctorName;
  const materials = [
    ...MATERIALS.map(([id, label]) => [id, label] as const),
    ...card.customMaterials.map((m) => [m, m] as const),
  ];

  function save(patch: Partial<ProsthoCard>) {
    updateProstho(patientId, patch);
  }

  function patchConstruction(id: string, next: Partial<ProsthoConstruction>) {
    save({
      constructions: card.constructions.map((c) => (c.id === id ? { ...c, ...next, lab: next.lab ? { ...c.lab, ...next.lab } : c.lab } : c)),
    });
  }

  async function makePdf() {
    try {
      toast.message("Готовлю ортопедическую карту…");
      const built = await buildProsthoPdfBlob(card, person, settings, doctorName);
      if (!built.blob.size) throw new Error("PDF пустой");
      const head = new Uint8Array(await built.blob.slice(0, 5).arrayBuffer());
      if (!String.fromCharCode(...head).startsWith("%PDF")) throw new Error("Собранный файл не PDF");
      setPdf({
        ...built,
        html: specialtyHtml("Ортопедическая карта", person, settings, doctorName, prosthoSections(card)),
      });
      toast.success(`PDF готов, ${Math.max(1, Math.round(built.blob.size / 1024))} КБ`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "PDF не собрался");
    }
  }

  function addConstruction() {
    const next = emptyConstruction();
    save({ constructions: [...card.constructions, next] });
    setEditId(next.id);
    jump("constructions");
  }

  function toPlan() {
    if (!card.constructions.length) {
      toast.error("Сначала добавьте конструкцию");
      return;
    }
    const items = card.constructions.map((c) => ({
      ...emptyPlanItem(c.teeth[0]),
      serviceName: `${optLabel(CONSTRUCTION_KIND, c.kind)}${c.teeth.length ? ` · зубы ${c.teeth.join(", ")}` : ""}`,
      price: c.price,
      qty: 1,
      diagnosis: card.diagnosisText,
      diagnosisId: card.diagnosisId,
      note: [
        materials.find((m) => m[0] === c.material)?.[1] ?? c.material,
        c.color === "other" ? c.colorOther || "другой цвет" : c.color,
        optLabel(CONSTRUCTION_STATUS, c.status),
      ]
        .filter(Boolean)
        .join(" · "),
    }));
    const linked = card.linkedPlanId ? plans.find((p) => p.id === card.linkedPlanId) : undefined;
    if (linked) {
      updatePlan(linked.id, { items: [...linked.items, ...items], notes: card.planNotes || linked.notes });
      toast.success("Конструкции добавлены в существующий план. Касса не меняется.");
      return;
    }
    const id = addPlan({
      patientId,
      title: `Ортопедический план, ${formatDate(todayISO(), "d MMMM yyyy")}`,
      date: todayISO(),
      doctorName,
      doctorId: doctor?.id,
      items,
      discountTypeId: person.discountTypeId ?? "",
      discount: 0,
      notes: card.planNotes,
      recommendations: "",
    });
    save({ linkedPlanId: id });
    toast.success("Создан план лечения. Счёт появится только после оплаты приёма.");
  }

  function onTooth(fdi: number, status: ToothStatus, note: string, surfaces?: ToothState["surfaces"]) {
    setTooth(patientId, fdi, status, note, surfaces);
  }

  function addMaterial(name: string) {
    const n = name.trim();
    if (!n || card.customMaterials.includes(n) || MATERIALS.some((m) => m[0] === n || m[1] === n)) return;
    save({ customMaterials: [...card.customMaterials, n] });
  }

  const editing = card.constructions.find((c) => c.id === editId);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-display text-xl">Ортопедическая карта</h2>
          <SavedHint at={card.updatedAt} />
        </div>
        <Button type="button" variant="secondary" onClick={() => void makePdf()}>
          <FileDown className="size-4" />
          PDF карты
        </Button>
      </div>
      <SpecNav items={NAV} onJump={jump} />

      <SpecSection
        id="complaints"
        title="Жалобы"
        open={isOpen("complaints")}
        onToggle={() => toggle("complaints")}
        summary={joinOpt(PROSTHO_COMPLAINTS, card.complaints, card.complaintsNote)}
      >
        <MultiChips options={PROSTHO_COMPLAINTS} value={card.complaints} onChange={(complaints) => save({ complaints })} />
        <Field label="Комментарий">
          <Textarea rows={2} value={card.complaintsNote} onChange={(e) => save({ complaintsNote: e.target.value })} />
        </Field>
      </SpecSection>

      <SpecSection id="anamnesis" title="Анамнез" open={isOpen("anamnesis")} onToggle={() => toggle("anamnesis")}>
        <Field label="Анамнез">
          <Textarea rows={3} value={card.anamnesis} onChange={(e) => save({ anamnesis: e.target.value })} />
        </Field>
      </SpecSection>

      <SpecSection id="exam" title="Объективный осмотр" open={isOpen("exam")} onToggle={() => toggle("exam")}>
        <Field label="Осмотр">
          <Textarea rows={3} value={card.exam} onChange={(e) => save({ exam: e.target.value })} />
        </Field>
      </SpecSection>

      <SpecSection id="teeth" title="Зубная формула и ортопедический статус" open={isOpen("teeth")} onToggle={() => toggle("teeth")}>
        <p className="text-sm text-muted">Та же формула пациента. На зуб — состояние и ортопедические отметки.</p>
        <Odontogram
          chart={charts[patientId] ?? {}}
          onChange={onTooth}
          marks={card.teethMarks}
          markOptions={PROSTHO_MARKS}
          onMarksChange={(fdi, next) => save({ teethMarks: { ...card.teethMarks, [String(fdi)]: next } })}
          hint="FDI · состояние и ортопедические отметки"
          patientAge={ageYears(patient.birthDate)}
          dentition={patient.dentitionMode}
          onDentitionChange={(mode) => updatePatient(patientId, { dentitionMode: mode })}
        />
      </SpecSection>

      <SpecSection id="occlusion" title="Окклюзия и ВНЧС" open={isOpen("occlusion")} onToggle={() => toggle("occlusion")}>
        <Field label="Окклюзия">
          <RadioChips options={OCCLUSION} value={card.occlusion} onChange={(occlusion) => save({ occlusion })} />
        </Field>
        <Field label="ВНЧС">
          <RadioChips options={TMJ} value={card.tmj} onChange={(tmj) => save({ tmj })} />
        </Field>
      </SpecSection>

      <SpecSection id="studies" title="Диагностика" open={isOpen("studies")} onToggle={() => toggle("studies")}>
        <StudyList
          items={card.studies}
          onChange={(studies) => save({ studies })}
          extra={(s) => (
            <AttachStudyPhoto
              patientId={patientId}
              specialty="prostho"
              photoId={s.photoId}
              onChange={(photoId) => save({ studies: card.studies.map((x) => (x.id === s.id ? { ...x, photoId } : x)) })}
            />
          )}
        />
      </SpecSection>

      <SpecSection id="dx" title="Диагноз" open={isOpen("dx")} onToggle={() => toggle("dx")} summary={card.diagnosisText}>
        <DiagnosisField
          diagnosisId={card.diagnosisId}
          diagnosisText={card.diagnosisText}
          complaints={joinOpt(PROSTHO_COMPLAINTS, card.complaints, card.complaintsNote)}
          exam={card.exam}
          onChange={(next) => save(next)}
        />
      </SpecSection>

      <SpecSection id="plan" title="План лечения" open={isOpen("plan")} onToggle={() => toggle("plan")}>
        <Field label="Комментарий к плану">
          <Textarea rows={3} value={card.planNotes} onChange={(e) => save({ planNotes: e.target.value })} />
        </Field>
        <Button type="button" variant="secondary" onClick={toPlan}>
          <Plus className="size-4" />
          Конструкции в план лечения
        </Button>
        <p className="text-[12px] text-muted">
          Стоимость конструкции попадёт в план. Касса, счёт и бюджет не меняются, пока нет фактической оплаты.
        </p>
      </SpecSection>

      <SpecSection
        id="constructions"
        title="Конструкции"
        open={isOpen("constructions")}
        onToggle={() => toggle("constructions")}
        summary={card.constructions.length ? `${card.constructions.length}` : ""}
      >
        <Button type="button" onClick={addConstruction}>
          <Plus className="size-4" />
          Конструкция
        </Button>
        {card.constructions.length === 0 ? <p className="text-sm text-muted">Конструкций пока нет</p> : null}
        <ul className="flex flex-col gap-2">
          {card.constructions.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => setEditId(editId === c.id ? null : c.id)}
                className="w-full rounded-lg bg-bg px-3 py-3 text-left"
              >
                <p className="font-medium">
                  {optLabel(CONSTRUCTION_KIND, c.kind)}
                  {c.teeth.length ? ` · зубы ${c.teeth.join(", ")}` : ""}
                </p>
                <p className="text-[13px] text-muted">
                  {materials.find((m) => m[0] === c.material)?.[1] ?? c.material}
                  {c.color ? ` · ${c.color === "other" ? c.colorOther || "другой" : c.color}` : ""}
                  {` · ${optLabel(CONSTRUCTION_STATUS, c.status)}`}
                  {c.price ? ` · ${money(c.price)}` : ""}
                </p>
              </button>
              {editing?.id === c.id ? (
                <ConstructionEditor
                  construction={c}
                  materials={materials}
                  chart={charts[patientId] ?? {}}
                  onPatch={(next) => patchConstruction(c.id, next)}
                  onAddMaterial={addMaterial}
                  onRemove={() => {
                    save({ constructions: card.constructions.filter((x) => x.id !== c.id) });
                    setEditId(null);
                  }}
                />
              ) : null}
            </li>
          ))}
        </ul>
      </SpecSection>

      <SpecSection id="photos" title="Фото" open={isOpen("photos")} onToggle={() => toggle("photos")}>
        <SpecPhotos patientId={patientId} specialty="prostho" shots={PROSTHO_SHOTS} lockStageToShot />
      </SpecSection>

      <SpecSection id="diary" title="Дневник ортопеда" open={isOpen("diary")} onToggle={() => toggle("diary")}>
        <VisitList items={card.visits} onChange={(visits) => save({ visits })} statusLabel="Объективный статус / конструкция" />
      </SpecSection>

      <SpecSection id="timeline" title="Этапы работы" open={isOpen("timeline")} onToggle={() => toggle("timeline")}>
        <TimelineView events={prosthoTimeline(card)} />
      </SpecSection>

      <SpecSection id="result" title="Результат лечения" open={isOpen("result")} onToggle={() => toggle("result")}>
        <Field label="Результат">
          <Textarea rows={4} value={card.result} onChange={(e) => save({ result: e.target.value })} />
        </Field>
      </SpecSection>

      <SaveFileDialog
        open={Boolean(pdf)}
        onOpenChange={(o) => {
          if (!o) setPdf(null);
        }}
        blob={pdf?.blob ?? null}
        filename={pdf?.name ?? "prostho.pdf"}
        title="Ортопедическая карта"
        kind="pdf"
        html={pdf?.html}
      />
    </div>
  );
}

function ConstructionEditor({
  construction: c,
  materials,
  chart,
  onPatch,
  onAddMaterial,
  onRemove,
}: {
  construction: ProsthoConstruction;
  materials: readonly (readonly [string, string])[];
  chart: Record<number, ToothState>;
  onPatch: (next: Partial<ProsthoConstruction>) => void;
  onAddMaterial: (name: string) => void;
  onRemove: () => void;
}) {
  const [customMat, setCustomMat] = useState("");
  return (
    <div className="mt-2 flex flex-col gap-3 rounded-lg bg-surface p-3 shadow-[var(--shadow-card)]">
      <Field label="Зубы">
        <p className="mb-1 text-[12px] text-muted">Нажмите зубы на формуле. Повторно — снять.</p>
        <Odontogram
          chart={chart}
          mode="pick"
          picked={c.teeth}
          onPick={(fdi) =>
            onPatch({
              teeth: c.teeth.includes(fdi) ? c.teeth.filter((n) => n !== fdi) : [...c.teeth, fdi].sort((a, b) => a - b),
            })
          }
          title=""
          hint="Выбор зубов конструкции"
        />
      </Field>
      <Field label="Тип конструкции">
        <RadioChips options={CONSTRUCTION_KIND} value={c.kind} onChange={(kind) => onPatch({ kind })} />
      </Field>
      <Field label="Материал">
        <div className="flex flex-wrap gap-1.5">
          {materials.map(([id, label]) => (
            <ChipToggle key={id} label={label} on={c.material === id} onToggle={() => onPatch({ material: id })} />
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <Input
            value={customMat}
            onChange={(e) => setCustomMat(e.target.value)}
            placeholder="Свой материал"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onAddMaterial(customMat);
                if (customMat.trim()) onPatch({ material: customMat.trim() });
                setCustomMat("");
              }
            }}
          />
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              onAddMaterial(customMat);
              if (customMat.trim()) onPatch({ material: customMat.trim() });
              setCustomMat("");
            }}
          >
            Добавить
          </Button>
        </div>
      </Field>
      <Field label="Цвет VITA">
        <Select
          value={c.color}
          onChange={(e) => onPatch({ color: e.target.value })}
        >
          {VITA_COLORS.map((col) => (
            <option key={col} value={col}>
              {col === "other" ? "Другой" : col}
            </option>
          ))}
        </Select>
      </Field>
      {c.color === "other" ? (
        <Field label="Свой цвет">
          <Input value={c.colorOther} onChange={(e) => onPatch({ colorOther: e.target.value })} />
        </Field>
      ) : null}
      <Field label="Стоимость, ₽">
        <NumericInput value={c.price} onValue={(price) => onPatch({ price })} />
      </Field>
      <Field label="Статус">
        <RadioChips options={CONSTRUCTION_STATUS} value={c.status} onChange={(status) => onPatch({ status })} />
      </Field>
      <Field label="Комментарий">
        <Textarea rows={2} value={c.notes} onChange={(e) => onPatch({ notes: e.target.value })} />
      </Field>

      <div>
        <p className="mb-2 text-sm font-medium">Этапы</p>
        <ul className="flex flex-col gap-2">
          {c.stages.map((st) => (
            <li key={st.id} className="grid grid-cols-[auto_1fr_8rem] items-center gap-2">
              <ChipToggle
                label={st.done ? "Готово" : "Нет"}
                on={st.done}
                onToggle={() =>
                  onPatch({
                    stages: c.stages.map((x) =>
                      x.id === st.id ? { ...x, done: !x.done, date: !x.done && !x.date ? todayISO() : x.date } : x,
                    ),
                  })
                }
              />
              <span className="text-sm">{st.name}</span>
              <Input
                type="date"
                value={st.date}
                onChange={(e) =>
                  onPatch({
                    stages: c.stages.map((x) => (x.id === st.id ? { ...x, date: e.target.value } : x)),
                  })
                }
              />
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-lg bg-bg p-3">
        <p className="mb-2 font-medium">Зуботехническая лаборатория</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Лаборатория">
            <Input value={c.lab.name} onChange={(e) => onPatch({ lab: { ...c.lab, name: e.target.value } })} />
          </Field>
          <Field label="Техник">
            <Input value={c.lab.technician} onChange={(e) => onPatch({ lab: { ...c.lab, technician: e.target.value } })} />
          </Field>
          <Field label="Дата отправки">
            <Input type="date" value={c.lab.sentOn} onChange={(e) => onPatch({ lab: { ...c.lab, sentOn: e.target.value } })} />
          </Field>
          <Field label="Дата получения">
            <Input type="date" value={c.lab.receivedOn} onChange={(e) => onPatch({ lab: { ...c.lab, receivedOn: e.target.value } })} />
          </Field>
          <Field label="Стоимость лаборатории, ₽">
            <NumericInput value={c.lab.cost} onValue={(cost) => onPatch({ lab: { ...c.lab, cost } })} />
          </Field>
          <Field label="Комментарий" className="sm:col-span-2">
            <Textarea rows={2} value={c.lab.notes} onChange={(e) => onPatch({ lab: { ...c.lab, notes: e.target.value } })} />
          </Field>
        </div>
        <p className="mt-2 text-[12px] text-muted">Поля заложены под будущий модуль лабораторий. Отдельной базы техников нет.</p>
      </div>

      <Button type="button" variant="ghost" className="self-start text-danger" onClick={onRemove}>
        <Trash2 className="size-4" />
        Удалить конструкцию
      </Button>
    </div>
  );
}
