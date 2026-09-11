import { useMemo, useState } from "react";
import { Field, Select } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { applyDiagnosisTemplate, DIAGNOSIS_CATEGORIES, diagnosisLabel, findDiagnosis } from "@/lib/icd";
import { useClinic } from "@/lib/store";
import { cn } from "@/lib/utils";

export function DiagnosisField({
  diagnosisId,
  diagnosisText,
  toothFdi,
  complaints,
  exam,
  onChange,
  className,
}: {
  diagnosisId?: string;
  diagnosisText: string;
  toothFdi?: number;
  complaints?: string;
  exam?: string;
  onChange: (next: { diagnosisId: string; diagnosisText: string }) => void;
  className?: string;
}) {
  const diagnoses = useClinic((s) => s.diagnoses);
  const [q, setQ] = useState("");
  const current = findDiagnosis(diagnoses, diagnosisId);

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    const list = n
      ? diagnoses.filter((d) => `${d.displayName} ${d.code} ${d.description} ${d.name}`.toLowerCase().includes(n))
      : diagnoses;
    if (current && !list.some((d) => d.id === current.id)) return [current, ...list];
    return list;
  }, [diagnoses, q, current]);

  const grouped = useMemo(() => {
    return DIAGNOSIS_CATEGORIES.map((c) => ({
      ...c,
      items: filtered.filter((d) => (d.category || "other") === c.id),
    })).filter((c) => c.items.length);
  }, [filtered]);

  function pick(id: string) {
    if (!id) {
      onChange({ diagnosisId: "", diagnosisText });
      return;
    }
    const next = findDiagnosis(diagnoses, id);
    const autoPrev = current
      ? applyDiagnosisTemplate(current, { tooth: toothFdi, complaints, exam })
      : "";
    const wasAuto =
      !diagnosisText.trim() ||
      (current != null &&
        (diagnosisText.trim() === autoPrev.trim() || diagnosisText.trim() === diagnosisLabel(current)));
    const text =
      next && wasAuto
        ? applyDiagnosisTemplate(next, { tooth: toothFdi, complaints, exam })
        : diagnosisText;
    onChange({ diagnosisId: id, diagnosisText: text });
  }

  return (
    <Field label="Диагноз" className={cn(className)}>
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Поиск диагноза, код МКБ…"
      />
      <Select
        className="mt-1"
        value={current?.id ?? diagnosisId ?? ""}
        onChange={(e) => pick(e.target.value)}
      >
        <option value="">Диагноз из справочника</option>
        {grouped.map((c) => (
          <optgroup key={c.id} label={c.name}>
            {c.items.map((d) => (
              <option key={d.id} value={d.id}>
                {diagnosisLabel(d)}
              </option>
            ))}
          </optgroup>
        ))}
      </Select>
      <Textarea
        className="mt-1"
        rows={4}
        value={diagnosisText}
        onChange={(e) => onChange({ diagnosisId: diagnosisId ?? "", diagnosisText: e.target.value })}
        placeholder="Диагноз своими словами"
      />
    </Field>
  );
}
