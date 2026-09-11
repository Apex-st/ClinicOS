import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PhotoViewer } from "@/components/photo-viewer";
import { ConfirmDialog } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { formatDate, fullName, PHOTO_CATEGORY_LABEL } from "@/lib/format";
import { useLongPress } from "@/lib/long-press";
import { getPhotoBlob } from "@/lib/photos-idb";
import { useClinic } from "@/lib/store";
import type { PhotoMeta } from "@/lib/types";

export const Route = createFileRoute("/photos")({ component: PhotosPage });

function PhotosPage() {
  const photos = useClinic((s) => s.photos);
  const patients = useClinic((s) => s.patients);
  const deletePhoto = useClinic((s) => s.deletePhoto);
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [dropId, setDropId] = useState<string | null>(null);
  const list = useMemo(() => {
    const query = q.trim().toLowerCase();
    return photos
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .filter((ph) => {
        const p = patients.find((x) => x.id === ph.patientId);
        if (!query) return true;
        return `${p ? fullName(p) : ""} ${ph.description} ${PHOTO_CATEGORY_LABEL[ph.category]}`.toLowerCase().includes(query);
      });
  }, [photos, patients, q]);

  const byPatient = useMemo(() => {
    const map = new Map<string, PhotoMeta[]>();
    for (const ph of list) {
      const arr = map.get(ph.patientId) ?? [];
      arr.push(ph);
      map.set(ph.patientId, arr);
    }
    return [...map.entries()];
  }, [list]);

  const opened = photos.find((p) => p.id === openId);
  const openedPatient = opened ? patients.find((p) => p.id === opened.patientId) : undefined;

  return (
    <div className="flex flex-col gap-5">
      <header>
        <p className="text-[13px] text-muted">Архив</p>
        <h1 className="font-display text-3xl">Фотоархив</h1>
        <p className="mt-1 text-sm text-muted">Нажмите снимок, чтобы увеличить. Долгое нажатие — удалить.</p>
      </header>
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Пациент, описание, категория" />
      {byPatient.length === 0 ? (
        <p className="text-sm text-muted">Снимков нет — добавьте их в карточке пациента</p>
      ) : (
        byPatient.map(([pid, items]) => {
          const p = patients.find((x) => x.id === pid);
          return (
            <section key={pid}>
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <h2 className="font-display text-lg">
                  {p ? (
                    <Link to="/patients/$id" params={{ id: pid }} className="hover:text-primary">
                      {fullName(p)}
                    </Link>
                  ) : (
                    pid
                  )}
                </h2>
                <p className="text-[12px] text-muted">{p?.cardNumber} · {pid}</p>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-6">
                {items.map((ph) => (
                  <GlobalThumb
                    key={ph.id}
                    photo={ph}
                    onOpen={() => setOpenId(ph.id)}
                    onAskDelete={() => setDropId(ph.id)}
                  />
                ))}
              </div>
            </section>
          );
        })
      )}
      {opened ? (
        <PhotoViewer
          photo={opened}
          patient={openedPatient}
          onClose={() => setOpenId(null)}
          onDelete={() => {
            deletePhoto(opened.id);
            setOpenId(null);
          }}
        />
      ) : null}
      <ConfirmDialog
        open={Boolean(dropId)}
        onOpenChange={(o) => !o && setDropId(null)}
        title="Удалить фотографию?"
        description="Снимок будет удалён из архива. Это нельзя отменить."
        onConfirm={() => {
          if (!dropId) return;
          deletePhoto(dropId);
          if (openId === dropId) setOpenId(null);
          setDropId(null);
        }}
      />
    </div>
  );
}

function GlobalThumb({ photo, onOpen, onAskDelete }: { photo: PhotoMeta; onOpen: () => void; onAskDelete: () => void }) {
  const [url, setUrl] = useState<string>();
  const lp = useLongPress(onAskDelete);
  useEffect(() => {
    let u: string | undefined;
    void getPhotoBlob(photo.id).then((b) => {
      if (!b) return;
      u = URL.createObjectURL(b);
      setUrl(u);
    });
    return () => {
      if (u) URL.revokeObjectURL(u);
    };
  }, [photo.id]);
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
      className="overflow-hidden rounded-lg bg-surface text-left shadow-[var(--shadow-card)] select-none [-webkit-touch-callout:none]"
    >
      <div className="aspect-square bg-surface-2">
        {url ? <img src={url} alt="" draggable={false} className="pointer-events-none size-full object-cover" /> : null}
      </div>
      <p className="truncate px-2 py-1.5 text-[11px] text-muted">
        {PHOTO_CATEGORY_LABEL[photo.category]} · {formatDate(photo.date, "d.MM")}
      </p>
    </button>
  );
}
