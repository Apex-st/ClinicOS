import { Download, Folder, Minus, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent as PE } from "react";
import { toast } from "sonner";
import { SaveFileDialog } from "@/components/save-file-dialog";
import { ConfirmDialog } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatDate, fullName, PHOTO_CATEGORIES, PHOTO_CATEGORY_LABEL } from "@/lib/format";
import { getPhotoBlob } from "@/lib/photos-idb";
import { ORTHO_SHOTS, PHOTO_STAGES, PROSTHO_SHOTS } from "@/lib/specialty";
import { useClinic } from "@/lib/store";
import type { Patient, PhotoCategory, PhotoMeta } from "@/lib/types";
import { ToothFdiOptions } from "@/components/odontogram";

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

export function photoFileName(patient: Patient | undefined, photo: PhotoMeta) {
  const day = (photo.date || photo.createdAt || "").slice(0, 10) || "дата";
  const pid = patient?.id || photo.patientId || "unknown";
  const tooth = photo.toothFdi ? `_${photo.toothFdi}_зуб` : "";
  const shortId = photo.id.replace(/^ph_/, "");
  return `${day}_Пациент_ID${pid}${tooth}_${shortId}.jpg`;
}

export function PhotoViewer({
  photo,
  patient,
  onClose,
  onDelete,
}: {
  photo: PhotoMeta;
  patient?: Patient;
  onClose: () => void;
  onDelete?: () => void;
}) {
  const url = usePhotoUrl(photo.id);
  const updatePhoto = useClinic((s) => s.updatePhoto);
  const albumsAll = useClinic((s) => s.albums);
  const albums = (albumsAll ?? []).filter((a) => a.patientId === photo.patientId);
  const visitsAll = useClinic((s) => s.visits);
  const visits = visitsAll.filter((v) => v.patientId === photo.patientId && !v.voidedAt);
  const [ask, setAsk] = useState(false);
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const [file, setFile] = useState<{ blob: Blob; name: string } | null>(null);
  const [info, setInfo] = useState(false);
  const drag = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const pinch = useRef<{ dist: number; scale: number } | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const stage = useRef<HTMLDivElement>(null);
  const view = useRef({ scale: 1, tx: 0, ty: 0 });
  view.current = { scale, tx, ty };

  function apply(nextScale: number, nextTx: number, nextTy: number) {
    const c = clamp(nextScale, nextTx, nextTy);
    view.current = c;
    setScale(c.scale);
    setTx(c.tx);
    setTy(c.ty);
    return c;
  }

  useEffect(() => {
    apply(1, 0, 0);
  }, [photo.id]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "+" || e.key === "=") apply(view.current.scale + 0.25, view.current.tx, view.current.ty);
      if (e.key === "-" || e.key === "_") apply(view.current.scale - 0.25, view.current.tx, view.current.ty);
      if (e.key === "0") apply(1, 0, 0);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function clamp(nextScale: number, nextTx: number, nextTy: number) {
    if (nextScale <= 1) return { scale: 1, tx: 0, ty: 0 };
    const el = stage.current;
    const s = Math.min(6, Math.max(1, nextScale));
    if (!el) return { scale: s, tx: nextTx, ty: nextTy };
    const maxX = (el.clientWidth * (s - 1)) / 2 + 40;
    const maxY = (el.clientHeight * (s - 1)) / 2 + 40;
    return {
      scale: s,
      tx: Math.min(maxX, Math.max(-maxX, nextTx)),
      ty: Math.min(maxY, Math.max(-maxY, nextTy)),
    };
  }

  function reset() {
    apply(1, 0, 0);
  }

  async function download() {
    const blob = await getPhotoBlob(photo.id);
    if (!blob) {
      toast.error("Файл фото не найден");
      return;
    }
    const typed = blob.type.startsWith("image/") ? blob : new Blob([blob], { type: "image/jpeg" });
    if (typed.size < 32) {
      toast.error("Файл пустой — снимок не сохранился");
      return;
    }
    setFile({ blob: typed, name: photoFileName(patient, photo) });
  }

  function onPointerDown(e: PE<HTMLDivElement>) {
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const pts = [...pointers.current.values()];
      const dist = Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y);
      pinch.current = { dist: dist || 1, scale: view.current.scale };
      drag.current = null;
      return;
    }
    if (view.current.scale > 1) {
      drag.current = { x: e.clientX, y: e.clientY, tx: view.current.tx, ty: view.current.ty };
    }
  }

  function onPointerMove(e: PE<HTMLDivElement>) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2 && pinch.current) {
      const pts = [...pointers.current.values()];
      const dist = Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y);
      const next = (pinch.current.scale * dist) / pinch.current.dist;
      apply(next, view.current.tx, view.current.ty);
      return;
    }
    if (!drag.current || view.current.scale <= 1) return;
    apply(
      view.current.scale,
      drag.current.tx + (e.clientX - drag.current.x),
      drag.current.ty + (e.clientY - drag.current.y),
    );
  }

  function onPointerUp(e: PE<HTMLDivElement>) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    drag.current = null;
  }

  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const onWheelNative = (e: WheelEvent) => {
      e.preventDefault();
      const dir = e.deltaY > 0 ? -0.2 : 0.2;
      const next = view.current.scale + dir;
      apply(next, next <= 1 ? 0 : view.current.tx, next <= 1 ? 0 : view.current.ty);
    };
    el.addEventListener("wheel", onWheelNative, { passive: false });
    return () => el.removeEventListener("wheel", onWheelNative);
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black">
      <div className="flex h-[100dvh] w-full flex-col">
        <div className="absolute top-0 right-0 left-0 z-10 flex items-center justify-between gap-2 bg-gradient-to-b from-black/70 to-transparent px-2 py-2">
          <p className="truncate px-2 text-sm text-white">{patient ? fullName(patient) : "Фото"}</p>
          <button type="button" className="grid size-11 place-items-center rounded-md text-white hover:bg-white/10" onClick={onClose} aria-label="Закрыть">
            <X className="size-5" />
          </button>
        </div>
        <div
          ref={stage}
          className="relative min-h-0 flex-1 cursor-grab touch-none overflow-hidden active:cursor-grabbing"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onDoubleClick={() => {
            if (view.current.scale > 1) reset();
            else apply(2.5, 0, 0);
          }}
        >
          {url ? (
            <img
              src={url}
              alt={photo.description || PHOTO_CATEGORY_LABEL[photo.category]}
              draggable={false}
              className="absolute inset-0 m-auto max-h-full max-w-full select-none object-contain"
              style={{ transform: `translate(${tx}px, ${ty}px) scale(${scale})`, transformOrigin: "center center" }}
            />
          ) : (
            <p className="grid h-full place-items-center text-sm text-white/70">Загрузка…</p>
          )}
        </div>
        <div className="absolute right-0 bottom-0 left-0 z-10 flex flex-wrap items-center gap-1 bg-gradient-to-t from-black/80 to-transparent px-2 py-3">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="text-white hover:bg-white/10"
            aria-label="Уменьшить"
            onClick={() => apply(scale - 0.25, tx, ty)}
          >
            <Minus className="size-4" />
          </Button>
          <p className="w-12 text-center text-[12px] text-white/70">{Math.round(scale * 100)}%</p>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="text-white hover:bg-white/10"
            aria-label="Увеличить"
            onClick={() => apply(scale + 0.25, tx, ty)}
          >
            <Plus className="size-4" />
          </Button>
          <Button type="button" size="sm" variant="ghost" className="text-white hover:bg-white/10" onClick={reset} aria-label="Сбросить масштаб">
            <RotateCcw className="size-4" />
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={() => void download()}>
            <Download className="size-4" />
            Скачать
          </Button>
          <Button type="button" size="sm" variant="ghost" className="text-white hover:bg-white/10" onClick={() => setInfo((v) => !v)}>
            <Folder className="size-4" />
            Папка
          </Button>
          {onDelete ? (
            <Button variant="ghost" className="text-red-300 hover:bg-white/10" onClick={() => setAsk(true)}>
              <Trash2 className="size-4" />
              Удалить
            </Button>
          ) : null}
        </div>
      </div>
      {info ? (
        <div className="absolute top-14 right-3 z-20 flex w-[min(100%-1.5rem,320px)] max-h-[70vh] flex-col gap-2 overflow-y-auto rounded-xl bg-surface p-4 shadow-[var(--shadow-lift)]">
          <Field label="Папка">
            <Select
              value={photo.albumId ?? ""}
              onChange={(e) => {
                const albumId = e.target.value || undefined;
                const alb = albums.find((a) => a.id === albumId);
                updatePhoto(photo.id, {
                  albumId,
                  visitId: alb?.visitId || photo.visitId,
                  toothFdi: photo.toothFdi ?? alb?.toothFdi,
                });
              }}
            >
              <option value="">Без папки</option>
              {albums.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Приём">
            <Select value={photo.visitId ?? ""} onChange={(e) => updatePhoto(photo.id, { visitId: e.target.value || undefined })}>
              <option value="">Не связан</option>
              {visits.map((v) => (
                <option key={v.id} value={v.id}>
                  {formatDate(v.date, "d MMMM yyyy")}
                  {v.kind === "primary" ? " · первичный" : ""}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Категория">
            <Select
              value={photo.category}
              onChange={(e) => {
                const category = e.target.value as PhotoCategory;
                const specialty = category === "ortho" || category === "prostho" ? category : photo.specialty;
                updatePhoto(photo.id, { category, specialty });
              }}
            >
              {PHOTO_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {PHOTO_CATEGORY_LABEL[c]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Специальность">
            <Select
              value={photo.specialty ?? ""}
              onChange={(e) =>
                updatePhoto(photo.id, {
                  specialty: (e.target.value || undefined) as PhotoMeta["specialty"],
                })
              }
            >
              <option value="">Общий архив</option>
              <option value="ortho">Ортодонтия</option>
              <option value="prostho">Ортопедия</option>
            </Select>
          </Field>
          {photo.specialty === "ortho" || photo.category === "ortho" ? (
            <Field label="Ракурс">
              <Select value={photo.shot ?? ""} onChange={(e) => updatePhoto(photo.id, { shot: e.target.value || undefined })}>
                <option value="">Не указан</option>
                {ORTHO_SHOTS.map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}
          {photo.specialty === "prostho" || photo.category === "prostho" ? (
            <Field label="Этап снимка">
              <Select value={photo.shot ?? ""} onChange={(e) => updatePhoto(photo.id, { shot: e.target.value || undefined })}>
                <option value="">Не указан</option>
                {PROSTHO_SHOTS.map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}
          <Field label="Этап лечения">
            <Select
              value={photo.stage ?? ""}
              onChange={(e) =>
                updatePhoto(photo.id, {
                  stage: (e.target.value || undefined) as PhotoMeta["stage"],
                })
              }
            >
              <option value="">Не указан</option>
              {PHOTO_STAGES.map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Дата">
            <Input type="date" value={photo.date} onChange={(e) => updatePhoto(photo.id, { date: e.target.value })} />
          </Field>
          <Field label="Зуб">
            <Select
              value={photo.toothFdi?.toString() ?? ""}
              onChange={(e) => updatePhoto(photo.id, { toothFdi: e.target.value ? Number(e.target.value) : undefined })}
            >
              <option value="">Не указан</option>
              <ToothFdiOptions />
            </Select>
          </Field>
          <Field label="Описание">
            <Textarea rows={3} value={photo.description} onChange={(e) => updatePhoto(photo.id, { description: e.target.value })} />
          </Field>
        </div>
      ) : null}
      {onDelete ? (
        <ConfirmDialog
          open={ask}
          onOpenChange={setAsk}
          title="Удалить фотографию?"
          description="Файл будет удалён из архива этого пациента. Это нельзя отменить."
          onConfirm={() => {
            onDelete();
            onClose();
          }}
        />
      ) : null}
      <SaveFileDialog
        open={Boolean(file)}
        onOpenChange={(o) => {
          if (!o) setFile(null);
        }}
        blob={file?.blob ?? null}
        filename={file?.name ?? "photo.jpg"}
        title="Скачать фотографию"
        kind="image"
      />
    </div>
  );
}
