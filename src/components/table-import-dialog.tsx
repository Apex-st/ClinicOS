import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, Select } from "@/components/ui/field";
import { fullName } from "@/lib/format";
import {
  guessMapping,
  mapRows,
  parseTableFile,
  TABLE_FIELDS,
  type DupAction,
  type MappedPatient,
  type ParsedTable,
  type TableField,
} from "@/lib/table-import";
import { useClinic } from "@/lib/store";

export function TableImportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const patients = useClinic((s) => s.patients);
  const addPatient = useClinic((s) => s.addPatient);
  const updatePatient = useClinic((s) => s.updatePatient);
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<"source" | "map" | "done">("source");
  const [table, setTable] = useState<ParsedTable | null>(null);
  const [mapping, setMapping] = useState<TableField[]>([]);
  const [dupDefault, setDupDefault] = useState<DupAction>("skip");
  const [actions, setActions] = useState<Record<number, DupAction>>({});
  const [report, setReport] = useState<{ added: number; updated: number; skipped: number; errors: number } | null>(null);
  const [driveNote, setDriveNote] = useState(false);

  const mapped: MappedPatient[] = useMemo(() => {
    if (!table) return [];
    return mapRows(table, mapping, patients).filter((r) => r.draft.lastName.trim() || r.draft.phone.trim());
  }, [table, mapping, patients]);

  async function onFile(file: File | undefined) {
    if (!file) return;
    try {
      const parsed = await parseTableFile(file);
      if (!parsed.headers.length) {
        toast.error("В файле нет заголовков");
        return;
      }
      setTable(parsed);
      setMapping(guessMapping(parsed.headers));
      setActions({});
      setStep("map");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось прочитать таблицу");
    }
  }

  function apply() {
    if (!mapped.length) {
      toast.error("Нет строк с фамилией или телефоном");
      return;
    }
    let added = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;
    for (const row of mapped) {
      const action = row.duplicate ? (actions[row.sourceIndex] ?? dupDefault) : "create";
      try {
        if (action === "skip") {
          skipped += 1;
          continue;
        }
        if (action === "update" && row.duplicate) {
          updatePatient(row.duplicate.id, {
            ...row.draft,
            lastName: row.draft.lastName || row.duplicate.lastName,
            firstName: row.draft.firstName || row.duplicate.firstName,
            phone: row.draft.phone || row.duplicate.phone,
          });
          updated += 1;
        } else {
          addPatient(row.draft);
          added += 1;
        }
      } catch {
        errors += 1;
      }
    }
    setReport({ added, updated, skipped, errors });
    setStep("done");
  }

  function close() {
    onOpenChange(false);
    setStep("source");
    setTable(null);
    setReport(null);
    setDriveNote(false);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Импорт из таблицы</DialogTitle>
          <DialogDescription>CSV или Excel. Совпадения по ФИО и телефону не создаются молча.</DialogDescription>
        </DialogHeader>

        {step === "source" ? (
          <div className="flex flex-col gap-3">
            <Button type="button" onClick={() => fileRef.current?.click()}>
              Файл с компьютера (CSV / XLSX)
            </Button>
            <Button type="button" variant="secondary" onClick={() => setDriveNote((v) => !v)}>
              Google Drive / Google Таблицы
            </Button>
            {driveNote ? (
              <p className="rounded-md bg-bg px-3 py-2 text-sm">
                Прямой вход в Google Диск здесь не подключён: нужны проект в Google Cloud, OAuth Client ID и API key
                (Drive API + Picker). Пароль Google программа не запрашивает и не хранит. Скачайте таблицу из Диска как
                CSV или XLSX и откройте её кнопкой «Файл с компьютера».
              </p>
            ) : null}
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt,.xlsx,.xlsm,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                void onFile(f);
              }}
            />
          </div>
        ) : null}

        {step === "map" && table ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted">
              {table.source.toUpperCase()} · {table.rows.length} строк · {table.headers.length} столбцов
            </p>
            <div className="max-h-40 overflow-auto rounded-md bg-bg">
              <table className="w-full text-left text-[12px]">
                <thead>
                  <tr>
                    {table.headers.map((h, i) => (
                      <th key={i} className="px-2 py-1 font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {table.rows.slice(0, 6).map((r, i) => (
                    <tr key={i} className="border-t border-line">
                      {table.headers.map((_, j) => (
                        <td key={j} className="truncate px-2 py-1">
                          {r[j]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[13px] font-medium">Сопоставление столбцов</p>
            <ul className="flex max-h-48 flex-col gap-1 overflow-y-auto">
              {table.headers.map((h, i) => (
                <li key={i} className="grid grid-cols-2 items-center gap-2 text-sm">
                  <span className="truncate">{h}</span>
                  <Select
                    value={mapping[i] ?? "skip"}
                    onChange={(e) =>
                      setMapping((cur) => {
                        const next = [...cur];
                        next[i] = e.target.value as TableField;
                        return next;
                      })
                    }
                  >
                    {TABLE_FIELDS.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.label}
                      </option>
                    ))}
                  </Select>
                </li>
              ))}
            </ul>
            <Field label="Если пациент уже есть">
              <Select value={dupDefault} onChange={(e) => setDupDefault(e.target.value as DupAction)}>
                <option value="skip">Пропустить</option>
                <option value="update">Обновить карточку</option>
                <option value="create">Создать ещё одну</option>
              </Select>
            </Field>
            {mapped.filter((m) => m.duplicate).length ? (
              <p className="text-sm text-muted">
                Возможных совпадений: {mapped.filter((m) => m.duplicate).length}. Для них действует правило выше.
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setStep("source")}>
                Назад
              </Button>
              <Button type="button" onClick={apply}>
                Импортировать ({mapped.length})
              </Button>
            </div>
          </div>
        ) : null}

        {step === "done" && report ? (
          <div className="flex flex-col gap-3">
            <ul className="text-sm">
              <li>Импортировано новых: {report.added}</li>
              <li>Обновлено: {report.updated}</li>
              <li>Пропущено: {report.skipped}</li>
              <li>Ошибки строк: {report.errors}</li>
            </ul>
            <div className="flex justify-end">
              <Button type="button" onClick={close}>
                Закрыть
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
