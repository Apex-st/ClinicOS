import { Camera, ImagePlus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { PhotoViewer } from "@/components/photo-viewer";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/field";
import { RadioChips } from "@/components/spec-ui";
import { formatDate, PHOTO_CATEGORY_LABEL, todayISO } from "@/lib/format";
import { compressImage, getPhotoBlob, putPhotoBlob } from "@/lib/photos-idb";
import { optLabel, PHOTO_STAGES } from "@/lib/specialty";
import { useClinic } from "@/lib/store";
import type { PhotoCategory, PhotoMeta } from "@/lib/types";
import { uid } from "@/lib/utils";

function usePhotoUrl(id: string | undefined) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!id) return;
    let alive = true;
    let objectUrl: string | undefined;
    void getPhotoBlob(id).then((blob) => {
      if (!alive || !blob) return;
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    });
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id]);
  return url;
}

function CompareView({ before, after }: { before: PhotoMeta; after: PhotoMeta }) {
  const a = usePhotoUrl(before.id);
  const b = usePhotoUrl(after.id);
  const [pct, setPct] = useState(50);
  const [mode, setMode] = useState<"side" | "slider">("side");
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-1.5">
        <Button type="button" size="sm" variant={mode === "side" ? "default" : "secondary"} onClick={() => setMode("side")}>
          Рядом
        </Button>
        <Button type="button" size="sm" variant={mode === "slider" ? "default" : "secondary"} onClick={() => setMode("slider")}>
          Ползунок
        </Button>
      </div>
      {mode === "side" ? (
        <div className="grid grid-cols-2 gap-2">
          <figure>
            {a ? <img src={a} alt="До" className="aspect-square w-full rounded-lg object-cover" /> : <div className="aspect-square animate-pulse rounded-lg bg-surface-2" />}
            <figcaption className="mt-1 text-[12px] text-muted">До · {formatDate(before.date, "d MMM")}</figcaption>
          </figure>
          <figure>
            {b ? <img src={b} alt="После" className="aspect-square w-full rounded-lg object-cover" /> : <div className="aspect-square animate-pulse rounded-lg bg-surface-2" />}
            <figcaption className="mt-1 text-[12px] text-muted">После · {formatDate(after.date, "d MMM")}</figcaption>
          </figure>
        </div>
      ) : (
        <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-surface-2">
          {b ? <img src={b} alt="После" className="absolute inset-0 size-full object-cover" /> : null}
          {a ? (
            <img
              src={a}
              alt="До"
              className="absolute inset-0 size-full object-cover"
              style={{ clipPath: `inset(0 ${100 - pct}% 0 0)` }}
            />
          ) : null}
          <input
            type="range"
            min={0}
            max={100}
            value={pct}
            onChange={(e) => setPct(Number(e.target.value))}
            className="absolute inset-x-3 bottom-3 z-10"
            aria-label="Сравнение до и после"
          />
        </div>
      )}
    </div>
  );
}

export function SpecPhotos({
  patientId,
  specialty,
  shots,
  stages = PHOTO_STAGES,
  lockStageToShot,
}: {
  patientId: string;
  specialty: "ortho" | "prostho";
  shots: readonly (readonly [string, string])[];
  stages?: readonly (readonly [string, string])[];
  lockStageToShot?: boolean;
}) {
  const photos = useClinic((s) => s.photos);
  const addPhotoMeta = useClinic((s) => s.addPhotoMeta);
  const patients = useClinic((s) => s.patients);
  const patient = patients.find((p) => p.id === patientId);
  const list = useMemo(
    () =>
      photos
        .filter((p) => p.patientId === patientId && (p.specialty === specialty || p.category === specialty))
        .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)),
    [photos, patientId, specialty],
  );

  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [shot, setShot] = useState(shots[0]?.[0] ?? "");
  const [stage, setStage] = useState<"before" | "during" | "after">("before");
  const [busy, setBusy] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [beforeId, setBeforeId] = useState("");
  const [afterId, setAfterId] = useState("");
  const [filterShot, setFilterShot] = useState("");

  const category: PhotoCategory = specialty;
  const beforeList = list.filter((p) => p.stage === "before");
  const afterList = list.filter((p) => p.stage === "after");
  const before = list.find((p) => p.id === beforeId);
  const after = list.find((p) => p.id === afterId);
  const opened = list.find((p) => p.id === openId);
  const visible = filterShot ? list.filter((p) => p.shot === filterShot) : list;

  function stageFromShot(id: string): "before" | "during" | "after" {
    if (id === "before") return "before";
    if (id === "after") return "after";
    return "during";
  }

  function chooseShot(id: string) {
    setShot(id);
    if (lockStageToShot) setStage(stageFromShot(id));
  }

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    try {
      let added = 0;
      const resolvedStage = lockStageToShot ? stageFromShot(shot) : stage;
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) {
          toast.error(`${file.name}: это не изображение`);
          continue;
        }
        const blob = await compressImage(file);
        const id = uid("ph");
        await putPhotoBlob(id, blob);
        addPhotoMeta({
          id,
          patientId,
          createdAt: new Date().toISOString(),
          date: todayISO(),
          category,
          description: optLabel(shots, shot),
          specialty,
          shot,
          stage: resolvedStage,
        });
        added += 1;
      }
      if (added) toast.success(`Добавлено в фотоархив: ${added}`);
    } catch {
      toast.error("Не удалось сохранить фото");
    } finally {
      setBusy(false);
      if (galleryRef.current) galleryRef.current.value = "";
      if (cameraRef.current) cameraRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted">
        Снимки пишутся в общий фотоархив пациента, категория «{PHOTO_CATEGORY_LABEL[category]}».
      </p>
      <Field label={lockStageToShot ? "Этап" : "Ракурс"}>
        <RadioChips options={shots} value={shot} onChange={chooseShot} />
      </Field>
      {!lockStageToShot ? (
        <Field label="Этап лечения">
          <RadioChips
            options={stages}
            value={stage}
            onChange={(id) => setStage((id as "before" | "during" | "after") || "before")}
          />
        </Field>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={busy} onClick={() => galleryRef.current?.click()}>
          <ImagePlus className="size-4" />
          {busy ? "Сохранение…" : "Из галереи"}
        </Button>
        <Button type="button" variant="secondary" disabled={busy} onClick={() => cameraRef.current?.click()}>
          <Camera className="size-4" />
          С камеры
        </Button>
        <input ref={galleryRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => void onFiles(e.target.files)} />
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => void onFiles(e.target.files)}
        />
      </div>

      {list.length ? (
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            className={`h-9 rounded-full px-3 text-[13px] ${filterShot ? "bg-surface-2" : "bg-primary text-primary-fg"}`}
            onClick={() => setFilterShot("")}
          >
            Все ({list.length})
          </button>
          {shots.map(([id, label]) => {
            const n = list.filter((p) => p.shot === id).length;
            if (!n) return null;
            return (
              <button
                key={id}
                type="button"
                className={`h-9 rounded-full px-3 text-[13px] ${filterShot === id ? "bg-primary text-primary-fg" : "bg-surface-2"}`}
                onClick={() => setFilterShot(id)}
              >
                {label} ({n})
              </button>
            );
          })}
        </div>
      ) : null}

      {visible.length === 0 ? (
        <p className="text-sm text-muted">Фотографий этого протокола пока нет</p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {visible.map((p) => (
            <SpecThumb key={p.id} photo={p} shots={shots} onOpen={() => setOpenId(p.id)} />
          ))}
        </div>
      )}

      <div className="rounded-lg bg-bg p-3">
        <p className="font-medium">Сравнить</p>
        <p className="mt-0.5 text-[12px] text-muted">Выберите снимок до лечения и после</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <Field label="До лечения">
            <Select value={beforeId} onChange={(e) => setBeforeId(e.target.value)}>
              <option value="">Не выбран</option>
              {beforeList.map((p) => (
                <option key={p.id} value={p.id}>
                  {formatDate(p.date, "d MMM yyyy")} · {optLabel(shots, p.shot ?? "")}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="После лечения">
            <Select value={afterId} onChange={(e) => setAfterId(e.target.value)}>
              <option value="">Не выбран</option>
              {afterList.map((p) => (
                <option key={p.id} value={p.id}>
                  {formatDate(p.date, "d MMM yyyy")} · {optLabel(shots, p.shot ?? "")}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        {before && after ? <div className="mt-3"><CompareView before={before} after={after} /></div> : null}
      </div>

      {opened ? (
        <PhotoViewer
          photo={opened}
          patient={patient}
          onClose={() => setOpenId(null)}
        />
      ) : null}
    </div>
  );
}

function SpecThumb({
  photo,
  shots,
  onOpen,
}: {
  photo: PhotoMeta;
  shots: readonly (readonly [string, string])[];
  onOpen: () => void;
}) {
  const url = usePhotoUrl(photo.id);
  return (
    <button type="button" onClick={onOpen} className="overflow-hidden rounded-lg bg-bg text-left">
      <div className="aspect-square bg-surface-2">
        {url ? (
          <img src={url} alt={photo.description} className="size-full object-cover" />
        ) : (
          <div className="size-full animate-pulse bg-surface-2" />
        )}
      </div>
      <p className="truncate px-2 py-1.5 text-[12px]">
        {optLabel(shots, photo.shot ?? "") !== "—" ? optLabel(shots, photo.shot ?? "") : photo.description}
        {photo.stage ? ` · ${optLabel(PHOTO_STAGES, photo.stage)}` : ""}
      </p>
    </button>
  );
}

export function AttachStudyPhoto({
  patientId,
  specialty,
  photoId,
  onChange,
}: {
  patientId: string;
  specialty: "ortho" | "prostho";
  photoId?: string;
  onChange: (id: string | undefined) => void;
}) {
  const photos = useClinic((s) => s.photos);
  const addPhotoMeta = useClinic((s) => s.addPhotoMeta);
  const ref = useRef<HTMLInputElement>(null);
  const url = usePhotoUrl(photoId);
  const related = photos.filter(
    (p) => p.patientId === patientId && (p.category === "xray" || p.specialty === specialty),
  );

  async function onFile(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Нужно изображение");
      return;
    }
    try {
      const blob = await compressImage(file);
      const id = uid("ph");
      await putPhotoBlob(id, blob);
      addPhotoMeta({
        id,
        patientId,
        createdAt: new Date().toISOString(),
        date: todayISO(),
        category: "xray",
        description: file.name.replace(/\.[^.]+$/, ""),
        specialty,
      });
      onChange(id);
      toast.success("Снимок добавлен в фотоархив");
    } catch {
      toast.error("Не удалось сохранить снимок");
    } finally {
      if (ref.current) ref.current.value = "";
    }
  }

  return (
    <div className="mt-2 flex flex-col gap-2">
      <Field label="Файл / снимок">
        <Select value={photoId ?? ""} onChange={(e) => onChange(e.target.value || undefined)}>
          <option value="">Не прикреплён</option>
          {related.map((p) => (
            <option key={p.id} value={p.id}>
              {formatDate(p.date, "d MMM yyyy")} · {p.description || PHOTO_CATEGORY_LABEL[p.category]}
            </option>
          ))}
        </Select>
      </Field>
      <Button type="button" size="sm" variant="secondary" onClick={() => ref.current?.click()}>
        <ImagePlus className="size-4" />
        Загрузить снимок
      </Button>
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={(e) => void onFile(e.target.files)} />
      {url ? <img src={url} alt="" className="h-24 w-24 rounded-md object-cover" /> : null}
    </div>
  );
}
