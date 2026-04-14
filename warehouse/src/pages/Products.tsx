// src/pages/Products.tsx — с типами товаров и NumericInput
import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, AlertTriangle, Package, ChevronDown, RefreshCw } from "lucide-react";
import { getProducts, createProduct, updateProduct, deactivateProduct, getMaxPluCode } from "../db/queries/products";
import type { ProductWithRelations, CreateProductData } from "../db/queries/products";
import { getCategories } from "../db/queries/categories";
import { formatCurrency, formatNumber, debounce, cn } from "../lib/utils";
import { generateInternalBarcode, generateWeightBarcode, BARCODE_TYPE_LABELS, type BarcodeType } from "../lib/barcode";
import { NumericInput } from "../components/ui/NumericInput";

export function ProductsPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebounced] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [editingProduct, setEditing] = useState<ProductWithRelations | null>(null);
  const [showAddModal, setShowAdd] = useState(false);
  const qc = useQueryClient();

  const debouncedSet = useCallback(debounce((v: string) => setDebounced(v), 280), []);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products", debouncedSearch, categoryId, lowStockOnly],
    queryFn: () => getProducts({ search: debouncedSearch || undefined, categoryId: categoryId || undefined, lowStock: lowStockOnly || undefined }),
  });
  const { data: categories = [] } = useQuery({ queryKey: ["categories"], queryFn: getCategories });

  const deactivateMutation = useMutation({
    mutationFn: deactivateProduct,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["products"] }); qc.invalidateQueries({ queryKey: ["product-stats"] }); },
  });

  function onSaved() {
    setShowAdd(false); setEditing(null);
    qc.invalidateQueries({ queryKey: ["products"] });
    qc.invalidateQueries({ queryKey: ["product-stats"] });
  }

  const inp: React.CSSProperties = { background: "var(--surface2)", border: "1px solid var(--border-md)", color: "var(--text-1)" };

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--bg)" }}>
      <div className="px-6 pt-5 pb-4 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-semibold" style={{ color: "var(--text-1)" }}>Товары</h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-3)" }}>{isLoading ? "Загрузка..." : `${products.length} позиций`}</p>
          </div>
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95" style={{ background: "var(--accent)", color: "var(--accent-fg)" }}>
            <Plus className="w-4 h-4" /> Добавить
          </button>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-3)" }} />
            <input type="text" placeholder="Поиск..." value={search} onChange={(e) => { setSearch(e.target.value); debouncedSet(e.target.value); }} className="w-full pl-9 pr-3 py-2 rounded-lg text-sm outline-none transition-all" style={inp} />
          </div>
          <div className="relative">
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="pl-3 pr-7 py-2 rounded-lg text-sm outline-none appearance-none cursor-pointer" style={{ ...inp, color: categoryId ? "var(--text-1)" : "var(--text-3)" }}>
              <option value="">Все категории</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={{ color: "var(--text-3)" }} />
          </div>
          <button onClick={() => setLowStockOnly(!lowStockOnly)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-all" style={{ background: lowStockOnly ? "var(--red-soft)" : "var(--surface2)", border: `1px solid ${lowStockOnly ? "rgba(248,113,113,0.3)" : "var(--border-md)"}`, color: lowStockOnly ? "var(--red)" : "var(--text-3)" }}>
            <AlertTriangle className="w-3.5 h-3.5" /> Мало
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-6 pb-6">
        {isLoading ? (
          <div className="space-y-1">{Array.from({length:8}).map((_,i) => <div key={i} className="h-12 rounded-lg animate-pulse" style={{ background: "var(--surface2)" }} />)}</div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-2"><Package className="w-10 h-10" style={{ color: "var(--text-4)" }} /><div className="text-sm" style={{ color: "var(--text-3)" }}>Товары не найдены</div></div>
        ) : (
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border-md)" }}>
            <div className="grid text-xs font-mono uppercase tracking-wider px-4 py-2.5" style={{ gridTemplateColumns: "2.5fr 1fr 1fr 1fr 1fr 80px", background: "var(--surface2)", color: "var(--text-3)", borderBottom: "1px solid var(--border)" }}>
              {["Товар","Штрих-код","Категория","Остаток","Цена",""].map((h) => <div key={h}>{h}</div>)}
            </div>
            {products.map((p, idx) => {
              const isLow = p.min_quantity > 0 && p.quantity <= p.min_quantity;
              const isNeg = p.quantity < 0;
              const barcodeLabel = p.barcode_type === "weight" ? `PLU ${p.plu_code}` : (p.barcode ?? p.sku ?? "—");
              return (
                <div key={p.id} className="grid items-center px-4 py-3 group transition-colors cursor-default" style={{ gridTemplateColumns: "2.5fr 1fr 1fr 1fr 1fr 80px", borderBottom: idx < products.length-1 ? "1px solid var(--border)" : "none", background: "var(--surface)" }} onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface2)")} onMouseLeave={(e) => (e.currentTarget.style.background = "var(--surface)")}>
                  <div className="min-w-0 pr-3">
                    <div className="text-sm font-medium truncate" style={{ color: "var(--text-1)" }}>{p.name}</div>
                    {p.barcode_type !== "standard" && <div className="text-xs mt-0.5" style={{ color: "var(--text-4)" }}>{p.barcode_type === "weight" ? "⚖ Весовой" : "🏷 Внутренний"}</div>}
                  </div>
                  <div className="text-xs font-mono truncate" style={{ color: "var(--text-3)" }}>{barcodeLabel}</div>
                  <div>{p.category_name ? <span className="text-xs px-2 py-0.5 rounded-full" style={{ color: p.category_color ?? "#6366f1", background: (p.category_color ?? "#6366f1")+"18", border: `1px solid ${p.category_color ?? "#6366f1"}30` }}>{p.category_name}</span> : <span style={{ color: "var(--text-4)" }}>—</span>}</div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium tabular-nums" style={{ color: isNeg ? "var(--red)" : isLow ? "#f59e0b" : "var(--text-1)" }}>{formatNumber(p.quantity)}</span>
                    <span className="text-xs" style={{ color: "var(--text-4)" }}>{p.unit_short_name ?? "шт"}</span>
                    {(isLow || isNeg) && <AlertTriangle className="w-3 h-3 flex-shrink-0" style={{ color: isNeg ? "var(--red)" : "#f59e0b" }} />}
                  </div>
                  <div className="text-sm tabular-nums" style={{ color: "var(--text-2)" }}>{p.sale_price ? formatCurrency(p.sale_price) : <span style={{ color: "var(--text-4)" }}>—</span>}</div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => setEditing(p)} className="px-2 py-1 rounded text-xs" style={{ color: "var(--text-2)" }} onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface3)")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>Изм.</button>
                    <button onClick={() => { if (confirm(`Убрать «${p.name}»?`)) deactivateMutation.mutate(p.id); }} className="px-2 py-1 rounded text-xs" style={{ color: "var(--red)" }} onMouseEnter={(e) => (e.currentTarget.style.background = "var(--red-soft)")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>Удал.</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {showAddModal && <ProductModal onClose={() => setShowAdd(false)} onSaved={onSaved} />}
      {editingProduct && <ProductModal product={editingProduct} onClose={() => setEditing(null)} onSaved={onSaved} />}
    </div>
  );
}

function ProductModal({ product, onClose, onSaved }: { product?: ProductWithRelations; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!product;
  const [barcodeType, setBarcodeType] = useState<BarcodeType>(product?.barcode_type ?? "standard");
  const [form, setForm] = useState<CreateProductData>({
    name: product?.name ?? "", sku: product?.sku ?? "", barcode: product?.barcode ?? "",
    cost_price: product?.cost_price ?? 0, sale_price: product?.sale_price ?? 0,
    quantity: product?.quantity ?? 0, min_quantity: product?.min_quantity ?? 0,
    unit_id: product?.unit_id ?? "unit-pcs", category_id: product?.category_id ?? "",
    barcode_type: product?.barcode_type ?? "standard", plu_code: product?.plu_code ?? null,
  });
  const [nameError, setNameError] = useState("");
  const { data: categories = [] } = useQuery({ queryKey: ["categories"], queryFn: getCategories });

  async function handleBarcodeTypeChange(type: BarcodeType) {
    setBarcodeType(type);
    if (type === "internal") {
      setForm((f) => ({ ...f, barcode_type: type, barcode: generateInternalBarcode(), plu_code: null }));
    } else if (type === "weight") {
      const maxPlu = await getMaxPluCode();
      const plu = maxPlu + 1;
      setForm((f) => ({ ...f, barcode_type: type, plu_code: plu, barcode: generateWeightBarcode(plu), unit_id: "unit-kg" }));
    } else {
      setForm((f) => ({ ...f, barcode_type: type, plu_code: null }));
    }
  }

  const mutation = useMutation({
    mutationFn: async () => {
      if (!form.name?.trim()) { setNameError("Название обязательно"); throw new Error("validate"); }
      const data = { ...form, name: form.name.trim(), sku: form.sku?.trim() || null, barcode: form.barcode?.trim() || null, category_id: form.category_id || null, barcode_type: barcodeType };
      if (isEdit) await updateProduct(product!.id, data); else await createProduct(data);
    },
    onSuccess: onSaved,
    onError: (e) => { if ((e as Error).message !== "validate") alert((e as Error).message); },
  });

  const inpStyle: React.CSSProperties = { background: "var(--surface2)", border: "1px solid var(--border-md)", color: "var(--text-1)" };
  const inpCls = "w-full px-3 py-2.5 rounded-lg text-sm outline-none transition-all";
  const lbl = "block text-xs font-mono mb-1.5";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 backdrop-blur-sm" style={{ background: "rgba(0,0,0,0.55)" }} onClick={onClose} />
      <div className="relative rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[90vh] flex flex-col" style={{ background: "var(--surface)", border: "1px solid var(--border-md)" }}>
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ borderBottom: "1px solid var(--border)", background: "var(--surface2)" }}>
          <h2 className="text-base font-semibold" style={{ color: "var(--text-1)" }}>{isEdit ? "Редактировать" : "Новый товар"}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-xl" style={{ color: "var(--text-3)" }} onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface3)")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>×</button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }} className="overflow-auto">
          <div className="px-6 py-5 space-y-4">
            <div>
              <label className={lbl} style={{ color: "var(--text-3)" }}>Название *</label>
              <input autoFocus value={form.name ?? ""} onChange={(e) => { setForm({ ...form, name: e.target.value }); setNameError(""); }} placeholder="Молоко 1л" className={inpCls} style={{ ...inpStyle, borderColor: nameError ? "var(--red)" : "var(--border-md)" }} />
              {nameError && <div className="text-xs mt-1" style={{ color: "var(--red)" }}>{nameError}</div>}
            </div>

            <div>
              <label className={lbl} style={{ color: "var(--text-3)" }}>Тип товара</label>
              <div className="grid grid-cols-3 gap-2">
                {(["standard","internal","weight"] as BarcodeType[]).map((type) => (
                  <button key={type} type="button" onClick={() => handleBarcodeTypeChange(type)} className="px-2 py-3 rounded-xl text-xs font-medium text-center transition-all leading-tight" style={{ border: `1px solid ${barcodeType === type ? "var(--accent-border)" : "var(--border-md)"}`, background: barcodeType === type ? "var(--accent-soft)" : "var(--surface2)", color: barcodeType === type ? "var(--accent)" : "var(--text-3)" }}>
                    <div className="text-lg mb-1">{type === "standard" ? "📦" : type === "internal" ? "🏷" : "⚖"}</div>
                    {type === "standard" ? "Готовый" : type === "internal" ? "Внутренний" : "Весовой"}
                  </button>
                ))}
              </div>
              <div className="text-xs mt-1.5 px-1" style={{ color: "var(--text-4)" }}>
                {barcodeType === "standard" && "Сканируй EAN-13 с упаковки"}
                {barcodeType === "internal" && "Штрих-код генерируется автоматически (префикс 200). Распечатай ценник."}
                {barcodeType === "weight" && "Весы печатают штрих-код с весом. PLU — номер для программирования весов."}
              </div>
            </div>

            {barcodeType === "weight" ? (
              <div className="grid grid-cols-2 gap-3">
                <div><label className={lbl} style={{ color: "var(--text-3)" }}>PLU код</label><input value={form.plu_code ?? ""} readOnly className={inpCls} style={{ ...inpStyle, color: "var(--accent)", fontFamily: "monospace", fontWeight: 600 }} /></div>
                <div><label className={lbl} style={{ color: "var(--text-3)" }}>Штрих-код весов</label><input value={form.barcode ?? ""} readOnly className={inpCls} style={{ ...inpStyle, fontSize: "11px", fontFamily: "monospace" }} /></div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl} style={{ color: "var(--text-3)" }}>{barcodeType === "internal" ? "Штрих-код (авто)" : "Штрих-код EAN-13"}</label>
                  <div className="relative">
                    <input value={form.barcode ?? ""} readOnly={barcodeType === "internal"} onChange={(e) => setForm({ ...form, barcode: e.target.value })} placeholder="4607196..." className={inpCls + (barcodeType === "internal" ? " pr-10" : "")} style={{ ...inpStyle, fontFamily: "monospace", fontSize: "12px" }} />
                    {barcodeType === "internal" && <button type="button" onClick={() => setForm((f) => ({ ...f, barcode: generateInternalBarcode() }))} className="absolute right-2.5 top-1/2 -translate-y-1/2" title="Перегенерировать" style={{ color: "var(--text-3)" }}><RefreshCw className="w-4 h-4" /></button>}
                  </div>
                </div>
                <div><label className={lbl} style={{ color: "var(--text-3)" }}>Артикул (SKU)</label><input value={form.sku ?? ""} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="LP-001" className={inpCls} style={inpStyle} /></div>
              </div>
            )}

            <div>
              <label className={lbl} style={{ color: "var(--text-3)" }}>Категория</label>
              <select value={form.category_id ?? ""} onChange={(e) => setForm({ ...form, category_id: e.target.value || null })} className={inpCls + " appearance-none cursor-pointer"} style={inpStyle}>
                <option value="">— Без категории —</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div><label className={lbl} style={{ color: "var(--text-3)" }}>Себестоимость</label><NumericInput value={form.cost_price ?? 0} onChange={(v) => setForm({ ...form, cost_price: v })} className={inpCls} style={inpStyle} suffix="сум" /></div>
              <div><label className={lbl} style={{ color: "var(--text-3)" }}>Цена продажи</label><NumericInput value={form.sale_price ?? 0} onChange={(v) => setForm({ ...form, sale_price: v })} className={inpCls} style={inpStyle} suffix="сум" /></div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl} style={{ color: "var(--text-3)" }}>Начальный остаток <span className="font-sans normal-case" style={{ color: "var(--text-4)" }}>— сколько есть</span></label>
                <NumericInput value={form.quantity ?? 0} onChange={(v) => setForm({ ...form, quantity: v })} className={inpCls} style={inpStyle} suffix={barcodeType === "weight" ? "кг" : "шт"} />
              </div>
              <div>
                <label className={lbl} style={{ color: "var(--text-3)" }}>Мин. остаток <span className="font-sans normal-case" style={{ color: "var(--text-4)" }}>— порог ⚠</span></label>
                <NumericInput value={form.min_quantity ?? 0} min={0} onChange={(v) => setForm({ ...form, min_quantity: v })} className={inpCls} style={inpStyle} suffix={barcodeType === "weight" ? "кг" : "шт"} />
              </div>
            </div>
          </div>
          <div className="flex items-center justify-end gap-3 px-6 py-4 flex-shrink-0" style={{ borderTop: "1px solid var(--border)", background: "var(--surface2)" }}>
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg" style={{ color: "var(--text-3)" }}>Отмена</button>
            <button type="submit" disabled={mutation.isPending} className="px-5 py-2.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-50 active:scale-95" style={{ background: "var(--accent)", color: "var(--accent-fg)" }}>
              {mutation.isPending ? "Сохранение..." : isEdit ? "Сохранить" : "Добавить"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
