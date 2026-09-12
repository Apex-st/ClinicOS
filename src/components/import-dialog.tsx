import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, Select } from "@/components/ui/field";
import { dataUrlToBlob, putPhotoBlob } from "@/lib/photos-idb";
import {
  CONFLICT_LABEL,
  EXPORT_SECTIONS,
  mergeExport,
  patientConflicts,
  type ConflictAction,
  type DentaExport,
  type ExportSectionId,
  type ImportPreview,
} from "@/lib/export-data";
import { fullName } from "@/lib/format";
import { useClinic } from "@/lib/store";

export function ImportDialog({
  preview,
  onOpenChange,
}: {
  preview: ImportPreview | null;
  onOpenChange: (open: boolean) => void;
}) {
  const importSnapshot = useClinic((s) => s.importSnapshot);
  const current = useClinic.getState();
  const conflicts = useMemo(
    () => (preview ? patientConflicts(current, preview.file) : []),
    [preview],
  );
  const [replaceAll, setReplaceAll] = useState(false);
  const [defaultAction, setDefaultAction] = useState<ConflictAction>("skip");
  const [patientActions, setPatientActions] = useState<Record<string, ConflictAction>>({});
  const [busy, setBusy] = useState(false);
  const [sections, setSections] = useState<ExportSectionId[]>(preview?.file.sections ?? []);

  const file = preview?.file;

  function toggle(id: ExportSectionId) {
    setSections((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  async function apply(incoming: DentaExport) {
    if (sections.length === 0) {
      toast.error("Выберите хотя бы один раздел");
      return;
    }
    setBusy(true);
    try {
      const state = useClinic.getState();
      const merged = mergeExport(state, incoming, {
        replaceAll,
        defaultAction,
        patientActions,
        sections,
      });
      importSnapshot(merged.data);
      const blobMap = incoming.photoBlobs ?? {};
      for (const [oldId, blob] of Object.entries(blobMap)) {
        const nid = merged.photoIdMap[oldId] ?? (replaceAll ? oldId : undefined);
        if (!nid) continue;
        await putPhotoBlob(nid, blob);
      }
      for (const [oldId, dataUrl] of Object.entries(incoming.photoFiles ?? {})) {
        if (blobMap[oldId]) continue;
        const nid = merged.photoIdMap[oldId] ?? (replaceAll ? oldId : undefined);
        if (!nid) continue;
        await putPhotoBlob(nid, dataUrlToBlob(dataUrl));
      }
      toast.success("Импорт выполнен. Данные не заменялись молча — выбранные правила применены.");
      onOpenChange(false);
    } catch {
      toast.error("Не удалось применить файл");
    } finally {
      setBusy(false);
    }
  }

  if (!preview || !file) return null;

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Импорт данных</DialogTitle>
          <DialogDescription>
            Версия файла {file.version}
            {file.appVersion ? ` · ClinicOS ${file.appVersion}` : ""}. Ничего не записывается, пока не нажмёте
            «Импортировать».
          </DialogDescription>
        </DialogHeader>

        {preview.warnings.length ? (
          <ul className="rounded-md bg-warn/10 px-3 py-2 text-[13px] text-warn">
            {preview.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        ) : null}

        <div>
          <p className="text-[13px] font-medium">Что будет импортировано</p>
          <ul className="mt-2 flex flex-col gap-1">
            {EXPORT_SECTIONS.filter((s) => file.sections.includes(s.id) || preview.counts[s.id]).map((s) => (
              <label key={s.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="flex items-center gap-2">
                  <input type="checkbox" checked={sections.includes(s.id)} onChange={() => toggle(s.id)} />
                  {s.label}
                </span>
                <span className="tabular-nums text-muted">{preview.counts[s.id] ?? 0}</span>
              </label>
            ))}
          </ul>
        </div>

        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={replaceAll} onChange={(e) => setReplaceAll(e.target.checked)} />
          <span>
            Заменить выбранные разделы целиком.
            <span className="block text-[13px] text-muted">Без этой галочки совпадения разбираются по правилам ниже. Автослияния нет.</span>
          </span>
        </label>

        {!replaceAll ? (
          <>
            <Field label="Совпадения ID (кроме пациентов ниже)">
              <Select value={defaultAction} onChange={(e) => setDefaultAction(e.target.value as ConflictAction)}>
                {Object.entries(CONFLICT_LABEL).map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </Select>
            </Field>
            {conflicts.length > 0 ? (
              <div>
                <p className="text-[13px] font-medium">Уже есть пациент с таким ID</p>
                <ul className="mt-2 flex max-h-48 flex-col gap-2 overflow-y-auto">
                  {conflicts.map((p) => {
                    const mine = current.patients.find((x) => x.id === p.id);
                    const action = patientActions[p.id] ?? defaultAction;
                    return (
                      <li key={p.id} className="rounded-md bg-bg px-3 py-2 text-sm">
                        <p className="font-medium">{fullName(p)}</p>
                        <p className="text-[12px] text-muted">
                          В файле: {p.cardNumber || "без карты"}
                          {mine ? ` · сейчас: ${fullName(mine)}` : ""}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {(["skip", "as_new", "replace"] as const).map((a) => (
                            <button
                              key={a}
                              type="button"
                              className={`rounded-full px-2.5 py-1 text-[12px] ${action === a ? "bg-primary text-primary-fg" : "bg-surface-2"}`}
                              onClick={() => setPatientActions((cur) => ({ ...cur, [p.id]: a }))}
                            >
                              {CONFLICT_LABEL[a]}
                            </button>
                          ))}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : (
              <p className="text-[13px] text-muted">Совпадений ID пациентов нет — карточки добавятся как новые.</p>
            )}
          </>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button type="button" disabled={busy} onClick={() => void apply(file)}>
            {busy ? "Пишу…" : "Импортировать"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
