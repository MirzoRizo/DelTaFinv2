// src/pages/Categories.tsx
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Tags, Pencil, Trash2 } from "lucide-react";
import { getCategories, createCategory, updateCategory, deleteCategory } from "../db/queries/categories";
import type { Category } from "../db/queries/categories";
import { cn } from "../lib/utils";

const COLORS = [
  "#6366f1","#8b5cf6","#ec4899","#ef4444","#f97316",
  "#eab308","#22c55e","#10b981","#14b8a6","#3b82f6","#94a3b8",
];

export function CategoriesPage() {
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const qc = useQueryClient();

  const { data: cats = [], isLoading } = useQuery({ queryKey: ["categories"], queryFn: getCategories });

  const deleteMutation = useMutation({
    mutationFn: deleteCategory,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["categories"] }); qc.invalidateQueries({ queryKey: ["products"] }); },
  });

  function saved() { setShowModal(false); setEditing(null); qc.invalidateQueries({ queryKey: ["categories"] }); }

  return (
    <div className="p-8" style={{ background: "var(--bg)", minHeight: "100%" }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: "var(--text-1)" }}>Категории</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-3)" }}>{cats.length} категорий</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95"
          style={{ background: "var(--accent)", color: "var(--accent-fg)" }}>
          <Plus className="w-4 h-4" /> Добавить
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-3 gap-3">
          {Array.from({length:6}).map((_,i) => <div key={i} className="h-20 rounded-xl animate-pulse" style={{ background: "var(--surface2)" }} />)}
        </div>
      ) : cats.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Tags className="w-10 h-10" style={{ color: "var(--text-4)" }} />
          <div className="text-sm" style={{ color: "var(--text-3)" }}>Нет категорий</div>
          <div className="text-xs" style={{ color: "var(--text-4)" }}>Создай первую категорию для группировки товаров</div>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {cats.map((cat) => (
            <div key={cat.id} className="flex items-center justify-between p-4 rounded-xl group transition-colors"
              style={{ background: "var(--surface)", border: "1px solid var(--border-md)" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface2)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "var(--surface)")}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-semibold flex-shrink-0"
                  style={{ background: (cat.color ?? "#6366f1")+"20", color: cat.color ?? "#6366f1", border: `1px solid ${cat.color ?? "#6366f1"}30` }}>
                  {cat.name[0].toUpperCase()}
                </div>
                <div>
                  <div className="text-sm font-medium" style={{ color: "var(--text-1)" }}>{cat.name}</div>
                  <div className="text-xs font-mono mt-0.5" style={{ color: "var(--text-3)" }}>{cat.productCount} товаров</div>
                </div>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => setEditing(cat)} className="p-1.5 rounded-lg transition-colors"
                  style={{ color: "var(--text-3)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface3)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => {
                  if (cat.productCount > 0) { alert(`Нельзя удалить: ${cat.productCount} товаров`); return; }
                  if (confirm(`Удалить «${cat.name}»?`)) deleteMutation.mutate(cat.id);
                }} className="p-1.5 rounded-lg transition-colors"
                  style={{ color: "var(--red)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--red-soft)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {(showModal || editing) && (
        <CategoryModal category={editing ?? undefined} onClose={() => { setShowModal(false); setEditing(null); }} onSaved={saved} />
      )}
    </div>
  );
}

function CategoryModal({ category, onClose, onSaved }: { category?: Category; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!category;
  const [name, setName] = useState(category?.name ?? "");
  const [color, setColor] = useState(category?.color ?? COLORS[0]);
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Введи название");
      if (isEdit) await updateCategory(category!.id, { name: name.trim(), color });
      else await createCategory({ name: name.trim(), color });
    },
    onSuccess: onSaved,
    onError: (e) => setError((e as Error).message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 backdrop-blur-sm" style={{ background: "rgba(0,0,0,0.5)" }} onClick={onClose} />
      <div className="relative rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border-md)" }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid var(--border)", background: "var(--surface2)" }}>
          <h2 className="text-base font-semibold" style={{ color: "var(--text-1)" }}>{isEdit ? "Изменить" : "Новая категория"}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-xl"
            style={{ color: "var(--text-3)" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface3)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>×</button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-mono mb-1.5" style={{ color: "var(--text-3)" }}>Название *</label>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Электроника"
              className="w-full px-3 py-2.5 rounded-lg text-sm outline-none transition-all"
              style={{ background: "var(--surface2)", border: "1px solid var(--border-md)", color: "var(--text-1)" }} />
          </div>
          <div>
            <label className="block text-xs font-mono mb-2" style={{ color: "var(--text-3)" }}>Цвет</label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setColor(c)}
                  className={cn("w-7 h-7 rounded-lg transition-all", color === c ? "ring-2 ring-offset-2 scale-110" : "opacity-60 hover:opacity-100")}
                  style={{ background: c, ringColor: c, "--tw-ring-offset-color": "var(--surface)" } as React.CSSProperties} />
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-semibold"
              style={{ background: color+"20", color, border: `1px solid ${color}30` }}>
              {name ? name[0].toUpperCase() : "?"}
            </div>
            <span className="text-sm" style={{ color: "var(--text-2)" }}>{name || "Название"}</span>
          </div>
          {error && <div className="text-xs font-mono" style={{ color: "var(--red)" }}>{error}</div>}
          <div className="flex justify-end gap-3 pt-1" style={{ borderTop: "1px solid var(--border)" }}>
            <button onClick={onClose} className="px-4 py-2 text-sm" style={{ color: "var(--text-3)" }}>Отмена</button>
            <button onClick={() => mutation.mutate()} disabled={mutation.isPending}
              className="px-5 py-2.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-50 active:scale-95"
              style={{ background: "var(--accent)", color: "var(--accent-fg)" }}>
              {mutation.isPending ? "..." : isEdit ? "Сохранить" : "Создать"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
