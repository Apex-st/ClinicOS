import { Link } from "@tanstack/react-router";
import { ChipToggle } from "@/components/chip-toggle";
import { materialsForDiary } from "@/lib/stock";
import { useClinic } from "@/lib/store";

export function MaterialPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const items = useClinic((s) => s.stockItems);
  const groups = useClinic((s) => s.stockGroups);
  const buckets = materialsForDiary(items, groups);

  if (!items.some((m) => m.active)) {
    return (
      <p className="text-sm text-muted">
        Склад пуст.{" "}
        <Link to="/stock" className="text-primary">
          Добавить материалы
        </Link>
        — они появятся здесь кнопками.
      </p>
    );
  }

  function toggle(id: string) {
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  }

  return (
    <div className="flex min-w-0 flex-col gap-2">
      {buckets.map((g) => (
        <div key={g.id} className="min-w-0">
          <p className="mb-1 text-[12px] text-muted">{g.name}</p>
          <div className="flex flex-wrap gap-1.5">
            {g.items.map((m) => (
              <ChipToggle
                key={m.id}
                label={`${m.name}${m.qty <= m.minQty ? " · мало" : ""}`}
                on={value.includes(m.id)}
                onToggle={() => toggle(m.id)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
