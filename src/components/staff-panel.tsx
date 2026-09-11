import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, Select } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { fullName } from "@/lib/format";
import { hashPassword, randomSalt } from "@/lib/passwords";
import { useSession } from "@/lib/session";
import { useClinic } from "@/lib/store";
import type { Doctor, DoctorRole } from "@/lib/types";

const COLORS = ["#1f5c52", "#8f4a32", "#3d6b8a", "#6b4f8a", "#4a6b3d", "#8a5a2b"];

export function StaffPanel() {
  const doctors = useClinic((s) => s.doctors);
  const settings = useClinic((s) => s.settings);
  const addDoctor = useClinic((s) => s.addDoctor);
  const updateDoctor = useClinic((s) => s.updateDoctor);
  const deleteDoctor = useClinic((s) => s.deleteDoctor);
  const updateSettings = useClinic((s) => s.updateSettings);
  const sessionId = useSession((s) => s.doctorId);
  const [askId, setAskId] = useState<string | null>(null);
  const [form, setForm] = useState({
    lastName: "",
    firstName: "",
    middleName: "",
    specialty: "Терапевт",
    login: "",
    password: "",
    role: "doctor" as DoctorRole,
    color: COLORS[1],
    sharePercent: 40,
  });

  const withPassword = doctors.filter((d) => d.active && d.passwordHash);

  async function create() {
    if (!form.lastName.trim() || !form.firstName.trim()) {
      toast.error("Укажите фамилию и имя");
      return;
    }
    if (!form.login.trim() || form.password.length < 4) {
      toast.error("Логин и пароль от 4 символов");
      return;
    }
    if (doctors.some((d) => d.login.toLowerCase() === form.login.trim().toLowerCase())) {
      toast.error("Такой логин уже есть");
      return;
    }
    const salt = randomSalt();
    const passwordHash = await hashPassword(form.password, salt);
    addDoctor({
      lastName: form.lastName.trim(),
      firstName: form.firstName.trim(),
      middleName: form.middleName.trim(),
      specialty: form.specialty.trim() || "Стоматолог",
      color: form.color,
      login: form.login.trim(),
      passwordHash,
      passwordSalt: salt,
      role: form.role,
      active: true,
      sharePercent: form.sharePercent,
    });
    toast.success("Аккаунт врача создан");
    setForm({
      lastName: "",
      firstName: "",
      middleName: "",
      specialty: "Терапевт",
      login: "",
      password: "",
      role: "doctor",
      color: COLORS[(doctors.length + 1) % COLORS.length],
      sharePercent: 40,
    });
  }

  async function setPass(id: string, password: string) {
    if (password.length < 4) {
      toast.error("Пароль от 4 символов");
      return;
    }
    const salt = randomSalt();
    const passwordHash = await hashPassword(password, salt);
    updateDoctor(id, { passwordHash, passwordSalt: salt });
    toast.success("Пароль сохранён");
  }

  function toggleLock(on: boolean) {
    if (on && withPassword.length === 0) {
      toast.error("Сначала задайте пароль хотя бы одному врачу");
      return;
    }
    updateSettings({ requireLogin: on });
    toast.success(on ? "Вход по паролю включён" : "Защита выключена");
  }

  return (
    <section className="rounded-xl bg-surface p-5 shadow-[var(--shadow-card)]">
      <h2 className="font-display text-lg">Врачи и вход</h2>
      <p className="mt-1 text-sm text-muted">
        Аккаунты хранятся в программе. Пока защита выключена, кабинет открывается сразу — так удобно настроить пароли.
      </p>

      <label className="mt-4 flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={settings.requireLogin}
          onChange={(e) => toggleLock(e.target.checked)}
        />
        Требовать логин и пароль при открытии
      </label>

      <ul className="mt-5 flex flex-col gap-3">
        {doctors.map((d) => (
          <DoctorRow
            key={d.id}
            d={d}
            current={sessionId === d.id}
            canDelete={doctors.length > 1}
            others={doctors}
            onUpdate={(patch) => updateDoctor(d.id, patch)}
            onPassword={(pwd) => void setPass(d.id, pwd)}
            onDelete={() => setAskId(d.id)}
          />
        ))}
      </ul>

      <div className="mt-6 border-t border-line pt-4">
        <h3 className="font-medium">Новый врач</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Field label="Фамилия">
            <Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
          </Field>
          <Field label="Имя">
            <Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
          </Field>
          <Field label="Отчество">
            <Input value={form.middleName} onChange={(e) => setForm({ ...form, middleName: e.target.value })} />
          </Field>
          <Field label="Специальность">
            <Input value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })} />
          </Field>
          <Field label="Логин">
            <Input value={form.login} onChange={(e) => setForm({ ...form, login: e.target.value })} />
          </Field>
          <Field label="Пароль">
            <Input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </Field>
          <Field label="Роль">
            <Select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as DoctorRole })}
            >
              <option value="doctor">Врач</option>
              <option value="admin">Администратор</option>
            </Select>
          </Field>
          <Field label="Процент от кассы">
            <Input
              type="number"
              min={0}
              max={100}
              value={form.sharePercent}
              onChange={(e) =>
                setForm({ ...form, sharePercent: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })
              }
            />
          </Field>
          <Field label="Цвет в расписании">
            <div className="flex h-11 items-center gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm({ ...form, color: c })}
                  className="size-7 rounded-full"
                  style={{
                    background: c,
                    boxShadow: form.color === c ? "0 0 0 2px var(--color-ink)" : undefined,
                  }}
                  aria-label={c}
                />
              ))}
            </div>
          </Field>
        </div>
        <Button className="mt-4" type="button" onClick={() => void create()}>
          <Plus className="size-4" />
          Создать аккаунт
        </Button>
      </div>

      <ConfirmDialog
        open={Boolean(askId)}
        onOpenChange={(o) => !o && setAskId(null)}
        title="Удалить врача?"
        description="Записи на него останутся, но выбрать его больше нельзя."
        onConfirm={() => {
          if (askId) deleteDoctor(askId);
          setAskId(null);
        }}
      />
    </section>
  );
}

function DoctorRow({
  d,
  current,
  canDelete,
  others,
  onUpdate,
  onPassword,
  onDelete,
}: {
  d: Doctor;
  current: boolean;
  canDelete: boolean;
  others: Doctor[];
  onUpdate: (patch: Partial<Doctor>) => void;
  onPassword: (password: string) => void;
  onDelete: () => void;
}) {
  const [pwd, setPwd] = useState("");
  const [edit, setEdit] = useState(false);
  return (
    <li className="rounded-lg bg-bg px-3 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="size-3 shrink-0 rounded-full" style={{ background: d.color }} />
          <div className="min-w-0">
            <p className="truncate font-medium">{fullName(d)}</p>
            <p className="text-[12px] text-muted">
              {d.specialty} · {d.sharePercent ?? 40}% от кассы · логин {d.login}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {current ? <Badge tone="ok">в системе</Badge> : null}
          <Badge tone={d.role === "admin" ? "primary" : "muted"}>{d.role === "admin" ? "админ" : "врач"}</Badge>
          <Badge tone={d.passwordHash ? "ok" : "warn"}>{d.passwordHash ? "пароль задан" : "нет пароля"}</Badge>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="secondary" onClick={() => setEdit(true)}>
          Изменить профиль
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => onUpdate({ active: !d.active })}>
          {d.active ? "Выкл." : "Вкл."}
        </Button>
        {canDelete ? (
          <button type="button" className="grid size-11 place-items-center text-muted hover:text-danger" onClick={onDelete}>
            <Trash2 className="size-4" />
          </button>
        ) : null}
      </div>
      <DoctorEditDialog
        open={edit}
        doctor={d}
        others={others}
        password={pwd}
        onPasswordChange={setPwd}
        onOpenChange={setEdit}
        onSave={(patch) => {
          onUpdate(patch);
          if (pwd.trim()) {
            onPassword(pwd.trim());
            setPwd("");
          }
          toast.success("Профиль сохранён");
          setEdit(false);
        }}
      />
    </li>
  );
}

function DoctorEditDialog({
  open,
  doctor,
  others,
  password,
  onPasswordChange,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  doctor: Doctor;
  others: Doctor[];
  password: string;
  onPasswordChange: (v: string) => void;
  onOpenChange: (o: boolean) => void;
  onSave: (patch: Partial<Doctor>) => void;
}) {
  const [form, setForm] = useState({
    lastName: doctor.lastName,
    firstName: doctor.firstName,
    middleName: doctor.middleName,
    specialty: doctor.specialty,
    login: doctor.login,
    role: doctor.role,
    color: doctor.color,
    sharePercent: doctor.sharePercent ?? 40,
  });

  useEffect(() => {
    if (!open) return;
    setForm({
      lastName: doctor.lastName,
      firstName: doctor.firstName,
      middleName: doctor.middleName,
      specialty: doctor.specialty,
      login: doctor.login,
      role: doctor.role,
      color: doctor.color,
      sharePercent: doctor.sharePercent ?? 40,
    });
  }, [open, doctor]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent placement="sheet">
        <DialogHeader>
          <DialogTitle>Профиль врача</DialogTitle>
        </DialogHeader>
        <div className="grid min-w-0 gap-3">
          <Field label="Фамилия">
            <Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
          </Field>
          <Field label="Имя">
            <Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
          </Field>
          <Field label="Отчество">
            <Input value={form.middleName} onChange={(e) => setForm({ ...form, middleName: e.target.value })} />
          </Field>
          <Field label="Специальность">
            <Input value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })} />
          </Field>
          <Field label="Логин">
            <Input value={form.login} onChange={(e) => setForm({ ...form, login: e.target.value })} />
          </Field>
          <Field label="Новый пароль">
            <Input
              type="password"
              value={password}
              onChange={(e) => onPasswordChange(e.target.value)}
              placeholder="Оставьте пустым, чтобы не менять"
            />
          </Field>
          <Field label="Роль">
            <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as DoctorRole })}>
              <option value="doctor">Врач</option>
              <option value="admin">Администратор</option>
            </Select>
          </Field>
          <Field label="Процент от кассы">
            <Input
              type="number"
              min={0}
              max={100}
              value={form.sharePercent}
              onChange={(e) =>
                setForm({ ...form, sharePercent: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })
              }
            />
          </Field>
          <Field label="Цвет в расписании">
            <div className="flex h-11 flex-wrap items-center gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm({ ...form, color: c })}
                  className="size-7 rounded-full"
                  style={{
                    background: c,
                    boxShadow: form.color === c ? "0 0 0 2px var(--color-ink)" : undefined,
                  }}
                  aria-label={c}
                />
              ))}
            </div>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button
            type="button"
            onClick={() => {
              if (!form.lastName.trim() || !form.firstName.trim()) {
                toast.error("Укажите фамилию и имя");
                return;
              }
              if (!form.login.trim()) {
                toast.error("Укажите логин");
                return;
              }
              const taken = others.some(
                (x) => x.id !== doctor.id && x.login.toLowerCase() === form.login.trim().toLowerCase(),
              );
              if (taken) {
                toast.error("Такой логин уже есть");
                return;
              }
              onSave({
                lastName: form.lastName.trim(),
                firstName: form.firstName.trim(),
                middleName: form.middleName.trim(),
                specialty: form.specialty.trim() || "Стоматолог",
                login: form.login.trim(),
                role: form.role,
                color: form.color,
                sharePercent: form.sharePercent,
              });
            }}
          >
            Сохранить
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
