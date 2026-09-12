import { FileDown, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { DiagnosisField } from "@/components/diagnosis-field";
import { Odontogram } from "@/components/odontogram";
import { SaveFileDialog } from "@/components/save-file-dialog";
import { AttachStudyPhoto, SpecPhotos } from "@/components/spec-photos";
import {
  MeasureList,
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
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ageYears, formatDate, fullName, todayISO } from "@/lib/format";
import { emptyPlanItem } from "@/lib/plan-groups";
import { buildOrthoPdfBlob, orthoSections, specialtyHtml } from "@/lib/specialty-pdf";
import {
  APPLIANCE_TYPE,
  ARCH_CROWD,
  ARCH_DIASTEMA,
  ARCH_FORM,
  ARCH_LEN,
  ARCH_SYM,
  ARCH_TREMA,
  ARCH_WIDTH,
  BITE_SAG,
  BITE_TRANS,
  BITE_VERT,
  composeOrthoEpicrisis,
  DENTITION,
  FACE_CHIN,
  FACE_LIPS,
  FACE_PROFILE,
  FACE_PROP,
  FACE_SYMMETRY,
  FACE_TYPE,
  HYGIENE,
  joinOpt,
  mergeOrtho,
  MUCOSA,
  optLabel,
  ORTHO_ANAMNESIS,
  ORTHO_COMPLAINTS,
  ORTHO_MARKS,
  ORTHO_SHOTS,
  orthoTimeline,
  PERIO,
  RETAINER_TYPE,
  TEETH_STATE,
} from "@/lib/specialty";
import { useClinic } from "@/lib/store";
import type { OrthoCard, ToothState, ToothStatus } from "@/lib/types";

const NAV = [
  { id: "info", label: "Пациент" },
  { id: "complaints", label: "Жалобы" },
  { id: "anamnesis", label: "Анамнез" },
  { id: "face", label: "Осмотр" },
  { id: "oral", label: "Полость рта" },
  { id: "teeth", label: "Зубы" },
  { id: "bite", label: "Прикус" },
  { id: "arches", label: "Ряды" },
  { id: "measures", label: "Измерения" },
  { id: "studies", label: "Диагностика" },
  { id: "photos", label: "Фото" },
  { id: "dx", label: "Диагноз" },
  { id: "plan", label: "План" },
  { id: "appliance", label: "Аппарат" },
  { id: "diary", label: "Дневник" },
  { id: "timeline", label: "Хронология" },
  { id: "retention", label: "Ретенция" },
  { id: "epicrisis", label: "Эпикриз" },
];

export function OrthoCardPanel({ patientId }: { patientId: string }) {
  const patients = useClinic((s) => s.patients);
  const doctors = useClinic((s) => s.doctors);
  const settings = useClinic((s) => s.settings);
  const charts = useClinic((s) => s.charts);
  const setTooth = useClinic((s) => s.setTooth);
  const updateOrtho = useClinic((s) => s.updateOrtho);
  const addPlan = useClinic((s) => s.addPlan);
  const raw = useClinic((s) => s.orthoCards?.[patientId]);
  const card = mergeOrtho(patientId, raw);
  const patient = patients.find((p) => p.id === patientId);
  const { isOpen, toggle, jump } = useOpenMap("complaints");
  const [pdf, setPdf] = useState<{ blob: Blob; name: string; html: string } | null>(null);

  if (!patient) return null;
  const person = patient;

  const doctor = doctors.find((d) => d.id === settings.welcomeDoctorId) ?? doctors.find((d) => d.active);
  const doctorName = doctor ? fullName(doctor) : settings.doctorName;

  function save(patch: Partial<OrthoCard>) {
    updateOrtho(patientId, patch);
  }

  async function makePdf() {
    try {
      toast.message("Готовлю ортодонтическую карту…");
      const built = await buildOrthoPdfBlob(card, person, settings, doctorName);
      if (!built.blob.size) throw new Error("PDF пустой");
      const head = new Uint8Array(await built.blob.slice(0, 5).arrayBuffer());
      if (!String.fromCharCode(...head).startsWith("%PDF")) throw new Error("Собранный файл не PDF");
      setPdf({
        ...built,
        html: specialtyHtml("Ортодонтическая карта", person, settings, doctorName, orthoSections(card)),
      });
      toast.success(`PDF готов, ${Math.max(1, Math.round(built.blob.size / 1024))} КБ`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "PDF не собрался");
    }
  }

  function toPlan() {
    const name =
      card.plan.method ||
      (card.appliance.type ? optLabel(APPLIANCE_TYPE, card.appliance.type) : "") ||
      "Ортодонтическое лечение";
    const id = addPlan({
      patientId,
      title: `Ортодонтический план, ${formatDate(todayISO(), "d MMMM yyyy")}`,
      date: todayISO(),
      doctorName,
      doctorId: doctor?.id,
      items: [
        {
          ...emptyPlanItem(),
          serviceName: name,
          diagnosis: card.diagnosisText,
          diagnosisId: card.diagnosisId,
          note: [card.plan.goal, card.plan.appliance, card.plan.duration].filter(Boolean).join(" · "),
          price: 0,
          qty: 1,
        },
      ],
      discountTypeId: person.discountTypeId ?? "",
      discount: 0,
      notes: card.plan.notes,
      recommendations: "",
    });
    save({ plan: { ...card.plan, linkedPlanId: id } });
    toast.success("План лечения создан. Счёт появится только после оплаты приёма.");
  }

  function onTooth(fdi: number, status: ToothStatus, note: string, surfaces?: ToothState["surfaces"]) {
    setTooth(patientId, fdi, status, note, surfaces);
  }

  const type = card.appliance.type;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-display text-xl">Ортодонтическая карта</h2>
          <SavedHint at={card.updatedAt} />
        </div>
        <Button type="button" variant="secondary" onClick={() => void makePdf()}>
          <FileDown className="size-4" />
          PDF карты
        </Button>
      </div>
      <SpecNav items={NAV} onJump={jump} />

      <SpecSection id="info" title="Общая информация" open={isOpen("info")} onToggle={() => toggle("info")} summary={fullName(person)}>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-[12px] text-muted">Пациент</dt>
            <dd>{fullName(person)}</dd>
          </div>
          <div>
            <dt className="text-[12px] text-muted">Дата рождения</dt>
            <dd>{person.birthDate ? formatDate(person.birthDate) : "—"}</dd>
          </div>
          <div>
            <dt className="text-[12px] text-muted">Телефон</dt>
            <dd>{person.phone || "—"}</dd>
          </div>
          <div>
            <dt className="text-[12px] text-muted">№ карты</dt>
            <dd>{person.cardNumber || "—"}</dd>
          </div>
        </dl>
        <p className="text-[12px] text-muted">ФИО и контакты берутся из карточки пациента, отдельной копии нет.</p>
      </SpecSection>

      <SpecSection
        id="complaints"
        title="Жалобы"
        open={isOpen("complaints")}
        onToggle={() => toggle("complaints")}
        summary={joinOpt(ORTHO_COMPLAINTS, card.complaints, card.complaintsNote)}
      >
        <MultiChips options={ORTHO_COMPLAINTS} value={card.complaints} onChange={(complaints) => save({ complaints })} />
        <Field label="Комментарий">
          <Textarea rows={2} value={card.complaintsNote} onChange={(e) => save({ complaintsNote: e.target.value })} />
        </Field>
      </SpecSection>

      <SpecSection
        id="anamnesis"
        title="Анамнез"
        open={isOpen("anamnesis")}
        onToggle={() => toggle("anamnesis")}
        summary={joinOpt(ORTHO_ANAMNESIS, card.anamnesis, card.anamnesisNote)}
      >
        <MultiChips options={ORTHO_ANAMNESIS} value={card.anamnesis} onChange={(anamnesis) => save({ anamnesis })} />
        <Field label="Комментарий врача">
          <Textarea rows={2} value={card.anamnesisNote} onChange={(e) => save({ anamnesisNote: e.target.value })} />
        </Field>
      </SpecSection>

      <SpecSection id="face" title="Внешний осмотр" open={isOpen("face")} onToggle={() => toggle("face")}>
        <Field label="Симметрия лица">
          <RadioChips options={FACE_SYMMETRY} value={card.face.symmetry} onChange={(symmetry) => save({ face: { ...card.face, symmetry } })} />
        </Field>
        <Field label="Профиль">
          <RadioChips options={FACE_PROFILE} value={card.face.profile} onChange={(profile) => save({ face: { ...card.face, profile } })} />
        </Field>
        <Field label="Тип лица">
          <RadioChips options={FACE_TYPE} value={card.face.faceType} onChange={(faceType) => save({ face: { ...card.face, faceType } })} />
        </Field>
        <Field label="Пропорции">
          <RadioChips options={FACE_PROP} value={card.face.proportions} onChange={(proportions) => save({ face: { ...card.face, proportions } })} />
        </Field>
        <Field label="Положение губ">
          <RadioChips options={FACE_LIPS} value={card.face.lips} onChange={(lips) => save({ face: { ...card.face, lips } })} />
        </Field>
        <Field label="Положение подбородка">
          <RadioChips options={FACE_CHIN} value={card.face.chin} onChange={(chin) => save({ face: { ...card.face, chin } })} />
        </Field>
      </SpecSection>

      <SpecSection id="oral" title="Осмотр полости рта" open={isOpen("oral")} onToggle={() => toggle("oral")}>
        <Field label="Слизистая">
          <RadioChips options={MUCOSA} value={card.oral.mucosa} onChange={(mucosa) => save({ oral: { ...card.oral, mucosa } })} />
        </Field>
        <Field label="Гигиена">
          <RadioChips options={HYGIENE} value={card.oral.hygiene} onChange={(hygiene) => save({ oral: { ...card.oral, hygiene } })} />
        </Field>
        <Field label="Состояние зубов">
          <RadioChips options={TEETH_STATE} value={card.oral.teeth} onChange={(teeth) => save({ oral: { ...card.oral, teeth } })} />
        </Field>
        <Field label="Пародонт">
          <RadioChips options={PERIO} value={card.oral.periodontium} onChange={(periodontium) => save({ oral: { ...card.oral, periodontium } })} />
        </Field>
      </SpecSection>

      <SpecSection id="teeth" title="Зубная формула" open={isOpen("teeth")} onToggle={() => toggle("teeth")}>
        <p className="text-sm text-muted">Та же формула, что на вкладке «Формула». На зуб — состояние и ортодонтические отметки.</p>
        <Odontogram
          chart={charts[patientId] ?? {}}
          onChange={onTooth}
          marks={card.teethMarks}
          markOptions={ORTHO_MARKS}
          onMarksChange={(fdi, next) => save({ teethMarks: { ...card.teethMarks, [String(fdi)]: next } })}
          hint="FDI · состояние и ортодонтические отметки"
          patientAge={ageYears(patient.birthDate)}
        />
      </SpecSection>

      <SpecSection id="bite" title="Прикус" open={isOpen("bite")} onToggle={() => toggle("bite")}>
        <Field label="Прикус (зубной ряд)">
          <RadioChips options={DENTITION} value={card.dentition} onChange={(dentition) => save({ dentition })} />
        </Field>
        <Field label="Сагиттально">
          <RadioChips options={BITE_SAG} value={card.biteSagittal} onChange={(biteSagittal) => save({ biteSagittal })} />
        </Field>
        <Field label="Вертикально">
          <RadioChips options={BITE_VERT} value={card.biteVertical} onChange={(biteVertical) => save({ biteVertical })} />
        </Field>
        <Field label="Трансверзально">
          <RadioChips options={BITE_TRANS} value={card.biteTransverse} onChange={(biteTransverse) => save({ biteTransverse })} />
        </Field>
      </SpecSection>

      <SpecSection id="arches" title="Зубные ряды" open={isOpen("arches")} onToggle={() => toggle("arches")}>
        <Field label="Форма дуги">
          <RadioChips options={ARCH_FORM} value={card.arches.form} onChange={(form) => save({ arches: { ...card.arches, form } })} />
        </Field>
        <Field label="Ширина">
          <RadioChips options={ARCH_WIDTH} value={card.arches.width} onChange={(width) => save({ arches: { ...card.arches, width } })} />
        </Field>
        <Field label="Длина">
          <RadioChips options={ARCH_LEN} value={card.arches.length} onChange={(length) => save({ arches: { ...card.arches, length } })} />
        </Field>
        <Field label="Скученность">
          <RadioChips options={ARCH_CROWD} value={card.arches.crowding} onChange={(crowding) => save({ arches: { ...card.arches, crowding } })} />
        </Field>
        <Field label="Тремы">
          <RadioChips options={ARCH_TREMA} value={card.arches.trema} onChange={(trema) => save({ arches: { ...card.arches, trema } })} />
        </Field>
        <Field label="Диастема">
          <RadioChips options={ARCH_DIASTEMA} value={card.arches.diastema} onChange={(diastema) => save({ arches: { ...card.arches, diastema } })} />
        </Field>
        <Field label="Симметричность">
          <RadioChips options={ARCH_SYM} value={card.arches.symmetry} onChange={(symmetry) => save({ arches: { ...card.arches, symmetry } })} />
        </Field>
      </SpecSection>

      <SpecSection id="measures" title="Измерения" open={isOpen("measures")} onToggle={() => toggle("measures")}>
        <p className="text-sm text-muted">Единицы — мм. Список параметров можно расширять.</p>
        <MeasureList items={card.measurements} onChange={(measurements) => save({ measurements })} />
      </SpecSection>

      <SpecSection id="studies" title="Рентгенологические исследования" open={isOpen("studies")} onToggle={() => toggle("studies")}>
        <StudyList
          items={card.studies}
          onChange={(studies) => save({ studies })}
          extra={(s) => (
            <AttachStudyPhoto
              patientId={patientId}
              specialty="ortho"
              photoId={s.photoId}
              onChange={(photoId) => save({ studies: card.studies.map((x) => (x.id === s.id ? { ...x, photoId } : x)) })}
            />
          )}
        />
      </SpecSection>

      <SpecSection id="photos" title="Фотопротокол" open={isOpen("photos")} onToggle={() => toggle("photos")}>
        <SpecPhotos patientId={patientId} specialty="ortho" shots={ORTHO_SHOTS} />
      </SpecSection>

      <SpecSection id="dx" title="Диагноз" open={isOpen("dx")} onToggle={() => toggle("dx")} summary={card.diagnosisText}>
        <DiagnosisField
          diagnosisId={card.diagnosisId}
          diagnosisText={card.diagnosisText}
          complaints={joinOpt(ORTHO_COMPLAINTS, card.complaints, card.complaintsNote)}
          onChange={(next) => save(next)}
        />
      </SpecSection>

      <SpecSection id="plan" title="План лечения" open={isOpen("plan")} onToggle={() => toggle("plan")}>
        <Field label="Цель">
          <Textarea rows={2} value={card.plan.goal} onChange={(e) => save({ plan: { ...card.plan, goal: e.target.value } })} />
        </Field>
        <Field label="Метод">
          <Input value={card.plan.method} onChange={(e) => save({ plan: { ...card.plan, method: e.target.value } })} />
        </Field>
        <Field label="Аппарат">
          <Input value={card.plan.appliance} onChange={(e) => save({ plan: { ...card.plan, appliance: e.target.value } })} />
        </Field>
        <Field label="Этапы">
          <Textarea rows={3} value={card.plan.stages} onChange={(e) => save({ plan: { ...card.plan, stages: e.target.value } })} />
        </Field>
        <Field label="Предполагаемая продолжительность">
          <Input value={card.plan.duration} onChange={(e) => save({ plan: { ...card.plan, duration: e.target.value } })} />
        </Field>
        <Field label="Комментарий">
          <Textarea rows={2} value={card.plan.notes} onChange={(e) => save({ plan: { ...card.plan, notes: e.target.value } })} />
        </Field>
        <Button type="button" variant="secondary" onClick={toPlan}>
          <Plus className="size-4" />
          Добавить в план лечения
        </Button>
        <p className="text-[12px] text-muted">Появится на вкладке «Планы». Касса не меняется, пока нет оплаты.</p>
      </SpecSection>

      <SpecSection id="appliance" title="Ортодонтический аппарат" open={isOpen("appliance")} onToggle={() => toggle("appliance")}>
        <Field label="Тип">
          <RadioChips options={APPLIANCE_TYPE} value={type} onChange={(next) => save({ appliance: { ...card.appliance, type: next } })} />
        </Field>
        {type === "braces" ? (
          <>
            <Field label="Тип брекетов">
              <Input
                value={card.appliance.bracketType}
                onChange={(e) => save({ appliance: { ...card.appliance, bracketType: e.target.value } })}
                placeholder="Металлические, керамические…"
              />
            </Field>
            <Field label="Система">
              <Input value={card.appliance.system} onChange={(e) => save({ appliance: { ...card.appliance, system: e.target.value } })} />
            </Field>
            <Field label="Материал">
              <Input value={card.appliance.material} onChange={(e) => save({ appliance: { ...card.appliance, material: e.target.value } })} />
            </Field>
            <Field label="Дата установки">
              <Input
                type="date"
                value={card.appliance.installedOn}
                onChange={(e) => save({ appliance: { ...card.appliance, installedOn: e.target.value } })}
              />
            </Field>
          </>
        ) : null}
        {type === "aligners" ? (
          <>
            <Field label="Производитель">
              <Input
                value={card.appliance.alignerBrand}
                onChange={(e) => save({ appliance: { ...card.appliance, alignerBrand: e.target.value } })}
              />
            </Field>
            <Field label="Количество этапов">
              <Input
                value={card.appliance.alignerTotal}
                onChange={(e) => save({ appliance: { ...card.appliance, alignerTotal: e.target.value } })}
              />
            </Field>
            <Field label="Текущий этап">
              <Input
                value={card.appliance.alignerCurrent}
                onChange={(e) => save({ appliance: { ...card.appliance, alignerCurrent: e.target.value } })}
              />
            </Field>
          </>
        ) : null}
        {type && type !== "braces" && type !== "aligners" ? (
          <Field label="Дата установки">
            <Input
              type="date"
              value={card.appliance.installedOn}
              onChange={(e) => save({ appliance: { ...card.appliance, installedOn: e.target.value } })}
            />
          </Field>
        ) : null}
        <Field label="Комментарий">
          <Textarea rows={2} value={card.appliance.notes} onChange={(e) => save({ appliance: { ...card.appliance, notes: e.target.value } })} />
        </Field>
      </SpecSection>

      <SpecSection id="diary" title="Дневник ортодонта" open={isOpen("diary")} onToggle={() => toggle("diary")}>
        <p className="text-sm text-muted">Контрольные приёмы и состояние аппарата — в этих же записях.</p>
        <VisitList items={card.visits} onChange={(visits) => save({ visits })} statusLabel="Состояние аппарата / изменения" />
      </SpecSection>

      <SpecSection id="timeline" title="Хронология лечения" open={isOpen("timeline")} onToggle={() => toggle("timeline")}>
        <TimelineView events={orthoTimeline(card)} />
      </SpecSection>

      <SpecSection id="retention" title="Ретенционный период" open={isOpen("retention")} onToggle={() => toggle("retention")}>
        <Field label="Окончание активного лечения">
          <Input type="date" value={card.retention.activeEnd} onChange={(e) => save({ retention: { ...card.retention, activeEnd: e.target.value } })} />
        </Field>
        <Field label="Тип ретейнера">
          <RadioChips
            options={RETAINER_TYPE}
            value={card.retention.retainerType}
            onChange={(retainerType) => save({ retention: { ...card.retention, retainerType } })}
          />
        </Field>
        <Field label="Дата установки">
          <Input
            type="date"
            value={card.retention.installedOn}
            onChange={(e) => save({ retention: { ...card.retention, installedOn: e.target.value } })}
          />
        </Field>
        <Field label="Рекомендации">
          <Textarea rows={2} value={card.retention.notes} onChange={(e) => save({ retention: { ...card.retention, notes: e.target.value } })} />
        </Field>
        <Field label="План контрольных осмотров">
          <Textarea
            rows={2}
            value={card.retention.recallPlan}
            onChange={(e) => save({ retention: { ...card.retention, recallPlan: e.target.value } })}
          />
        </Field>
      </SpecSection>

      <SpecSection id="epicrisis" title="Эпикриз" open={isOpen("epicrisis")} onToggle={() => toggle("epicrisis")}>
        <Button
          type="button"
          variant="secondary"
          onClick={() => save({ epicrisis: composeOrthoEpicrisis(card, person, doctorName) })}
        >
          Сформировать из данных карты
        </Button>
        <Field label="Текст эпикриза">
          <Textarea rows={8} value={card.epicrisis} onChange={(e) => save({ epicrisis: e.target.value })} />
        </Field>
      </SpecSection>

      <SaveFileDialog
        open={Boolean(pdf)}
        onOpenChange={(o) => {
          if (!o) setPdf(null);
        }}
        blob={pdf?.blob ?? null}
        filename={pdf?.name ?? "ortho.pdf"}
        title="Ортодонтическая карта"
        kind="pdf"
        html={pdf?.html}
      />
    </div>
  );
}
