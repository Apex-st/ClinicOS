import { Camera, FolderPlus, ImagePlus, Pencil, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { PhotoViewer } from "@/components/photo-viewer";
import { ConfirmDialog } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, Select } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatDate, PHOTO_CATEGORIES, PHOTO_CATEGORY_LABEL, todayISO } from "@/lib/format";
import { compressImage, getPhotoBlob, putPhotoBlob } from "@/lib/photos-idb";
import { useLongPress } from "@/lib/long-press";
import { useClinic } from "@/lib/store";
import { ToothFdiOptions } from "@/components/odontogram";
import type { PhotoAlbum, PhotoCategory, PhotoMeta } from "@/lib/types";
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

function Thumb({ photo, onOpen, onAskDelete }: { photo: PhotoMeta; onOpen: () => void; onAskDelete: () => void }) {
  const url = usePhotoUrl(photo.id);
  const lp = useLongPress(onAskDelete);
  return (
    <button
      type="button"
      onClick={(e) => {
        lp.onClick(e);
        if (e.defaultPrevented) return;
        onOpen();
      }}
      onPointerDown={lp.onPointerDown}
      onPointerMove={lp.onPointerMove}
      onPointerUp={lp.onPointerUp}
      onPointerCancel={lp.onPointerCancel}
      onContextMenu={lp.onContextMenu}
      className="group overflow-hidden rounded-lg bg-surface text-left shadow-[var(--shadow-card)] select-none [-webkit-touch-callout:none]"
    >
      <div className="aspect-square bg-surface-2">
        {url ? (
          <img src={url} alt={photo.description || PHOTO_CATEGORY_LABEL[photo.category]} draggable={false} className="pointer-events-none size-full object-cover" />
        ) : (
          <div className="size-full animate-pulse bg-surface-2" />
        )}
      </div>
      <div className="px-2.5 py-2">
        <p className="truncate text-[12px] font-medium">{PHOTO_CATEGORY_LABEL[photo.category]}</p>
        <p className="truncate text-[11px] text-muted">
          {formatDate(photo.date, "d MMM yyyy")}
          {photo.toothFdi ? ` · зуб ${photo.toothFdi}` : ""}
        </p>
      </div>
    </button>
  );
}

type Filter = "all" | "none" | string;

type AlbumDraft = {
  title: string;
  date: string;
  visitId: string;
  toothFdi: string;
  description: string;
};

function emptyDraft(date = todayISO()): AlbumDraft {
  return { title: "", date, visitId: "", toothFdi: "", description: "" };
}

function draftFrom(album: PhotoAlbum): AlbumDraft {
  return {
    title: album.title,
    date: album.date,
    visitId: album.visitId ?? "",
    toothFdi: album.toothFdi != null ? String(album.toothFdi) : "",
    description: album.description,
  };
}

export function PhotoArchive({ patientId }: { patientId: string }) {
  const photos = useClinic((s) => s.photos);
  const albumsAll = useClinic((s) => s.albums);
  const albums = albumsAll ?? [];
  const patients = useClinic((s) => s.patients);
  const visits = useClinic((s) => s.visits);
  const addPhotoMeta = useClinic((s) => s.addPhotoMeta);
  const deletePhoto = useClinic((s) => s.deletePhoto);
  const addAlbum = useClinic((s) => s.addAlbum);
  const updateAlbum = useClinic((s) => s.updateAlbum);
  const deleteAlbum = useClinic((s) => s.deleteAlbum);
  const patient = patients.find((p) => p.id === patientId);
  const list = useMemo(
    () =>
      photos
        .filter((p) => p.patientId === patientId)
        .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)),
    [photos, patientId],
  );
  const folders = useMemo(
    () =>
      albums
        .filter((a) => a.patientId === patientId)
        .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)),
    [albums, patientId],
  );
  const patientVisits = useMemo(
    () =>
      visits
        .filter((v) => v.patientId === patientId && !v.voidedAt)
        .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)),
    [visits, patientId],
  );

  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState<PhotoCategory>("teeth");
  const [date, setDate] = useState(todayISO());
  const [busy, setBusy] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<AlbumDraft>(emptyDraft());
  const [dropAlbum, setDropAlbum] = useState<PhotoAlbum | null>(null);
  const [dropKillPhotos, setDropKillPhotos] = useState(false);
  const [dropPhoto, setDropPhoto] = useState<PhotoMeta | null>(null);

  const currentAlbum = filter !== "all" && filter !== "none" ? folders.find((a) => a.id === filter) : undefined;
  const opened = list.find((p) => p.id === openId);

  const visible = useMemo(() => {
    if (filter === "all") return list;
    if (filter === "none") return list.filter((p) => !p.albumId);
    return list.filter((p) => p.albumId === filter);
  }, [list, filter]);

  const groups = useMemo(() => {
    const map = new Map<string, PhotoMeta[]>();
    for (const p of visible) {
      const arr = map.get(p.date) ?? [];
      arr.push(p);
      map.set(p.date, arr);
    }
    return [...map.entries()];
  }, [visible]);

  const unfiledCount = list.filter((p) => !p.albumId).length;

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    const album = currentAlbum;
    const day = album?.date || date;
    const visitOnDate = album?.visitId ? undefined : patientVisits.find((v) => v.date === day);
    try {
      let added = 0;
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
          date: album?.date || date,
          category,
          description: file.name.replace(/\.[^.]+$/, ""),
          albumId: album?.id,
          visitId: album?.visitId || visitOnDate?.id,
          toothFdi: album?.toothFdi,
        });
        added += 1;
      }
      if (added) toast.success(album ? `Добавлено в «${album.title}»: ${added}` : "Фотографии добавлены");
    } catch {
      toast.error("Не удалось сохранить фото");
    } finally {
      setBusy(false);
      if (galleryRef.current) galleryRef.current.value = "";
      if (cameraRef.current) cameraRef.current.value = "";
    }
  }

  function openCreate() {
    const todayVisit = patientVisits.find((v) => v.date === todayISO());
    setEditingId(null);
    setDraft({
      ...emptyDraft(),
      visitId: todayVisit?.id ?? "",
      date: todayVisit?.date ?? todayISO(),
    });
    setFormOpen(true);
  }

  function openEdit(album: PhotoAlbum) {
    setEditingId(album.id);
    setDraft(draftFrom(album));
    setFormOpen(true);
  }

  function saveAlbum() {
    const title = draft.title.trim();
    if (!title) {
      toast.error("Укажите название папки");
      return;
    }
    const payload = {
      patientId,
      title,
      date: draft.date || todayISO(),
      visitId: draft.visitId || undefined,
      toothFdi: draft.toothFdi ? Number(draft.toothFdi) : undefined,
      description: draft.description.trim(),
    };
    if (editingId) {
      updateAlbum(editingId, payload);
      toast.success("Папка обновлена");
    } else {
      const id = addAlbum(payload);
      setFilter(id);
      toast.success("Папка создана");
    }
    setFormOpen(false);
  }

  return (
    <section className="rounded-xl bg-surface p-5 shadow-[var(--shadow-card)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-lg">Фотоархив</h2>
          <p className="text-sm text-muted">
            Папки по случаям лечения. Нажмите снимок — увеличить. Долгое нажатие — удалить.
          </p>
        </div>
        <Button type="button" variant="secondary" onClick={openCreate}>
          <FolderPlus className="size-4" />
          Создать папку
        </Button>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        <Chip active={filter === "all"} onClick={() => setFilter("all")}>
          Все фотографии ({list.length})
        </Chip>
        <Chip active={filter === "none"} onClick={() => setFilter("none")}>
          Без папки ({unfiledCount})
        </Chip>
        {folders.map((a) => (
          <Chip key={a.id} active={filter === a.id} onClick={() => setFilter(a.id)}>
            {a.title} ({list.filter((p) => p.albumId === a.id).length})
          </Chip>
        ))}
      </div>

      {currentAlbum ? (
        <div className="mt-4 rounded-lg bg-bg px-4 py-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-medium">{currentAlbum.title}</p>
              <p className="text-[12px] text-muted">
                {formatDate(currentAlbum.date, "d MMMM yyyy")}
                {currentAlbum.toothFdi ? ` · зуб ${currentAlbum.toothFdi}` : ""}
                {currentAlbum.visitId
                  ? ` · приём ${formatDate(patientVisits.find((v) => v.id === currentAlbum.visitId)?.date || currentAlbum.date, "d.MM.yyyy")}`
                  : ""}
              </p>
              {currentAlbum.description ? <p className="mt-1 text-sm">{currentAlbum.description}</p> : null}
            </div>
            <div className="flex gap-1">
              <Button type="button" size="sm" variant="ghost" onClick={() => openEdit(currentAlbum)}>
                <Pencil className="size-4" />
                Изменить
              </Button>
              <Button type="button" size="sm" variant="ghost" className="text-danger" onClick={() => { setDropKillPhotos(false); setDropAlbum(currentAlbum); }}>
                <Trash2 className="size-4" />
                Удалить папку
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-end gap-2">
        <Field label="Категория">
          <Select value={category} onChange={(e) => setCategory(e.target.value as PhotoCategory)}>
            {PHOTO_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {PHOTO_CATEGORY_LABEL[c]}
              </option>
            ))}
          </Select>
        </Field>
        {!currentAlbum ? (
          <Field label="Дата приёма">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        ) : null}
        <Button type="button" disabled={busy} onClick={() => galleryRef.current?.click()}>
          <ImagePlus className="size-4" />
          {busy ? "Сохранение…" : "Из галереи"}
        </Button>
        <Button type="button" variant="secondary" disabled={busy} onClick={() => cameraRef.current?.click()}>
          <Camera className="size-4" />
          С камеры
        </Button>
        <input
          ref={galleryRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => void onFiles(e.target.files)}
        />
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => void onFiles(e.target.files)}
        />
      </div>

      {filter === "all" && folders.length > 0 ? (
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {folders.map((a) => {
            const n = list.filter((p) => p.albumId === a.id).length;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => setFilter(a.id)}
                className="rounded-lg bg-bg px-3 py-3 text-left shadow-[var(--shadow-card)]"
              >
                <p className="truncate font-medium">{a.title}</p>
                <p className="text-[12px] text-muted">
                  {formatDate(a.date, "d MMM yyyy")} · {n} фото
                </p>
              </button>
            );
          })}
        </div>
      ) : null}

      {visible.length === 0 ? (
        <p className="mt-6 text-sm text-muted">
          {filter === "none" ? "Все снимки уже в папках, либо фотографий ещё нет" : "Фотографий пока нет"}
        </p>
      ) : (
        <div className="mt-5 flex flex-col gap-6">
          {groups.map(([day, items]) => (
            <div key={day}>
              <p className="mb-2 text-[13px] font-medium text-muted">{formatDate(day, "d MMMM yyyy")}</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                {items.map((p) => (
                  <Thumb
                    key={p.id}
                    photo={p}
                    onOpen={() => setOpenId(p.id)}
                    onAskDelete={() => setDropPhoto(p)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {opened ? (
        <PhotoViewer
          photo={opened}
          patient={patient}
          onClose={() => setOpenId(null)}
          onDelete={() => {
            deletePhoto(opened.id);
            toast.success("Фото удалено");
          }}
        />
      ) : null}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Изменить папку" : "Создать папку"}</DialogTitle>
            <DialogDescription>Папка связана с пациентом и при необходимости с приёмом и зубом.</DialogDescription>
          </DialogHeader>
          <Field label="Название">
            <Input
              value={draft.title}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              placeholder="Лечение 36 зуба"
            />
          </Field>
          <Field label="Дата">
            <Input type="date" value={draft.date} onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))} />
          </Field>
          <Field label="Связанный приём">
            <Select
              value={draft.visitId}
              onChange={(e) => {
                const visitId = e.target.value;
                const visit = patientVisits.find((v) => v.id === visitId);
                setDraft((d) => ({ ...d, visitId, date: visit?.date || d.date }));
              }}
            >
              <option value="">Не связан</option>
              {patientVisits.map((v) => (
                <option key={v.id} value={v.id}>
                  {formatDate(v.date, "d MMMM yyyy")} · {v.kind === "primary" ? "первичный" : "приём"}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Зуб">
            <Select value={draft.toothFdi} onChange={(e) => setDraft((d) => ({ ...d, toothFdi: e.target.value }))}>
              <option value="">Не указан</option>
              <ToothFdiOptions />
            </Select>
          </Field>
          <Field label="Комментарий">
            <Textarea
              rows={3}
              value={draft.description}
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
              placeholder="Эндодонтическое лечение"
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setFormOpen(false)}>
              Отмена
            </Button>
            <Button type="button" onClick={saveAlbum}>
              Сохранить
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(dropAlbum)}
        onOpenChange={(o) => {
          if (!o) {
            setDropAlbum(null);
            setDropKillPhotos(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dropKillPhotos
                ? `Удалить фотографии папки «${dropAlbum?.title}»?`
                : `Удалить папку «${dropAlbum?.title}»?`}
            </DialogTitle>
            <DialogDescription>
              {dropKillPhotos
                ? `Будут удалены папка и ${list.filter((p) => p.albumId === dropAlbum?.id).length} фото. Это нельзя отменить.`
                : `В папке ${list.filter((p) => p.albumId === dropAlbum?.id).length} фото. Можно оставить снимки в «Без папки» или удалить их вместе с папкой.`}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                if (dropKillPhotos) setDropKillPhotos(false);
                else setDropAlbum(null);
              }}
            >
              Отмена
            </Button>
            {!dropKillPhotos ? (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    if (!dropAlbum) return;
                    deleteAlbum(dropAlbum.id, false);
                    if (filter === dropAlbum.id) setFilter("none");
                    setDropAlbum(null);
                    toast.success("Папка удалена, фотографии в «Без папки»");
                  }}
                >
                  Только папку, фото оставить
                </Button>
                <Button type="button" variant="danger" onClick={() => setDropKillPhotos(true)}>
                  Удалить папку вместе с фото
                </Button>
              </>
            ) : (
              <Button
                type="button"
                variant="danger"
                onClick={() => {
                  if (!dropAlbum) return;
                  deleteAlbum(dropAlbum.id, true);
                  if (filter === dropAlbum.id) setFilter("none");
                  setDropAlbum(null);
                  setDropKillPhotos(false);
                  toast.success("Папка и фотографии удалены");
                }}
              >
                Удалить папку и фотографии
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={Boolean(dropPhoto)}
        onOpenChange={(o) => !o && setDropPhoto(null)}
        title="Удалить фотографию?"
        description="Снимок будет удалён из архива. Это нельзя отменить."
        onConfirm={() => {
          const photo = dropPhoto;
          if (!photo) return;
          deletePhoto(photo.id);
          setOpenId((id) => (id === photo.id ? null : id));
          setDropPhoto(null);
          toast.success("Фото удалено");
        }}
      />
    </section>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-[13px] ${active ? "bg-primary text-primary-fg" : "bg-surface-2"}`}
    >
      {children}
    </button>
  );
}
