import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DIAGNOSIS_CATEGORIES, diagnosisLabel } from "@/lib/icd";
import { MESSAGE_VARS, TEMPLATE_KIND_LABEL, TEMPLATE_KIND_ORDER } from "@/lib/messages";
import { useClinic } from "@/lib/store";
import { CHANGELOG } from "@/lib/changelog";
import { APP_BUILD_DATE, APP_VERSION, APP_VERSION_LABEL } from "@/lib/version";
import type { MessageTemplate } from "@/lib/types";

export function MessageTemplatesPanel() {
  const templates = useClinic((s) => s.messageTemplates);
  const addMessageTemplate = useClinic((s) => s.addMessageTemplate);
  const updateMessageTemplate = useClinic((s) => s.updateMessageTemplate);
  const deleteMessageTemplate = useClinic((s) => s.deleteMessageTemplate);
  const [id, setId] = useState(templates[0]?.id ?? "");
  const current = templates.find((t) => t.id === id) ?? templates[0];

  return (
    <section className="rounded-xl bg-surface p-5 shadow-[var(--shadow-card)]">
      <h2 className="font-display text-lg">Шаблоны сообщений</h2>
      <p className="mt-1 text-sm text-muted">
        Переменные подставляются перед отправкой. Сообщение всё равно можно править в окне «Отправить пациенту».
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {MESSAGE_VARS.map((v) => (
          <code key={v} className="rounded-md bg-bg px-2 py-1 text-[12px]">
            {v}
          </code>
        ))}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-[200px_minmax(0,1fr)]">
        <ul className="flex flex-col gap-1">
          {templates.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => setId(t.id)}
                className={`w-full rounded-md px-3 py-2 text-left text-sm ${current?.id === t.id ? "bg-primary text-primary-fg" : "bg-bg"}`}
              >
                {t.name}
              </button>
            </li>
          ))}
        </ul>
        {current ? (
          <div className="flex flex-col gap-3">
            <Field label="Название">
              <Input value={current.name} onChange={(e) => updateMessageTemplate(current.id, { name: e.target.value })} />
            </Field>
            <Field label="Тип">
              <Select
                value={current.kind}
                onChange={(e) => updateMessageTemplate(current.id, { kind: e.target.value as MessageTemplate["kind"] })}
              >
                {TEMPLATE_KIND_ORDER.map((k) => (
                  <option key={k} value={k}>
                    {TEMPLATE_KIND_LABEL[k]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Текст">
              <Textarea
                rows={5}
                value={current.body}
                onChange={(e) => updateMessageTemplate(current.id, { body: e.target.value })}
              />
            </Field>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  const nid = addMessageTemplate({
                    name: "Новый шаблон",
                    kind: "custom",
                    body: "Здравствуйте, {Имя пациента}! ",
                  });
                  setId(nid);
                }}
              >
                Новый
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="text-danger"
                onClick={() => {
                  deleteMessageTemplate(current.id);
                  toast.message("Шаблон удалён");
                }}
              >
                Удалить
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function NotifyRulesPanel() {
  const rules = useClinic((s) => s.notifyRules);
  const templates = useClinic((s) => s.messageTemplates);
  const updateNotifyRule = useClinic((s) => s.updateNotifyRule);
  return (
    <section className="rounded-xl bg-surface p-5 shadow-[var(--shadow-card)]">
      <h2 className="font-display text-lg">Уведомления</h2>
      <p className="mt-1 text-sm text-muted">
        Системные уведомления срабатывают только пока программа открыта. SMS, WhatsApp и почта не уходят с сервера —
        врач открывает «Отправить пациенту» и отправляет через телефон. Автоматической рассылки дня рождения и
        незавершённого лечения нет.
      </p>
      <ul className="mt-4 flex flex-col gap-3">
        {rules.map((r) => (
          <li key={r.id} className="rounded-lg bg-bg p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">{TEMPLATE_KIND_LABEL[r.kind]}</p>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={r.enabled}
                  onChange={(e) => updateNotifyRule(r.id, { enabled: e.target.checked })}
                />
                Вкл
              </label>
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              <Field label="Канал">
                <Select
                  value={r.channel}
                  onChange={(e) => updateNotifyRule(r.id, { channel: e.target.value as typeof r.channel })}
                >
                  <option value="system">Системное (шторка)</option>
                  <option value="sms">SMS (вручную)</option>
                  <option value="whatsapp">WhatsApp (вручную)</option>
                  <option value="email">Email (вручную)</option>
                </Select>
              </Field>
              <Field label="Шаблон">
                <Select value={r.templateId} onChange={(e) => updateNotifyRule(r.id, { templateId: e.target.value })}>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="За сколько минут">
                <Input
                  type="number"
                  min={0}
                  value={r.minutesBefore}
                  onChange={(e) => updateNotifyRule(r.id, { minutesBefore: Math.max(0, Number(e.target.value) || 0) })}
                />
              </Field>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function DiagnosesPanel() {
  const diagnoses = useClinic((s) => s.diagnoses);
  const addDiagnosis = useClinic((s) => s.addDiagnosis);
  const deleteDiagnosis = useClinic((s) => s.deleteDiagnosis);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [category, setCategory] = useState("therapy");
  const [template, setTemplate] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const updateDiagnosis = useClinic((s) => s.updateDiagnosis);
  const list = diagnoses.filter((d) => {
    if (cat && d.category !== cat) return false;
    if (!q.trim()) return true;
    const n = q.trim().toLowerCase();
    return `${d.displayName} ${d.code} ${d.description}`.toLowerCase().includes(n);
  });
  return (
    <section className="rounded-xl bg-surface p-5 shadow-[var(--shadow-card)]">
      <h2 className="font-display text-lg">Диагнозы МКБ-10</h2>
      <p className="mt-1 text-sm text-muted">
        Справочник K00–K14. Существующие записи дневника не переписываются. В плане лечения шаблон подставляет текст,
        врач может его изменить.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск по названию или коду" />
        <Select value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">Все категории</option>
          {DIAGNOSIS_CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>
      <ul className="mt-3 flex max-h-64 flex-col gap-1 overflow-y-auto">
        {list.map((d) => (
          <li key={d.id} className="flex items-center gap-2 rounded-md bg-bg px-3 py-2 text-sm">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{diagnosisLabel(d)}</p>
              <p className="truncate text-[12px] text-muted">{d.description}</p>
              {editId === d.id ? (
                <Textarea
                  className="mt-2"
                  rows={4}
                  value={d.template}
                  onChange={(e) => updateDiagnosis(d.id, { template: e.target.value })}
                />
              ) : null}
            </div>
            <button type="button" className="text-[12px] text-primary" onClick={() => setEditId(editId === d.id ? null : d.id)}>
              Шаблон
            </button>
            <button type="button" className="text-[12px] text-danger" onClick={() => deleteDiagnosis(d.id)}>
              Удалить
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Название" />
        <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Код, напр. K02.1" />
        <Select value={category} onChange={(e) => setCategory(e.target.value)}>
          {DIAGNOSIS_CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Textarea
          className="sm:col-span-3"
          rows={3}
          value={template}
          onChange={(e) => setTemplate(e.target.value)}
          placeholder="Шаблон: Зуб: {Зуб}&#10;Жалобы: {Жалобы}&#10;Диагноз: …"
        />
      </div>
      <Button
        type="button"
        variant="secondary"
        className="mt-2"
        onClick={() => {
          if (!name.trim()) return;
          addDiagnosis({
            name: name.trim().toLowerCase().replace(/\s+/g, "_"),
            displayName: name.trim(),
            code: code.trim(),
            description: name.trim(),
            category,
            template: template.trim(),
          });
          setName("");
          setCode("");
          setTemplate("");
          toast.success("Диагноз добавлен в справочник");
        }}
      >
        Добавить диагноз
      </Button>
    </section>
  );
}

export function TagsPanel() {
  const tags = useClinic((s) => s.tags);
  const addTag = useClinic((s) => s.addTag);
  const updateTag = useClinic((s) => s.updateTag);
  const deleteTag = useClinic((s) => s.deleteTag);
  const customSocials = useClinic((s) => s.customSocials);
  const addCustomSocial = useClinic((s) => s.addCustomSocial);
  const customMedical = useClinic((s) => s.customMedical);
  const addCustomMedical = useClinic((s) => s.addCustomMedical);
  const [tag, setTag] = useState("");
  const [social, setSocial] = useState("");
  const [med, setMed] = useState("");
  return (
    <section className="rounded-xl bg-surface p-5 shadow-[var(--shadow-card)]">
      <h2 className="font-display text-lg">Группы пациентов и списки</h2>
      <p className="mt-1 text-sm text-muted">Один пациент может быть в нескольких группах. Это теги, не папки.</p>
      <ul className="mt-3 flex flex-col gap-1">
        {tags.map((t) => (
          <li key={t.id} className="flex items-center gap-2">
            <Input value={t.name} onChange={(e) => updateTag(t.id, { name: e.target.value })} />
            <button type="button" className="text-[12px] text-danger" onClick={() => deleteTag(t.id)}>
              Удалить
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex gap-2">
        <Input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="Новая группа, например Учителя" />
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            if (!tag.trim()) return;
            addTag(tag.trim());
            setTag("");
          }}
        >
          Добавить
        </Button>
      </div>
      <p className="mt-4 text-[13px] font-medium">Социальные сети (источник)</p>
      <p className="text-[13px] text-muted">{["Instagram", "Telegram", "VK", "YouTube", ...customSocials].join(", ")}</p>
      <div className="mt-2 flex gap-2">
        <Input value={social} onChange={(e) => setSocial(e.target.value)} placeholder="Своя сеть" />
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            if (!social.trim()) return;
            addCustomSocial(social.trim());
            setSocial("");
          }}
        >
          Добавить
        </Button>
      </div>
      <p className="mt-4 text-[13px] font-medium">Доп. медицинские предупреждения</p>
      <p className="text-[13px] text-muted">
        {customMedical.length ? customMedical.map((m) => m.name).join(", ") : "Пока только стандартный список."}
      </p>
      <div className="mt-2 flex gap-2">
        <Input value={med} onChange={(e) => setMed(e.target.value)} placeholder="Например: кардиостимулятор" />
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            if (!med.trim()) return;
            addCustomMedical(med.trim());
            setMed("");
          }}
        >
          Добавить
        </Button>
      </div>
    </section>
  );
}

export function AboutPanel() {
  return (
    <section className="rounded-xl bg-surface p-5 shadow-[var(--shadow-card)]">
      <h2 className="font-display text-lg">О программе</h2>
      <dl className="mt-3 grid gap-2 text-sm">
        <div>
          <dt className="text-[12px] text-muted">Название</dt>
          <dd className="font-medium">Стоматологическая программа «Дента»</dd>
        </div>
        <div>
          <dt className="text-[12px] text-muted">Версия</dt>
          <dd className="font-medium">{APP_VERSION_LABEL}</dd>
        </div>
        <div>
          <dt className="text-[12px] text-muted">Дата сборки</dt>
          <dd className="font-medium">{APP_BUILD_DATE}</dd>
        </div>
      </dl>
      <p className="mt-4 max-w-prose text-sm text-muted">
        Данные хранятся на этом устройстве (карточки — в памяти программы, фото — отдельно). Сервера синхронизации нет.
        Копия кабинета — архив zip в «Настройки → Резервная копия». Живое соединение между копиями не имитируется.
        Автопроверки обновлений нет — новой версии ждут с новой сборки.
      </p>
      <p className="mt-2 max-w-prose text-[13px] text-muted">
        У записей есть уникальный ID, дата создания и дата изменения — это задел на будущую синхронизацию, когда появится
        сервер. Сейчас источником истины остаётся этот компьютер или телефон.
      </p>
      <p className="mt-3 text-[12px] text-subtle">Код версии: {APP_VERSION}</p>
      <div className="mt-6">
        <h3 className="font-display text-base">Список изменений</h3>
        <ol className="mt-3 flex flex-col gap-4">
          {CHANGELOG.map((entry) => (
            <li key={entry.version} className="rounded-lg bg-bg p-3">
              <p className="text-sm font-medium">
                {entry.version} · {entry.title}
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px] text-muted">
                {entry.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
