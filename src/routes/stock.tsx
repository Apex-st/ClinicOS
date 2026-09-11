import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronDown, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { SwipeRow } from "@/components/swipe-row";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, Select } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NumericInput } from "@/components/ui/numeric-input";
import { Textarea } from "@/components/ui/textarea";
import { STOCK_UNITS, sortedStockGroups } from "@/lib/stock";
import { useClinic } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { StockGroup, StockItem } from "@/lib/types";

export const Route = createFileRoute("/stock")({ component: StockPage });

function StockPage() {
  const items = useClinic((s) => s.stockItems);
  const groups = useClinic((s) => s.stockGroups);
  const addItem = useClinic((s) => s.addStockItem);
  const updateItem = useClinic((s) => s.updateStockItem);
  const deleteItem = useClinic((s) => s.deleteStockItem);
  const addGroup = useClinic((s) => s.addStockGroup);
  const updateGroup = useClinic((s) => s.updateStockGroup);
  const deleteGroup = useClinic((s) => s.deleteStockGroup);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<StockItem | null>(null);
  const [askId, setAskId] = useState<string | null>(null);
  const [groupOpen, setGroupOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<StockGroup | null>(null);
  const [askGroup, setAskGroup] = useState<string | null>(null);
  const [swipeId, setSwipeId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [groupMenu, setGroupMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const menuArmed = useRef(false);

  const list = sortedStockGroups(groups);
  const askItem = items.find((s) => s.id === askId);
  const groupToDelete = groups.find((g) => g.id === askGroup);

  useEffect(() => {
    if (!swipeId && !groupMenu) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setSwipeId(null);
        setGroupMenu(null);
      }
    }
    function onDown(e: PointerEvent) {
      const t = e.target as HTMLElement | null;
      if (groupMenu && menuArmed.current && !t?.closest("[data-group-menu]")) setGroupMenu(null);
      if (swipeId && !t?.closest("[data-swipe-row]")) setSwipeId(null);
    }
    function onUp() {
      menuArmed.current = true;
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("pointerup", onUp);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("pointerup", onUp);
    };
  }, [swipeId, groupMenu]);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[13px] text-muted">Материалы кабинета</p>
          <h1 className="font-display text-3xl">Склад</h1>
          <p className="mt-1 text-[13px] text-muted">
            Классификация как группы в прайсе. Выбранные материалы попадают в шаблон и дневник лечения.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              setEditingGroup(null);
              setGroupOpen(true);
            }}
          >
            <Plus className="size-4" />
            Группа
          </Button>
          <Button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus className="size-4" />
            Материал
          </Button>
        </div>
      </header>

      {list.map((cat) => {
        const rows = items.filter((s) => s.groupId === cat.id);
        const isClosed = Boolean(collapsed[cat.id]);
        return (
          <section key={cat.id}>
            <GroupHead
              name={cat.name}
              open={!isClosed}
              onToggle={() => {
                setGroupMenu(null);
                setCollapsed((prev) => ({ ...prev, [cat.id]: !prev[cat.id] }));
              }}
              onMenu={(x, y) => {
                menuArmed.current = false;
                setSwipeId(null);
                setGroupMenu({ id: cat.id, x, y });
              }}
            />
            {isClosed ? null : rows.length === 0 ? (
              <p className="rounded-xl bg-surface px-4 py-3 text-sm text-muted shadow-[var(--shadow-card)]">
                В группе пока нет материалов
              </p>
            ) : (
              <ul className="flex flex-col overflow-hidden rounded-xl bg-surface shadow-[var(--shadow-card)]">
                {rows.map((s, i) => (
                  <li key={s.id} className={i ? "border-t border-line" : ""}>
                    <SwipeRow
                      open={swipeId === s.id}
                      onOpenChange={(next) => setSwipeId(next ? s.id : null)}
                      onTap={() => {
                        setSwipeId(null);
                        setEditing(s);
                        setOpen(true);
                      }}
                      actions={
                        <>
                          <button
                            type="button"
                            className="flex w-[76px] flex-col items-center justify-center gap-1 bg-surface-2 text-[11px] text-ink"
                            onClick={() => {
                              setSwipeId(null);
                              setEditing(s);
                              setOpen(true);
                            }}
                          >
                            <Pencil className="size-4" />
                            Изменить
                          </button>
                          <button
                            type="button"
                            className="flex w-[76px] flex-col items-center justify-center gap-1 bg-danger text-[11px] text-primary-fg"
                            onClick={() => {
                              setSwipeId(null);
                              setAskId(s.id);
                            }}
                          >
                            <Trash2 className="size-4" />
                            Удалить
                          </button>
                        </>
                      }
                    >
                      <div className={cn("flex min-h-14 items-center gap-3 px-4 py-3", s.active ? "" : "opacity-50")}>
                        <div className="min-w-0 flex-1 text-left">
                          <p className="truncate text-sm font-medium">{s.name}</p>
                          <p className="text-[12px] text-muted">
                            {s.unit}
                            {s.qty <= s.minQty ? " · мало на складе" : ""}
                          </p>
                        </div>
                        <p className={cn("text-sm tabular-nums", s.qty <= s.minQty && "text-danger")}>
                          {s.qty} {s.unit}
                        </p>
                      </div>
                    </SwipeRow>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}

      {groupMenu ? (
        <GroupMenu
          x={groupMenu.x}
          y={groupMenu.y}
          onEdit={() => {
            const g = groups.find((x) => x.id === groupMenu.id);
            if (!g) return;
            setEditingGroup(g);
            setGroupOpen(true);
            setGroupMenu(null);
          }}
          onDelete={() => {
            setAskGroup(groupMenu.id);
            setGroupMenu(null);
          }}
          onClose={() => setGroupMenu(null)}
        />
      ) : null}

      <ItemDialog
        open={open}
        onOpenChange={setOpen}
        item={editing}
        groups={list}
        onSave={(draft, id) => {
          if (id) updateItem(id, draft);
          else addItem(draft);
          toast.success(
            draft.active
              ? `«${draft.name}» появится кнопкой в дневнике и шаблонах`
              : "Склад обновлён. Материал скрыт в дневнике.",
          );
        }}
      />
      <GroupDialog
        open={groupOpen}
        onOpenChange={setGroupOpen}
        group={editingGroup}
        onSave={(name, id) => {
          if (id) {
            updateGroup(id, { name });
            toast.success("Группа переименована");
          } else {
            addGroup(name);
            toast.success("Группа добавлена");
          }
        }}
      />
      <ConfirmDialog
        open={Boolean(askId)}
        onOpenChange={(o) => {
          if (!o) setAskId(null);
        }}
        title="Удалить материал?"
        description={
          askItem
            ? `«${askItem.name}». Старые дневники останутся как есть.`
            : "Это действие нельзя отменить."
        }
        confirmLabel="Удалить"
        onConfirm={() => {
          if (!askId) return;
          deleteItem(askId);
          toast.success("Материал удалён");
          setAskId(null);
        }}
      />
      <GroupDeleteDialog
        open={Boolean(askGroup)}
        group={groupToDelete ?? null}
        count={askGroup ? items.filter((s) => s.groupId === askGroup).length : 0}
        others={list.filter((g) => g.id !== askGroup)}
        onClose={() => setAskGroup(null)}
        onDelete={(moveTo, dropItems) => {
          if (!askGroup) return;
          if (list.length <= 1) {
            toast.error("Нужна хотя бы одна группа");
            setAskGroup(null);
            return;
          }
          deleteGroup(askGroup, moveTo, dropItems);
          toast.success(dropItems ? "Группа и материалы удалены" : "Группа удалена");
          setAskGroup(null);
        }}
      />
      <p className="text-[12px] text-muted">
        В шаблонах дневника эти материалы можно отметить заранее.{" "}
        <Link to="/settings" hash="diary" className="text-primary">
          Шаблоны дневника
        </Link>
      </p>
    </div>
  );
}

function GroupHead({
  name,
  open,
  onToggle,
  onMenu,
}: {
  name: string;
  open: boolean;
  onToggle: () => void;
  onMenu: (x: number, y: number) => void;
}) {
  const timer = useRef<number | null>(null);
  const start = useRef({ x: 0, y: 0 });
  const long = useRef(false);
  const moved = useRef(false);

  function clearTimer() {
    if (timer.current != null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }

  function openMenu(x: number, y: number) {
    long.current = true;
    onMenu(x, y);
  }

  function onPointerDown(e: ReactPointerEvent<HTMLButtonElement>) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    long.current = false;
    moved.current = false;
    start.current = { x: e.clientX, y: e.clientY };
    clearTimer();
    timer.current = window.setTimeout(() => {
      openMenu(e.clientX, e.clientY);
    }, 480);
  }

  function onPointerMove(e: ReactPointerEvent<HTMLButtonElement>) {
    if (timer.current == null && !long.current) return;
    if (Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 10) {
      moved.current = true;
      clearTimer();
    }
  }

  function onPointerUp() {
    clearTimer();
  }

  return (
    <button
      type="button"
      data-group-head=""
      className="mb-2 flex w-full select-none items-center gap-2 rounded-md px-1 py-1.5 text-left hover:bg-surface-2 [-webkit-touch-callout:none]"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={clearTimer}
      onClick={(e) => {
        if (long.current || moved.current) {
          e.preventDefault();
          return;
        }
        onToggle();
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        clearTimer();
        openMenu(e.clientX, e.clientY);
      }}
    >
      <ChevronDown
        className={cn("size-4 shrink-0 text-muted transition-transform duration-150", open ? "" : "-rotate-90")}
      />
      <h2 className="min-w-0 flex-1 font-display text-lg">{name}</h2>
    </button>
  );
}

function GroupMenu({
  x,
  y,
  onEdit,
  onDelete,
  onClose,
}: {
  x: number;
  y: number;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const ready = useRef(false);
  useEffect(() => {
    const arm = () => {
      ready.current = true;
    };
    const fallback = window.setTimeout(arm, 400);
    document.addEventListener("pointerup", arm, { once: true });
    return () => {
      window.clearTimeout(fallback);
      document.removeEventListener("pointerup", arm);
    };
  }, []);
  const left = Math.min(Math.max(8, x), window.innerWidth - 188);
  const top = Math.min(y + 8, window.innerHeight - 120);
  return createPortal(
    <div
      className="fixed inset-0 z-50"
      onPointerDown={() => {
        if (ready.current) onClose();
      }}
    >
      <div
        data-group-menu=""
        className="absolute min-w-[11.5rem] overflow-hidden rounded-xl bg-surface py-1 shadow-[var(--shadow-lift)]"
        style={{ left, top }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <MenuItem onClick={onEdit}>
          <Pencil className="size-4" />
          Изменить группу
        </MenuItem>
        <MenuItem danger onClick={onDelete}>
          <Trash2 className="size-4" />
          Удалить группу
        </MenuItem>
      </div>
    </div>,
    document.body,
  );
}

function MenuItem({
  children,
  onClick,
  danger,
}: {
  children: ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      className={cn(
        "flex h-11 w-full items-center gap-2 px-3 text-left text-sm",
        danger ? "text-danger hover:bg-surface-2" : "text-ink hover:bg-surface-2",
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function pluralItems(n: number) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return `${n} материал`;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return `${n} материала`;
  return `${n} материалов`;
}

function GroupDeleteDialog({
  open,
  group,
  count,
  others,
  onClose,
  onDelete,
}: {
  open: boolean;
  group: StockGroup | null;
  count: number;
  others: StockGroup[];
  onClose: () => void;
  onDelete: (moveTo?: string, dropItems?: boolean) => void;
}) {
  const [moveTo, setMoveTo] = useState("");
  useEffect(() => {
    if (!open) return;
    setMoveTo(others[0]?.id ?? "");
  }, [open, group?.id, others]);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Удалить группу?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-ink">{group ? `«${group.name}»` : "Группа"}</p>
        {count > 0 ? (
          <>
            <p className="text-sm text-muted">В этой группе содержится {pluralItems(count)}.</p>
            <Field label="Переместить материалы в">
              <Select value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
                {others.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="ghost" onClick={onClose}>
                Отмена
              </Button>
              <Button type="button" variant="danger" onClick={() => onDelete(undefined, true)}>
                Удалить с материалами
              </Button>
              <Button type="button" onClick={() => onDelete(moveTo || others[0]?.id)}>
                Переместить
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-muted">Группа пропадёт со склада.</p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={onClose}>
                Отмена
              </Button>
              <Button type="button" variant="danger" onClick={() => onDelete()}>
                Удалить
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function GroupDialog({
  open,
  onOpenChange,
  group,
  onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  group: StockGroup | null;
  onSave: (name: string, id?: string) => void;
}) {
  const [name, setName] = useState("");
  useEffect(() => {
    if (!open) return;
    setName(group?.name ?? "");
  }, [open, group]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{group ? "Группа" : "Новая группа"}</DialogTitle>
        </DialogHeader>
        <Field label="Название">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Пломбировочные, эндодонтия…"
          />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" type="button" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button
            type="button"
            onClick={() => {
              if (!name.trim()) return;
              onSave(name.trim(), group?.id);
              onOpenChange(false);
            }}
          >
            Сохранить
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ItemDialog({
  open,
  onOpenChange,
  item,
  groups,
  onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  item: StockItem | null;
  groups: StockGroup[];
  onSave: (draft: Omit<StockItem, "id">, id?: string) => void;
}) {
  const [name, setName] = useState("");
  const [groupId, setGroupId] = useState(groups[0]?.id ?? "");
  const [unit, setUnit] = useState("шт");
  const [qty, setQty] = useState(0);
  const [minQty, setMinQty] = useState(0);
  const [note, setNote] = useState("");
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (!open) return;
    setName(item?.name ?? "");
    setGroupId(item?.groupId ?? groups[0]?.id ?? "");
    setUnit(item?.unit ?? "шт");
    setQty(item?.qty ?? 0);
    setMinQty(item?.minQty ?? 0);
    setNote(item?.note ?? "");
    setActive(item?.active !== false);
  }, [open, item, groups]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent placement="sheet" className="min-w-0">
        <DialogHeader>
          <DialogTitle>{item ? "Материал" : "Новый материал"}</DialogTitle>
        </DialogHeader>
        <Field label="Название">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Filtek A2, адгезив…" />
        </Field>
        <Field label="Классификация">
          <Select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Остаток">
            <NumericInput value={qty} onValue={setQty} />
          </Field>
          <Field label="Ед.">
            <Select value={unit} onChange={(e) => setUnit(e.target.value)}>
              {STOCK_UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Минимум">
            <NumericInput value={minQty} onValue={setMinQty} />
          </Field>
        </div>
        <Field label="Заметка">
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Показывать в дневнике
        </label>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" type="button" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button
            type="button"
            onClick={() => {
              if (!name.trim()) return toast.error("Укажите название");
              onSave(
                {
                  groupId: groupId || groups[0]?.id || "",
                  name: name.trim(),
                  unit,
                  qty,
                  minQty,
                  note,
                  active,
                },
                item?.id,
              );
              onOpenChange(false);
            }}
          >
            Сохранить
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
