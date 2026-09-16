import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { FolderPickSheet } from "@/components/folder-pick-sheet";
import { enableEncryption, finishSignIn, signInWithPassword } from "@/lib/encryption";
import { maybePersistAutoUnlock } from "@/lib/crypto-session";
import { hashPassword, randomSalt } from "@/lib/passwords";
import { useSession } from "@/lib/session";
import { DOCTOR_ROLES, hasPasswordAccount } from "@/lib/staff";
import { shortName } from "@/lib/format";
import { useClinic } from "@/lib/store";
import { connectFolder, drivePickStrategy, openCabinetFromFolder } from "@/lib/clinic-sync";
import { isCancelError } from "@/lib/sync-folder-parse";
import type { DoctorRole } from "@/lib/types";

export function FirstRunSetup() {
  const doctors = useClinic((s) => s.doctors);
  const settings = useClinic((s) => s.settings);
  const addDoctor = useClinic((s) => s.addDoctor);
  const updateDoctor = useClinic((s) => s.updateDoctor);
  const updateSettings = useClinic((s) => s.updateSettings);
  const login = useSession((s) => s.login);
  const canSignIn = hasPasswordAccount(doctors);
  const [mode, setMode] = useState<"create" | "login" | "folder">(canSignIn ? "login" : "create");
  const [clinicName, setClinicName] = useState(settings.clinicName || "ClinicOS");
  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [specialty, setSpecialty] = useState("Стоматолог");
  const [role, setRole] = useState<DoctorRole>("chief");
  const [loginName, setLoginName] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [busy, setBusy] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);

  async function submitLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!loginName.trim() || !password) {
      toast.error("Укажите логин и пароль");
      return;
    }
    setBusy(true);
    try {
      const result = await signInWithPassword(loginName, password);
      if ("fail" in result) {
        if (result.fail === "no-wrap") {
          toast.error("Этот профиль ещё не привязан к шифрованию. Создайте профиль заново или попросите задать пароль.");
          return;
        }
        if (result.fail === "no-crypto") {
          toast.error("Шифрование недоступно в этом браузере");
          return;
        }
        toast.error("Неверный логин или пароль");
        return;
      }
      const ok = await finishSignIn(result.doctorId);
      if (!ok) {
        toast.error("Не удалось открыть кабинет");
        return;
      }
      login(result.doctorId);
      maybePersistAutoUnlock();
    } finally {
      setBusy(false);
    }
  }

  function startPickFolder() {
    if (drivePickStrategy() === "sheet") {
      setSheetOpen(true);
      return;
    }
    void pickFolder();
  }

  async function pickFolder() {
    setBusy(true);
    try {
      const r = await connectFolder("drive");
      setFolderName(r.folderName);
      if (r.status === "empty") {
        toast.error("В папке нет файла кабинета. Сначала подключите её там, где кабинет уже ведётся.");
      }
    } catch (err) {
      if (isCancelError(err)) return;
      const msg = String((err as { message?: string })?.message || err);
      if (msg.includes("need-sheet") || msg.includes("picker-unavailable")) {
        setSheetOpen(true);
        return;
      }
      toast.error("Не удалось открыть папку");
    } finally {
      setBusy(false);
    }
  }

  async function submitFolder(e: React.FormEvent) {
    e.preventDefault();
    if (!password) {
      toast.error("Введите пароль врача из того кабинета");
      return;
    }
    setBusy(true);
    try {
      const result = await openCabinetFromFolder(password);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (result.doctorId) login(result.doctorId);
      maybePersistAutoUnlock();
      toast.success("Кабинет открыт из папки");
    } finally {
      setBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!lastName.trim() || !firstName.trim()) {
      toast.error("Укажите фамилию и имя");
      return;
    }
    if (!loginName.trim() || password.length < 4) {
      toast.error("Логин и пароль от 4 символов");
      return;
    }
    if (password !== password2) {
      toast.error("Пароли не совпадают");
      return;
    }
    setBusy(true);
    try {
      const salt = randomSalt();
      const passwordHash = await hashPassword(password, salt);
      const patch = {
        lastName: lastName.trim(),
        firstName: firstName.trim(),
        middleName: middleName.trim(),
        specialty: specialty.trim() || "Стоматолог",
        login: loginName.trim(),
        passwordHash,
        passwordSalt: salt,
        role,
        active: true as const,
      };
      const vacant = doctors.find((d) => !d.passwordHash);
      let id = vacant?.id;
      if (vacant) {
        updateDoctor(vacant.id, patch);
      } else {
        id = addDoctor({ ...patch, color: "#1f5c52", sharePercent: 40 });
      }
      if (!id) {
        toast.error("Не удалось сохранить профиль");
        return;
      }
      const name = clinicName.trim() || "ClinicOS";
      updateSettings({
        clinicName: name,
        doctorName: shortName(patch),
        requireLogin: true,
      });
      try {
        await enableEncryption({
          doctorId: id,
          login: patch.login,
          password,
          clinicName: name,
          welcomeName: shortName(patch),
        });
      } catch {
        toast.error("Не удалось включить шифрование данных");
        return;
      }
      login(id);
    } finally {
      setBusy(false);
    }
  }

  const links = (
    <div className="mt-4 flex flex-col gap-2">
      {mode !== "folder" ? (
        <button
          type="button"
          className="text-center text-sm text-muted hover:text-ink"
          onClick={() => {
            setMode("folder");
            setPassword("");
          }}
        >
          Открыть кабинет из папки Диска
        </button>
      ) : null}
      {mode !== "create" ? (
        <button
          type="button"
          className="text-center text-sm text-muted hover:text-ink"
          onClick={() => {
            setMode("create");
            setPassword("");
            setPassword2("");
          }}
        >
          Создать новый профиль
        </button>
      ) : null}
      {mode !== "login" ? (
        <button
          type="button"
          className="text-center text-sm text-muted hover:text-ink"
          onClick={() => {
            setMode("login");
            setPassword("");
          }}
        >
          У меня уже есть аккаунт
        </button>
      ) : null}
    </div>
  );

  return (
    <div className="grid min-h-dvh place-items-center bg-bg px-4 py-8">
      {mode === "login" ? (
        <form
          onSubmit={(e) => void submitLogin(e)}
          className="w-full max-w-md rounded-xl bg-surface p-6 shadow-[var(--shadow-lift)]"
        >
          <p className="font-display text-3xl text-ink">ClinicOS</p>
          <h1 className="mt-2 font-display text-xl">Вход в кабинет</h1>
          <p className="mt-1 text-sm text-muted">
            Войдите в уже созданный профиль. Карточки не сбрасываются.
          </p>
          <div className="mt-5 flex flex-col gap-3">
            <Field label="Логин">
              <Input autoComplete="username" value={loginName} onChange={(e) => setLoginName(e.target.value)} autoFocus />
            </Field>
            <Field label="Пароль">
              <Input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            <Button type="submit" disabled={busy || !loginName || !password}>
              {busy ? "Проверка…" : "Войти"}
            </Button>
            {links}
          </div>
        </form>
      ) : mode === "folder" ? (
        <form
          onSubmit={(e) => void submitFolder(e)}
          className="w-full max-w-md rounded-xl bg-surface p-6 shadow-[var(--shadow-lift)]"
        >
          <p className="font-display text-3xl text-ink">ClinicOS</p>
          <h1 className="mt-2 font-display text-xl">Кабинет из папки</h1>
          <p className="mt-1 text-sm text-muted">
            Выберите ту же папку Google Диска, к которой вам открыли доступ. Файл зашифрован — нужен пароль врача.
          </p>
          <div className="mt-5 flex flex-col gap-3">
            <Button type="button" variant="outline" disabled={busy} onClick={startPickFolder}>
              {folderName ? `Папка: ${folderName}` : "Выбрать папку Диска"}
            </Button>
            <p className="text-[12px] text-muted">
              Откроется выбор папки. Если браузер его не показывает — укажите файл ClinicOS-cabinet.denta.
            </p>
            <Field label="Пароль или ключ восстановления">
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
              />
            </Field>
            <Button type="submit" disabled={busy || !password}>
              {busy ? "Открываю…" : "Открыть кабинет"}
            </Button>
            {links}
          </div>
        </form>
      ) : (
      <form
        onSubmit={(e) => void submit(e)}
        className="w-full max-w-md rounded-xl bg-surface p-6 shadow-[var(--shadow-lift)]"
      >
        <p className="font-display text-3xl text-ink">ClinicOS</p>
        <h1 className="mt-2 font-display text-xl">Первый вход</h1>
        <p className="mt-1 text-sm text-muted">
          Создайте свой профиль. Дальше кабинет открывается по логину и паролю, карточки и снимки шифруются на этом
          устройстве. Главный врач и администратор могут заводить остальных.
        </p>
        <div className="mt-5 flex flex-col gap-3">
          <Field label="Название кабинета">
            <Input value={clinicName} onChange={(e) => setClinicName(e.target.value)} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Фамилия">
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} autoFocus />
            </Field>
            <Field label="Имя">
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </Field>
          </div>
          <Field label="Отчество">
            <Input value={middleName} onChange={(e) => setMiddleName(e.target.value)} />
          </Field>
          <Field label="Специальность">
            <Input value={specialty} onChange={(e) => setSpecialty(e.target.value)} />
          </Field>
          <Field label="Роль">
            <Select value={role} onChange={(e) => setRole(e.target.value as DoctorRole)}>
              {DOCTOR_ROLES.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </Select>
            <p className="mt-1 text-[12px] text-muted">{DOCTOR_ROLES.find((r) => r.id === role)?.hint}</p>
          </Field>
          <Field label="Логин">
            <Input autoComplete="username" value={loginName} onChange={(e) => setLoginName(e.target.value)} />
          </Field>
          <Field label="Пароль">
            <Input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <Field label="Пароль ещё раз">
            <Input
              type="password"
              autoComplete="new-password"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
            />
          </Field>
          <Button type="submit" disabled={busy}>
            {busy ? "Сохраняю…" : "Создать профиль и войти"}
          </Button>
          {links}
        </div>
      </form>
      )}
      <FolderPickSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        allowOpfs={false}
        onResult={(r) => {
          setFolderName(r.folderName);
          if (r.status === "empty") {
            toast.error("В папке нет файла кабинета. Сначала подключите её там, где кабинет уже ведётся.");
          }
        }}
      />
    </div>
  );
}
