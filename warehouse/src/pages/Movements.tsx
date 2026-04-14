// src/pages/Movements.tsx
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowDownToLine, ArrowUpFromLine, Clock } from "lucide-react";
import { getMovements, receiveStock, writeOffStock, adjustStock } from "../db/queries/movements";
import { getProducts } from "../db/queries/products";
import { formatCurrency, formatNumber, formatDate, cn } from "../lib/utils";
import { BarcodeScanner } from "../components/warehouse/BarcodeScanner";

export function MovementsPage() {
  const [tab, setTab] = useState<"history" | "receive" | "writeoff">("history");

  return (
    <div className="p-8" style={{ background: "var(--bg)", minHeight: "100%" }}>
      <div className="mb-5">
        <h1 className="text-xl font-semibold" style={{ color: "var(--text-1)" }}>Движения товаров</h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--text-3)" }}>Приём, списание и история</p>
      </div>

      {/* Табы */}
      <div className="flex gap-1 p-1 w-fit rounded-xl mb-6" style={{ background: "var(--surface2)", border: "1px solid var(--border-md)" }}>
        {([
          { id: "history",  label: "История",      icon: Clock },
          { id: "receive",  label: "Принять",       icon: ArrowDownToLine },
          { id: "writeoff", label: "Списать",       icon: ArrowUpFromLine },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all"
            style={{ background: tab === id ? "var(--surface)" : "transparent", color: tab === id ? "var(--text-1)" : "var(--text-3)", fontWeight: tab === id ? 500 : 400, boxShadow: tab === id ? "0 1px 3px rgba(0,0,0,0.15)" : "none" }}>
            <Icon className="w-3.5 h-3.5" />{label}
          </button>
        ))}
      </div>

      {tab === "history"  && <MovementsHistory />}
      {tab === "receive"  && <ReceiveForm  onDone={() => setTab("history")} />}
      {tab === "writeoff" && <WriteOffForm onDone={() => setTab("history")} />}
    </div>
  );
}

function MovementsHistory() {
  const [typeFilter, setTypeFilter] = useState("all");
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["movements", typeFilter],
    queryFn: () => getMovements({ type: typeFilter === "all" ? undefined : typeFilter, limit: 200 }),
  });

  const cfg: Record<string, { label: string; color: string; bg: string; sign: string }> = {
    in:         { label: "Приём",         color: "var(--accent)", bg: "var(--accent-soft)",          sign: "+" },
    out:        { label: "Списание",      color: "var(--red)",    bg: "var(--red-soft)",              sign: "−" },
    sale:       { label: "Продажа",       color: "#60a5fa",       bg: "rgba(96,165,250,0.1)",         sign: "−" },
    adjustment: { label: "Корректировка", color: "#fbbf24",       bg: "rgba(251,191,36,0.1)",         sign: "~" },
  };

  return (
    <div>
      <div className="flex gap-2 mb-4">
        {["all","in","out","adjustment"].map((t) => (
          <button key={t} onClick={() => setTypeFilter(t)}
            className="px-3 py-1.5 rounded-lg text-xs font-mono transition-all"
            style={{ background: typeFilter === t ? "var(--accent-soft)" : "var(--surface2)", border: `1px solid ${typeFilter === t ? "var(--accent-border)" : "var(--border-md)"}`, color: typeFilter === t ? "var(--accent)" : "var(--text-3)" }}>
            {t === "all" ? "Все" : cfg[t]?.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({length:8}).map((_,i) => <div key={i} className="h-14 rounded-xl animate-pulse" style={{ background: "var(--surface2)" }} />)}</div>
      ) : items.length === 0 ? (
        <div className="py-16 text-center text-sm" style={{ color: "var(--text-3)" }}>Движений пока нет</div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border-md)" }}>
          {items.map((item, idx) => {
            const c = cfg[item.type] ?? cfg.adjustment;
            return (
              <div key={item.id} className="grid items-center px-5 py-3.5 transition-colors"
                style={{ gridTemplateColumns: "auto 2fr 1fr 1fr 1fr", gap: "1rem", borderBottom: idx < items.length-1 ? "1px solid var(--border)" : "none", background: "var(--surface)" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface2)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "var(--surface)")}>
                <span className="text-xs px-2 py-0.5 rounded-full font-mono" style={{ color: c.color, background: c.bg }}>
                  {c.label}
                </span>
                <div>
                  <div className="text-sm truncate" style={{ color: "var(--text-1)" }}>{item.product_name}</div>
                  {item.note && <div className="text-xs truncate mt-0.5" style={{ color: "var(--text-4)" }}>{item.note}</div>}
                </div>
                <div className="text-sm font-mono font-medium" style={{ color: c.color }}>{c.sign}{formatNumber(item.quantity)}</div>
                <div className="text-sm" style={{ color: "var(--text-3)" }}>{item.price ? formatCurrency(item.price) : "—"}</div>
                <div className="text-xs font-mono" style={{ color: "var(--text-4)" }}>{formatDate(item.created_at)}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ReceiveForm({ onDone }: { onDone: () => void }) {
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [price, setPrice] = useState(0);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const qc = useQueryClient();

  const { data: allProducts = [] } = useQuery({ queryKey: ["products","","",false], queryFn: () => getProducts() });
  const selected = allProducts.find((p) => p.id === productId);

  const mutation = useMutation({
    mutationFn: () => {
      if (!productId) throw new Error("Выбери товар");
      if (quantity <= 0) throw new Error("Количество должно быть больше 0");
      return receiveStock({ productId, quantity, price: price || undefined, note: note.trim() || undefined });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["products"] }); qc.invalidateQueries({ queryKey: ["movements"] }); qc.invalidateQueries({ queryKey: ["product-stats"] }); onDone(); },
    onError: (e) => setError((e as Error).message),
  });

  function handleBarcode(code: string) {
    const found = allProducts.find((p) => p.barcode === code || p.sku === code);
    if (found) { setProductId(found.id); setError(""); } else setError(`Товар «${code}» не найден`);
  }

  const inpCls = "w-full px-3 py-2.5 rounded-lg text-sm outline-none transition-all";
  const inpStyle: React.CSSProperties = { background: "var(--surface2)", border: "1px solid var(--border-md)", color: "var(--text-1)" };

  return (
    <div className="max-w-md">
      <div className="rounded-2xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border-md)" }}>
        <div className="px-5 py-4 flex items-center gap-2" style={{ borderBottom: "1px solid var(--border)", background: "var(--surface2)" }}>
          <ArrowDownToLine className="w-4 h-4" style={{ color: "var(--accent)" }} />
          <span className="text-sm font-medium" style={{ color: "var(--text-1)" }}>Приём товара на склад</span>
        </div>
        <div className="p-5 space-y-4">
          <BarcodeScanner onScan={handleBarcode} />
          <div>
            <label className="block text-xs font-mono mb-1.5" style={{ color: "var(--text-3)" }}>Товар *</label>
            <select value={productId} onChange={(e) => setProductId(e.target.value)} className={inpCls + " appearance-none"} style={inpStyle}>
              <option value="">— Выбери товар —</option>
              {allProducts.map((p) => <option key={p.id} value={p.id}>{p.name}{p.sku ? ` (${p.sku})` : ""}</option>)}
            </select>
            {selected && <div className="text-xs mt-1 font-mono" style={{ color: "var(--text-4)" }}>Текущий остаток: {formatNumber(selected.quantity)} {selected.unit_short_name ?? "шт"}</div>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-mono mb-1.5" style={{ color: "var(--text-3)" }}>Количество *</label>
              <input type="number" min="0.001" step="any" value={quantity || ""} onFocus={(e) => { if (quantity === 0) e.target.value = ""; }} onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)} className={inpCls} style={inpStyle} />
            </div>
            <div>
              <label className="block text-xs font-mono mb-1.5" style={{ color: "var(--text-3)" }}>Себестоимость</label>
              <input type="number" min="0" value={price || ""} onFocus={(e) => { if (price === 0) e.target.value = ""; }} placeholder="0" onChange={(e) => setPrice(parseFloat(e.target.value) || 0)} className={inpCls} style={{ ...inpStyle, "::placeholder": { color: "var(--text-4)" } } as React.CSSProperties} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-mono mb-1.5" style={{ color: "var(--text-3)" }}>Примечание</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Поставщик, накладная №..." className={inpCls} style={inpStyle} />
          </div>
          {error && <div className="text-xs font-mono" style={{ color: "var(--red)" }}>{error}</div>}
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending}
            className="w-full py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-50"
            style={{ background: "var(--accent)", color: "var(--accent-fg)" }}>
            {mutation.isPending ? "Сохранение..." : "Принять на склад"}
          </button>
        </div>
      </div>
    </div>
  );
}

function WriteOffForm({ onDone }: { onDone: () => void }) {
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  const [isAdjust, setIsAdjust] = useState(false);
  const [error, setError] = useState("");
  const qc = useQueryClient();

  const { data: allProducts = [] } = useQuery({ queryKey: ["products","","",false], queryFn: () => getProducts() });
  const selected = allProducts.find((p) => p.id === productId);

  const mutation = useMutation({
    mutationFn: () => {
      if (!productId) throw new Error("Выбери товар");
      if (quantity <= 0) throw new Error("Количество должно быть больше 0");
      if (isAdjust) return adjustStock({ productId, newQuantity: quantity, note: note.trim() || undefined });
      return writeOffStock({ productId, quantity, note: note.trim() || undefined });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["products"] }); qc.invalidateQueries({ queryKey: ["movements"] }); qc.invalidateQueries({ queryKey: ["product-stats"] }); onDone(); },
    onError: (e) => setError((e as Error).message),
  });

  const inpCls = "w-full px-3 py-2.5 rounded-lg text-sm outline-none transition-all";
  const inpStyle: React.CSSProperties = { background: "var(--surface2)", border: "1px solid var(--border-md)", color: "var(--text-1)" };

  return (
    <div className="max-w-md">
      <div className="rounded-2xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border-md)" }}>
        <div className="px-5 py-4 flex items-center gap-2" style={{ borderBottom: "1px solid var(--border)", background: "var(--surface2)" }}>
          <ArrowUpFromLine className="w-4 h-4" style={{ color: "var(--red)" }} />
          <span className="text-sm font-medium" style={{ color: "var(--text-1)" }}>Списание / Корректировка</span>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex gap-2">
            {[{val:false,label:"Списание"},{val:true,label:"Корректировка"}].map(({val,label}) => (
              <button key={String(val)} onClick={() => setIsAdjust(val)}
                className="flex-1 py-2 text-xs rounded-lg transition-all"
                style={{ border: `1px solid ${isAdjust===val?"var(--accent-border)":"var(--border-md)"}`, background: isAdjust===val?"var(--accent-soft)":"var(--surface2)", color: isAdjust===val?"var(--accent)":"var(--text-3)" }}>
                {label}
              </button>
            ))}
          </div>
          <div>
            <label className="block text-xs font-mono mb-1.5" style={{ color: "var(--text-3)" }}>Товар *</label>
            <select value={productId} onChange={(e) => setProductId(e.target.value)} className={inpCls + " appearance-none"} style={inpStyle}>
              <option value="">— Выбери товар —</option>
              {allProducts.map((p) => <option key={p.id} value={p.id}>{p.name} — {formatNumber(p.quantity)} {p.unit_short_name ?? "шт"}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-mono mb-1.5" style={{ color: "var(--text-3)" }}>
              {isAdjust ? "Фактический остаток *" : "Количество к списанию *"}
            </label>
            <input type="number" min="0" step="any" value={quantity || ""} onFocus={(e) => { if (quantity===0) e.target.value=""; }} onChange={(e) => setQuantity(parseFloat(e.target.value)||0)} className={inpCls} style={inpStyle} />
            {isAdjust && selected && (
              <div className="text-xs mt-1 font-mono" style={{ color: "var(--text-4)" }}>
                {selected.quantity} → {quantity} ({quantity>=selected.quantity?"+":""}{formatNumber(quantity-selected.quantity)})
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs font-mono mb-1.5" style={{ color: "var(--text-3)" }}>Причина</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={isAdjust?"Результат инвентаризации":"Брак, утеря..."} className={inpCls} style={inpStyle} />
          </div>
          {error && <div className="text-xs font-mono" style={{ color: "var(--red)" }}>{error}</div>}
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending}
            className="w-full py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-50"
            style={{ background: "var(--red)", color: "#fff" }}>
            {mutation.isPending ? "Сохранение..." : isAdjust ? "Скорректировать" : "Списать"}
          </button>
        </div>
      </div>
    </div>
  );
}
