// cashier/src/pages/ReturnPage.tsx
// Возврат товара — с чеком или без чека

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, RotateCcw, CheckCircle, AlertTriangle, Receipt, Package } from "lucide-react";
import { getSaleForReturn, createReturn, returnWithoutReceipt } from "../db/queries/shifts";
import type { SaleForReturn } from "../db/queries/shifts";
import { useShift } from "../store/shift";
import { formatCurrency, formatNumber, formatDate } from "../lib/utils";
import { NumericInput } from "../components/NumericInput";

// Читаем все активные товары для режима "без чека"
async function getActiveProducts() {
  const { getDb } = await import("../db/index");
  const db = await getDb();
  return db.select<{ id: string; name: string; sale_price: number; quantity: number; unit_short_name: string | null }[]>(
    `SELECT p.id, p.name, p.sale_price, p.quantity, u.short_name as unit_short_name
     FROM products p LEFT JOIN units u ON p.unit_id = u.id
     WHERE p.is_active = 1 ORDER BY p.name`,
    []
  );
}

export function ReturnPage() {
  const [mode, setMode] = useState<"receipt" | "noreceipt">("receipt");
  const [success, setSuccess] = useState(false);
  const qc = useQueryClient();

  function onSuccess() {
    setSuccess(true);
    qc.invalidateQueries({ queryKey: ["today-stats"] });
    qc.invalidateQueries({ queryKey: ["shift-stats"] });
    qc.invalidateQueries({ queryKey: ["products"] });
    setTimeout(() => setSuccess(false), 3000);
  }

  return (
    <div className="flex flex-col h-screen overflow-auto" style={{ background: "var(--bg)" }}>
      <div className="px-5 py-4 flex-shrink-0" style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)" }}>
        <div className="flex items-center gap-2 mb-3">
          <RotateCcw className="w-4 h-4" style={{ color: "var(--red)" }} />
          <h1 className="text-base font-semibold" style={{ color: "var(--text-1)" }}>Возврат товара</h1>
        </div>

        {/* Переключатель режима */}
        <div className="flex gap-1 p-1 rounded-xl w-full" style={{ background: "var(--surface2)", border: "1px solid var(--border-md)" }}>
          {([
            { id: "receipt",   label: "По чеку",     icon: Receipt  },
            { id: "noreceipt", label: "Без чека",     icon: Package  },
          ] as const).map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setMode(id)}
              className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-all"
              style={{
                background: mode === id ? "var(--surface)" : "transparent",
                color: mode === id ? "var(--text-1)" : "var(--text-3)",
                boxShadow: mode === id ? "0 1px 3px rgba(0,0,0,0.15)" : "none",
              }}>
              <Icon className="w-3.5 h-3.5" />{label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 space-y-4 flex-1">
        {success && (
          <div className="flex items-center gap-3 p-4 rounded-xl" style={{ background: "var(--accent-soft)", border: "1px solid var(--accent-border)" }}>
            <CheckCircle className="w-5 h-5 flex-shrink-0" style={{ color: "var(--accent)" }} />
            <div>
              <div className="text-sm font-semibold" style={{ color: "var(--accent)" }}>Возврат проведён</div>
              <div className="text-xs" style={{ color: "var(--text-3)" }}>Остатки на складе восстановлены</div>
            </div>
          </div>
        )}

        {mode === "receipt"
          ? <ReturnByReceipt onSuccess={onSuccess} />
          : <ReturnWithoutReceipt onSuccess={onSuccess} />
        }
      </div>
    </div>
  );
}

// ── Возврат по чеку ───────────────────────────────────────────

function ReturnByReceipt({ onSuccess }: { onSuccess: () => void }) {
  const [saleIdInput, setSaleIdInput] = useState("");
  const [sale, setSale] = useState<SaleForReturn | null>(null);
  const [searching, setSearching] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [returnQtys, setReturnQtys] = useState<Record<string, number>>({});
  const [reason, setReason] = useState("");
  const { currentShift } = useShift();

  async function handleSearch() {
    const id = saleIdInput.trim().toUpperCase();
    if (!id) return;
    setSearching(true); setNotFound(false); setSale(null);

    const { getDb } = await import("../db/index");
    const db = await getDb();
    const rows = await db.select<{ id: string }[]>(
      `SELECT id FROM sales WHERE UPPER(SUBSTR(id,1,8)) = ? OR id LIKE ? LIMIT 1`,
      [id, `${id.toLowerCase()}%`]
    );

    if (!rows[0]) { setNotFound(true); setSearching(false); return; }

    const data = await getSaleForReturn(rows[0].id);
    setSale(data);
    if (data) {
      const qtys: Record<string, number> = {};
      data.items.forEach((i) => { qtys[i.product_id] = 0; });
      setReturnQtys(qtys);
    } else { setNotFound(true); }
    setSearching(false);
  }

  const returnItems = sale?.items.filter((i) => (returnQtys[i.product_id] ?? 0) > 0) ?? [];
  const returnTotal = returnItems.reduce((s, i) => s + (returnQtys[i.product_id] ?? 0) * i.price, 0);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!sale || returnItems.length === 0) throw new Error("Выбери товары для возврата");
      await createReturn({
        saleId: sale.id,
        items: returnItems.map((i) => ({ productId: i.product_id, productName: i.product_name, quantity: returnQtys[i.product_id], price: i.price })),
        reason: reason.trim() || undefined,
        shiftId: currentShift?.id,
      });
    },
    onSuccess: () => { onSuccess(); setSale(null); setSaleIdInput(""); setReturnQtys({}); setReason(""); },
    onError: (e) => alert((e as Error).message),
  });

  const inpStyle: React.CSSProperties = { background: "var(--surface2)", border: "1px solid var(--border-md)", color: "var(--text-1)" };
  const inpCls = "w-full px-3 py-2.5 rounded-lg text-sm outline-none transition-all";

  return (
    <>
      <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border-md)" }}>
        <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border)", background: "var(--surface2)" }}>
          <span className="text-sm font-medium" style={{ color: "var(--text-2)" }}>Найти чек</span>
        </div>
        <div className="p-4 space-y-3" style={{ background: "var(--surface)" }}>
          <div className="flex gap-2">
            <input value={saleIdInput} onChange={(e) => setSaleIdInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Номер чека (8 символов)"
              className={inpCls + " flex-1"}
              style={{ ...inpStyle, fontFamily: "monospace", textTransform: "uppercase" }} />
            <button onClick={handleSearch} disabled={searching}
              className="px-4 py-2.5 rounded-lg text-sm font-medium transition-all disabled:opacity-50 flex items-center gap-2"
              style={{ background: "var(--accent)", color: "var(--accent-fg)" }}>
              <Search className="w-4 h-4" />{searching ? "..." : "Найти"}
            </button>
          </div>
          {notFound && (
            <div className="flex items-center gap-2 text-xs" style={{ color: "var(--red)" }}>
              <AlertTriangle className="w-3.5 h-3.5" /> Чек не найден
            </div>
          )}
        </div>
      </div>

      {sale && (
        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border-md)" }}>
          <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)", background: "var(--surface2)" }}>
            <span className="text-sm font-medium" style={{ color: "var(--text-2)" }}>Чек #{sale.id.slice(0,8).toUpperCase()}</span>
            <span className="text-xs font-mono" style={{ color: "var(--text-3)" }}>{formatDate(sale.created_at)}</span>
          </div>
          <div style={{ background: "var(--surface)" }}>
            {sale.items.map((item) => {
              const maxReturn = item.quantity - item.already_returned;
              const qty = returnQtys[item.product_id] ?? 0;
              return (
                <div key={item.id} className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm" style={{ color: "var(--text-1)" }}>{item.product_name}</div>
                    <div className="text-xs font-mono mt-0.5" style={{ color: "var(--text-3)" }}>
                      {formatNumber(item.quantity)} × {formatCurrency(item.price)}
                      {item.already_returned > 0 && <span style={{ color: "#fbbf24" }}> · возвр.: {formatNumber(item.already_returned)}</span>}
                    </div>
                  </div>
                  {maxReturn > 0 ? (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button onClick={() => setReturnQtys({ ...returnQtys, [item.product_id]: Math.max(0, qty - 1) })}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-lg font-bold"
                        style={{ background: "var(--surface2)", color: "var(--text-2)" }}>−</button>
                      <span className="w-6 text-center text-sm font-mono" style={{ color: qty > 0 ? "var(--red)" : "var(--text-3)" }}>{qty}</span>
                      <button onClick={() => setReturnQtys({ ...returnQtys, [item.product_id]: Math.min(maxReturn, qty + 1) })}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-lg font-bold"
                        style={{ background: "var(--surface2)", color: "var(--text-2)" }}>+</button>
                    </div>
                  ) : (
                    <span className="text-xs flex-shrink-0" style={{ color: "var(--text-4)" }}>Возвращён</span>
                  )}
                </div>
              );
            })}
            {returnTotal > 0 && (
              <div className="px-4 py-3 flex justify-between" style={{ borderBottom: "1px solid var(--border)", background: "var(--red-soft)" }}>
                <span className="text-sm" style={{ color: "var(--text-2)" }}>К возврату:</span>
                <span className="text-lg font-bold" style={{ color: "var(--red)" }}>{formatCurrency(returnTotal)}</span>
              </div>
            )}
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-mono mb-1.5" style={{ color: "var(--text-3)" }}>Причина</label>
                <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Брак, не подошёл..." className={inpCls} style={inpStyle} />
              </div>
              <button onClick={() => mutation.mutate()} disabled={returnItems.length === 0 || mutation.isPending}
                className="w-full py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-40"
                style={{ background: "var(--red)", color: "#fff" }}>
                {mutation.isPending ? "Проводим..." : `Оформить возврат · ${formatCurrency(returnTotal)}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Возврат без чека ──────────────────────────────────────────

function ReturnWithoutReceipt({ onSuccess }: { onSuccess: () => void }) {
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [price, setPrice] = useState(0);
  const [reason, setReason] = useState("");
  const { currentShift } = useShift();

  const { data: products = [] } = useQuery({ queryKey: ["all-products-return"], queryFn: getActiveProducts });
  const selected = products.find((p) => p.id === productId);

  // При выборе товара — подставляем его цену продажи
  function handleProductChange(id: string) {
    setProductId(id);
    const p = products.find((x) => x.id === id);
    if (p) setPrice(p.sale_price);
  }

  const mutation = useMutation({
    mutationFn: async () => {
      if (!productId) throw new Error("Выбери товар");
      if (quantity <= 0) throw new Error("Количество должно быть больше 0");
      if (price <= 0) throw new Error("Укажи цену для расчёта суммы возврата");
      await returnWithoutReceipt({
        productId,
        productName: selected?.name ?? "",
        quantity,
        price,
        reason: reason.trim() || undefined,
        shiftId: currentShift?.id,
      });
    },
    onSuccess: () => {
      onSuccess();
      setProductId(""); setQuantity(1); setPrice(0); setReason("");
    },
    onError: (e) => alert((e as Error).message),
  });

  const inpStyle: React.CSSProperties = { background: "var(--surface2)", border: "1px solid var(--border-md)", color: "var(--text-1)" };
  const inpCls = "w-full px-3 py-2.5 rounded-lg text-sm outline-none transition-all";

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border-md)" }}>
      <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border)", background: "var(--surface2)" }}>
        <span className="text-sm font-medium" style={{ color: "var(--text-2)" }}>Возврат без чека</span>
      </div>
      <div className="p-4 space-y-4" style={{ background: "var(--surface)" }}>
        <div className="p-3 rounded-xl text-xs" style={{ background: "rgba(251,191,36,0.10)", border: "1px solid rgba(251,191,36,0.25)", color: "#fbbf24" }}>
          ⚠ Используй только если чек недоступен. Остаток товара будет восстановлен.
        </div>

        <div>
          <label className="block text-xs font-mono mb-1.5" style={{ color: "var(--text-3)" }}>Товар *</label>
          <select value={productId} onChange={(e) => handleProductChange(e.target.value)}
            className={inpCls + " appearance-none"} style={inpStyle}>
            <option value="">— Выбери товар —</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          {selected && (
            <div className="text-xs mt-1 font-mono" style={{ color: "var(--text-3)" }}>
              Остаток: {formatNumber(selected.quantity)} {selected.unit_short_name ?? "шт"}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-mono mb-1.5" style={{ color: "var(--text-3)" }}>Количество *</label>
            <NumericInput value={quantity} onChange={setQuantity} min={0.001} step={0.001}
              className={inpCls} style={inpStyle}
              suffix={selected?.unit_short_name ?? "шт"} />
          </div>
          <div>
            <label className="block text-xs font-mono mb-1.5" style={{ color: "var(--text-3)" }}>Цена за единицу *</label>
            <NumericInput value={price} onChange={setPrice} min={0}
              className={inpCls} style={inpStyle} suffix="сум" />
          </div>
        </div>

        {quantity > 0 && price > 0 && (
          <div className="flex justify-between px-4 py-3 rounded-xl" style={{ background: "var(--red-soft)", border: "1px solid rgba(248,113,113,0.2)" }}>
            <span className="text-sm" style={{ color: "var(--text-2)" }}>Сумма возврата:</span>
            <span className="text-lg font-bold" style={{ color: "var(--red)" }}>{formatCurrency(quantity * price)}</span>
          </div>
        )}

        <div>
          <label className="block text-xs font-mono mb-1.5" style={{ color: "var(--text-3)" }}>Причина</label>
          <input value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder="Брак, неудовлетворительное качество..."
            className={inpCls} style={inpStyle} />
        </div>

        <button onClick={() => mutation.mutate()} disabled={!productId || quantity <= 0 || mutation.isPending}
          className="w-full py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-40"
          style={{ background: "var(--red)", color: "#fff" }}>
          {mutation.isPending ? "Проводим..." : "Оформить возврат"}
        </button>
      </div>
    </div>
  );
}
