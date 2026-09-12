import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { ChipGroup } from "@/components/chip-toggle";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  ANAMNESIS_OPTIONS,
  COMPLAINT_OPTIONS,
  composeDiaryText,
  diarySections,
  emptyFinding,
  EXAM_OPTIONS,
  NEXT_KIND_OPTIONS,
  RECOMMEND_OPTIONS,
  TOOTH_EXAM_OPTIONS,
  TREATMENT_OPTIONS,
  VISIT_KIND_LABEL,
  VISIT_KIND_ORDER,
} from "@/lib/diary";
import { DiagnosisField } from "@/components/diagnosis-field";
import { slotTaken, isBlocking } from "@/lib/clinic";
import { ToothFdiOptions } from "@/components/odontogram";
import { useClinic } from "@/lib/store";
import type { DiaryExtras, DiaryTemplate, VisitDiary, VisitFinding, VisitKind } from "@/lib/types";
import { MaterialPicker } from "@/components/material-picker";

export function VisitDiaryForm({
  kind,
  onKind,
  diary,
  onChange,
  templates,
  extras,
  onAddExtra,
  onApplyTemplate,
  onSaveTemplate,
  patientId,
}: {
  kind: VisitKind;
  onKind: (k: VisitKind) => void;
  diary: VisitDiary;
  onChange: (next: VisitDiary, opts?: { keepText?: boolean }) => void;
  templates: DiaryTemplate[];
  extras: DiaryExtras;
  onAddExtra: (bucket: keyof DiaryExtras, label: string) => void;
  onApplyTemplate?: (tpl: DiaryTemplate) => void;
  onSaveTemplate?: (name: string) => void;
  patientId?: string;
}) {
  const [tplName, setTplName] = useState("");
  const appointments = useClinic((s) => s.appointments);
  const stockItems = useClinic((s) => s.stockItems);

  function patch(partial: Partial<VisitDiary>) {
    const next = { ...diary, ...partial };
    const keys = Object.keys(partial);
    const onlyNext = keys.length > 0 && keys.every((k) =>
      k === "nextKind" || k === "nextDate" || k === "nextTime" || k === "nextDurationMin" || k === "nextNote",
    );
    if (onlyNext && diary.text.trim()) {
      onChange(next, { keepText: true });
      return;
    }
    onChange({ ...next, text: composeDiaryText(kind, next, extras, stockItems) });
  }

  function patchFinding(id: string, partial: Partial<VisitFinding>) {
    patch({
      findings: diary.findings.map((x) => (x.id === id ? { ...x, ...partial } : x)),
    });
  }

  const nextMine = appointments.find(
    (a) =>
      patientId &&
      a.patientId === patientId &&
      a.date === diary.nextDate &&
      a.start === diary.nextTime &&
      isBlocking(a.status),
  );
  const nextBusy =
    diary.nextKind !== "none" &&
    diary.nextDate &&
    diary.nextTime &&
    slotTaken(appointments, diary.nextDate, diary.nextTime, diary.nextDurationMin || 30, nextMine?.id);

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <Field label="Тип приёма">
        <div className="flex flex-wrap gap-1.5">
          {VISIT_KIND_ORDER.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => onKind(k)}
              className={`rounded-full px-3 py-1.5 text-[13px] ${kind === k ? "bg-primary text-primary-fg" : "bg-surface-2"}`}
            >
              {VISIT_KIND_LABEL[k]}
            </button>
          ))}
        </div>
      </Field>

      {templates.length ? (
        <Field label="Шаблон">
          <Select
            value=""
            onChange={(e) => {
              const tpl = templates.find((t) => t.id === e.target.value);
              if (tpl) onApplyTemplate?.(tpl);
            }}
          >
            <option value="">Выбрать шаблон…</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}

      <section className="min-w-0 rounded-lg bg-bg p-3">
        <p className="mb-2 text-[13px] font-bold text-ink">Жалобы</p>
        <ChipGroup
          options={COMPLAINT_OPTIONS}
          extra={extras.complaints}
          value={diary.complaints}
          onChange={(complaints) => patch({ complaints })}
          onAdd={(l) => onAddExtra("complaints", l)}
        />
        <Textarea
          className="mt-2"
          rows={2}
          placeholder="Свой комментарий"
          value={diary.complaintsNote}
          onChange={(e) => patch({ complaintsNote: e.target.value })}
        />
      </section>

      <section className="rounded-lg bg-bg p-3">
        <p className="mb-2 text-[13px] font-bold text-ink">Анамнез</p>
        <ChipGroup
          options={ANAMNESIS_OPTIONS}
          extra={extras.anamnesis}
          value={diary.anamnesis}
          onChange={(anamnesis) => patch({ anamnesis })}
          onAdd={(l) => onAddExtra("anamnesis", l)}
        />
        <Textarea
          className="mt-2"
          rows={2}
          placeholder="Свой комментарий"
          value={diary.anamnesisNote}
          onChange={(e) => patch({ anamnesisNote: e.target.value })}
        />
      </section>

      <section className="rounded-lg bg-bg p-3">
        <p className="mb-2 text-[13px] font-bold text-ink">Объективно</p>
        <ChipGroup
          options={EXAM_OPTIONS}
          extra={extras.exam}
          value={diary.exam}
          onChange={(exam) => patch({ exam })}
          onAdd={(l) => onAddExtra("exam", l)}
        />
        <Textarea
          className="mt-2"
          rows={2}
          placeholder="Свой комментарий"
          value={diary.examNote}
          onChange={(e) => patch({ examNote: e.target.value })}
        />
      </section>

      <section className="min-w-0 rounded-lg bg-bg p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-[13px] font-bold text-ink">Диагноз</p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => patch({ findings: [...diary.findings, emptyFinding()] })}
          >
            <Plus className="size-3.5" />
            Зуб
          </Button>
        </div>
        {diary.findings.length === 0 ? (
          <p className="text-sm text-muted">Добавьте зуб — диагноз попадёт в статистику и отделится от лечения.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {diary.findings.map((f) => (
              <li key={f.id} className="min-w-0 rounded-md bg-surface p-3">
                <div className="flex min-w-0 items-start gap-2">
                  <Select
                    className="w-[5.5rem] shrink-0"
                    value={f.toothFdi?.toString() ?? ""}
                    onChange={(e) =>
                      patchFinding(f.id, { toothFdi: e.target.value ? Number(e.target.value) : undefined })
                    }
                  >
                    <option value="">Зуб</option>
                    <ToothFdiOptions />
                  </Select>
                  <button
                    type="button"
                    className="ml-auto grid size-11 shrink-0 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-danger"
                    onClick={() => patch({ findings: diary.findings.filter((x) => x.id !== f.id) })}
                    aria-label="Удалить зуб"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
                <DiagnosisField
                  className="mt-2 min-w-0"
                  diagnosisId={f.diagnosisId}
                  diagnosisText={f.diagnosisText}
                  toothFdi={f.toothFdi}
                  complaints={diary.complaintsNote}
                  exam={f.examNote || diary.examNote}
                  onChange={({ diagnosisId, diagnosisText }) =>
                    patchFinding(f.id, { diagnosisId, diagnosisText })
                  }
                />
                {f.toothFdi ? (
                  <div className="mt-2 min-w-0">
                    <p className="mb-1 text-[13px] font-bold text-ink">Осмотр {f.toothFdi} зуба</p>
                    <ChipGroup
                      options={TOOTH_EXAM_OPTIONS}
                      value={f.examChips ?? []}
                      onChange={(examChips) => patchFinding(f.id, { examChips })}
                    />
                    <Input
                      className="mt-2"
                      value={f.examNote}
                      placeholder="Локализация, глубина — свой комментарий"
                      onChange={(e) => patchFinding(f.id, { examNote: e.target.value })}
                    />
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="min-w-0 rounded-lg bg-bg p-3">
        <p className="mb-2 text-[13px] font-bold text-ink">Лечение</p>
        {diary.findings.length === 0 ? (
          <p className="text-sm text-muted">
            Сначала укажите зуб в блоке «Диагноз» — лечение пишется отдельно по каждому зубу.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {diary.findings.map((f) => (
              <li key={f.id} className="min-w-0 rounded-md bg-surface p-3">
                <p className="mb-2 text-[13px] font-medium text-ink">
                  {f.toothFdi ? `Зуб ${f.toothFdi}` : "Зуб не указан"}
                  {f.diagnosisText.trim() ? (
                    <span className="font-normal text-muted"> · {f.diagnosisText.trim()}</span>
                  ) : null}
                </p>
                <p className="mb-1 text-[13px] font-bold text-ink">Проведённое лечение</p>
                <ChipGroup
                  options={TREATMENT_OPTIONS}
                  extra={extras.treatments}
                  value={f.treatments}
                  onChange={(treatments) => patchFinding(f.id, { treatments })}
                  onAdd={(l) => onAddExtra("treatments", l)}
                />
                <Textarea
                  className="mt-2"
                  rows={2}
                  placeholder="Комментарий к лечению"
                  value={f.treatmentNote}
                  onChange={(e) => patchFinding(f.id, { treatmentNote: e.target.value })}
                />
                <p className="mt-2 mb-1 text-[13px] font-bold text-ink">Материалы</p>
                <MaterialPicker
                  value={f.materialIds ?? []}
                  onChange={(materialIds) => patchFinding(f.id, { materialIds })}
                />
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 min-w-0 border-t border-line pt-3">
          <p className="mb-1 text-[13px] font-bold text-ink">Материалы приёма</p>
          <MaterialPicker value={diary.materialIds ?? []} onChange={(materialIds) => patch({ materialIds })} />
        </div>
      </section>

      <Field label="Дополнительные исследования">
        <Input
          value={diary.extra}
          onChange={(e) => patch({ extra: e.target.value })}
          placeholder="Rg, ЭОД, ОПТГ…"
        />
      </Field>

      <section className="rounded-lg bg-bg p-3">
        <p className="mb-2 text-[13px] font-bold text-ink">Рекомендации</p>
        <ChipGroup
          options={RECOMMEND_OPTIONS}
          extra={extras.recommendations}
          value={diary.recommendations}
          onChange={(recommendations) => patch({ recommendations })}
          onAdd={(l) => onAddExtra("recommendations", l)}
        />
        <Textarea
          className="mt-2"
          rows={2}
          value={diary.recommendationsNote}
          onChange={(e) => patch({ recommendationsNote: e.target.value })}
        />
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Следующий приём">
          <Select
            value={diary.nextKind}
            onChange={(e) => patch({ nextKind: e.target.value as VisitDiary["nextKind"] })}
          >
            {NEXT_KIND_OPTIONS.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        {diary.nextKind !== "none" ? (
          <Field label="Дата">
            <Input type="date" value={diary.nextDate} onChange={(e) => patch({ nextDate: e.target.value })} />
          </Field>
        ) : (
          <div />
        )}
      </div>
      {diary.nextKind !== "none" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Время">
            <Input type="time" value={diary.nextTime || ""} onChange={(e) => patch({ nextTime: e.target.value })} />
          </Field>
          <Field label="Продолжительность">
            <Select
              value={String(diary.nextDurationMin || 30)}
              onChange={(e) => patch({ nextDurationMin: Number(e.target.value) || 30 })}
            >
              {[15, 30, 45, 60, 90].map((n) => (
                <option key={n} value={n}>
                  {n} мин
                </option>
              ))}
            </Select>
          </Field>
        </div>
      ) : null}
      {nextBusy ? (
        <p className="text-sm text-danger">На это время уже есть запись в расписании. Выберите другое время.</p>
      ) : null}
      <Input
        value={diary.nextNote}
        placeholder="Комментарий к следующему визиту"
        onChange={(e) => patch({ nextNote: e.target.value })}
      />

      <section className="rounded-lg bg-bg p-3">
        <p className="mb-2 text-[13px] font-bold text-ink">Собранный дневник</p>
        <div className="flex flex-col gap-3">
          {diarySections(kind, diary, extras, stockItems).map((s) => (
            <div key={s.title}>
              <p className="text-[13px] font-bold text-ink">{s.title}</p>
              <p className="whitespace-pre-wrap text-sm">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <Field label="Текст дневника — можно править">
        <Textarea
          rows={8}
          value={diary.text}
          onChange={(e) => onChange({ ...diary, text: e.target.value }, { keepText: true })}
        />
        <button
          type="button"
          className="mt-1 text-[12px] text-primary"
          onClick={() => onChange({ ...diary, text: composeDiaryText(kind, diary, extras, stockItems) })}
        >
          Собрать текст заново
        </button>
      </Field>

      {onSaveTemplate ? (
        <div className="flex gap-2">
          <Input
            value={tplName}
            onChange={(e) => setTplName(e.target.value)}
            placeholder="Название своего шаблона"
          />
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              if (!tplName.trim()) return;
              onSaveTemplate(tplName.trim());
              setTplName("");
            }}
          >
            Сохранить шаблон
          </Button>
        </div>
      ) : null}
    </div>
  );
}
