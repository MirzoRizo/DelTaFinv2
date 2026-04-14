// cashier/src/pages/POS.tsx
import { useState, useCallback, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, X, Plus, Minus, ShoppingCart, Banknote, CreditCard, CheckCircle, ScanLine, AlertTriangle, Printer } from "lucide-react";
import { searchProducts, getProductByBarcode, getProductByPlu } from "../db/queries/products";
import { completeSale } from "../db/queries/sales";
import { useCart } from "../store/cart";
import { useCashierSettings } from "../store/settings";
import { formatCurrency, formatNumber, debounce } from "../lib/utils";
import { parseWeightBarcode } from "../lib/barcode";
import { printReceipt, type ReceiptData } from "../lib/receipt";

export function POSPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [showPayment, setShowPayment] = useState(false);
  const [noPrice, setNoPrice] = useState<string | null>(null);
  const [lastReceipt, setLastReceipt] = useState<ReceiptData | null>(null);
  const [successSale, setSuccessSale] = useState<{ total: number; change: number } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const cart = useCart();
  const { settings, load } = useCashierSettings();

  useEffect(() => { load(); searchRef.current?.focus(); }, []);

  useEffect(() => {
    let buf = ""; let t = 0;
    async function handle(code: string) {
      const w = parseWeightBarcode(code);
      if (w) {
        const p = await getProductByPlu(w.plu);
        if (p) {
          const ex = cart.items.find((i) => i.id === p.id);
          if (ex) cart.updateQuantity(p.id, ex.quantity + w.weightKg);
          else { cart.addItem({ ...p, quantity: 999 }, true); cart.updateQuantity(p.id, w.weightKg); }
          return;
        }
      }
      const p = await getProductByBarcode(code);
      if (!p) return;
      const r = cart.addItem(p, settings.allowNegativeStock);
      if (r === "no_price") { setNoPrice(p.name); setTimeout(() => setNoPrice(null), 3000); }
    }
    function onKey(e: KeyboardEvent) {
      const now = Date.now(); if (now - t > 150) buf = ""; t = now;
      if (e.key === "Enter" && buf.length >= 4) { handle(buf); buf = ""; return; }
      if (e.key.length === 1) buf += e.key;
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [settings.allowNegativeStock, cart]);

  const dSet = useCallback(debounce((v: string) => setDebouncedSearch(v), 200), []);
  const { data: products = [] } = useQuery({ queryKey: ["search", debouncedSearch], queryFn: () => searchProducts(debouncedSearch) });

  function handleSuccess(receipt: ReceiptData) {
    setLastReceipt(receipt);
    setSuccessSale({ total: receipt.total, change: receipt.change });
    cart.clear(); setSearch(""); setDebouncedSearch("");
    qc.invalidateQueries({ queryKey: ["today-stats"] });
    qc.invalidateQueries({ queryKey: ["sales"] });
    if (settings.printOnSale) setTimeout(() => printReceipt(receipt), 400);
    setTimeout(() => { setSuccessSale(null); searchRef.current?.focus(); }, 3000);
  }

  const hasOver = cart.items.some((i) => i.overStock);

  return (
    <div className="flex h-full overflow-hidden" style={{ background: "var(--bg)" }}>
      {/* Левая */}
      <div className="flex-1 flex flex-col min-w-0" style={{ borderRight: "1px solid var(--border)" }}>
        <div className="p-3 flex-shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-3)" }} />
            <input ref={searchRef} type="text" value={search} onChange={(e) => { setSearch(e.target.value); dSet(e.target.value); }} placeholder="Поиск или штрих-код..." className="w-full pl-9 pr-8 py-2.5 rounded-xl text-sm outline-none transition-all" style={{ background: "var(--surface2)", border: "1px solid var(--border-md)", color: "var(--text-1)" }} />
            {search && <button onClick={() => { setSearch(""); setDebouncedSearch(""); searchRef.current?.focus(); }} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-3)" }}><X className="w-3.5 h-3.5" /></button>}
          </div>
          {noPrice && <div className="mt-2 text-xs px-3 py-1.5 rounded-lg" style={{ background: "var(--red-soft)", color: "var(--red)" }}>У товара «{noPrice}» не задана цена продажи</div>}
        </div>
        <div className="flex-1 overflow-auto p-3">
          {products.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center gap-2">
              <ScanLine className="w-10 h-10" style={{ color: "var(--text-4)" }} />
              <div className="text-sm" style={{ color: "var(--text-3)" }}>Начни вводить название</div>
              <div className="text-xs" style={{ color: "var(--text-4)" }}>или поднеси штрих-код к сканеру</div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {products.map((p) => {
                const inCart = cart.items.find((i) => i.id === p.id);
                const noSP = !p.sale_price; const noSt = p.quantity <= 0; const isW = p.barcode_type === "weight";
                return (
                  <button key={p.id} disabled={noSP || (noSt && !settings.allowNegativeStock) || isW}
                    onClick={() => { const r = cart.addItem(p, settings.allowNegativeStock); if (r === "no_price") { setNoPrice(p.name); setTimeout(() => setNoPrice(null), 3000); } }}
                    className="flex flex-col items-start p-3 rounded-xl text-left transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ border: `1px solid ${inCart ? "var(--accent-border)" : "var(--border-md)"}`, background: inCart ? "var(--accent-soft)" : "var(--surface)" }}
                    onMouseEnter={(e) => { if (!inCart && !noSP) e.currentTarget.style.background = "var(--surface2)"; }}
                    onMouseLeave={(e) => { if (!inCart) e.currentTarget.style.background = "var(--surface)"; }}>
                    <div className="flex items-start justify-between w-full mb-2 gap-1">
                      <div className="text-sm font-medium leading-tight line-clamp-2 flex-1" style={{ color: "var(--text-1)" }}>{p.name}</div>
                      {inCart && <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "var(--accent)" }}><span className="text-[10px] font-bold" style={{ color: "var(--accent-fg)" }}>{inCart.quantity}</span></div>}
                    </div>
                    <div className="flex items-end justify-between w-full">
                      {noSP ? <span className="text-xs" style={{ color: "var(--red)" }}>Нет цены</span> : isW ? <span className="text-xs" style={{ color: "var(--text-3)" }}>⚖ Через сканер</span> : <span className="text-sm font-semibold" style={{ color: "var(--accent)" }}>{formatCurrency(p.sale_price)}</span>}
                      <span className="text-xs font-mono flex items-center gap-1" style={{ color: noSt ? "var(--amber)" : "var(--text-4)" }}>
                        {noSt && <AlertTriangle className="w-3 h-3" />}
                        {formatNumber(p.quantity)} {p.unit_short_name ?? "шт"}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Правая — корзина */}
      <div className="w-[320px] flex-shrink-0 flex flex-col" style={{ background: "var(--surface)" }}>
        <div className="px-4 py-3 flex items-center justify-between flex-shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2"><ShoppingCart className="w-4 h-4" style={{ color: "var(--text-3)" }} /><span className="text-sm font-medium" style={{ color: "var(--text-2)" }}>Корзина</span></div>
          <div className="flex items-center gap-2">
            {lastReceipt && <button onClick={() => printReceipt(lastReceipt)} title="Перепечатать чек" className="p-1.5 rounded-lg" style={{ color: "var(--text-3)" }} onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface2)")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}><Printer className="w-4 h-4" /></button>}
            {cart.items.length > 0 && <button onClick={() => cart.clear()} className="text-xs font-mono" style={{ color: "var(--red)" }}>Очистить</button>}
          </div>
        </div>
        {hasOver && <div className="mx-3 mt-2 px-3 py-2 rounded-lg flex items-start gap-2 text-xs flex-shrink-0" style={{ background: "rgba(251,191,36,0.10)", border: "1px solid rgba(251,191,36,0.25)", color: "var(--amber)" }}><AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" /><span>Часть товаров продаётся сверх остатка</span></div>}
        <div className="flex-1 overflow-auto">
          {cart.items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-6"><ShoppingCart className="w-8 h-8 mb-2" style={{ color: "var(--text-4)" }} /><div className="text-sm" style={{ color: "var(--text-3)" }}>Корзина пуста</div></div>
          ) : <div className="p-2 space-y-0.5">{cart.items.map((item) => <CartRow key={item.id} item={item} />)}</div>}
        </div>
        {cart.items.length > 0 && (
          <div className="p-4 flex-shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
            <div className="flex items-baseline justify-between mb-3">
              <span className="text-sm" style={{ color: "var(--text-3)" }}>{cart.itemCount()} позиций</span>
              <span className="text-2xl font-bold" style={{ color: "var(--text-1)" }}>{formatCurrency(cart.total())}</span>
            </div>
            <button onClick={() => setShowPayment(true)} className="w-full py-3.5 rounded-xl font-bold text-base transition-colors active:opacity-90" style={{ background: "var(--accent)", color: "var(--accent-fg)" }}>
              Принять оплату
            </button>
          </div>
        )}
      </div>

      {showPayment && <PaymentModal total={cart.total()} items={cart.items} companyName={settings.companyName} paperWidth={settings.paperWidth} onClose={() => setShowPayment(false)} onSuccess={handleSuccess} />}

      {successSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.75)" }}>
          <div className="text-center px-8">
            <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: "var(--accent-soft)", border: "2px solid var(--accent)" }}><CheckCircle className="w-10 h-10" style={{ color: "var(--accent)" }} /></div>
            <div className="text-2xl font-bold mb-1" style={{ color: "var(--text-1)" }}>Оплачено</div>
            <div className="text-xl font-mono" style={{ color: "var(--accent)" }}>{formatCurrency(successSale.total)}</div>
            {successSale.change > 0 && <div className="text-sm mt-2" style={{ color: "var(--text-3)" }}>Сдача: <span className="font-semibold" style={{ color: "var(--text-1)" }}>{formatCurrency(successSale.change)}</span></div>}
            {settings.printOnSale && <div className="text-xs mt-3" style={{ color: "var(--text-4)" }}>🖨 Чек отправлен на печать</div>}
          </div>
        </div>
      )}
    </div>
  );
}

function CartRow({ item }: { item: ReturnType<typeof useCart>["items"][0] }) {
  const { updateQuantity, removeItem } = useCart();
  const isW = item.unit === "кг";
  return (
    <div className="flex items-center gap-2 px-2 py-2 rounded-lg group transition-colors" style={{ background: item.overStock ? "rgba(251,191,36,0.06)" : "transparent" }} onMouseEnter={(e) => (e.currentTarget.style.background = item.overStock ? "rgba(251,191,36,0.10)" : "var(--surface2)")} onMouseLeave={(e) => (e.currentTarget.style.background = item.overStock ? "rgba(251,191,36,0.06)" : "transparent")}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1"><span className="text-sm truncate" style={{ color: "var(--text-1)" }}>{item.name}</span>{item.overStock && <AlertTriangle className="w-3 h-3 flex-shrink-0" style={{ color: "var(--amber)" }} />}</div>
        <div className="text-xs font-mono mt-0.5" style={{ color: "var(--accent)" }}>{formatCurrency(item.price)}{isW ? "/кг" : ""}</div>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        {isW ? (
          <input type="number" min="0.001" step="0.001" value={item.quantity} onChange={(e) => updateQuantity(item.id, parseFloat(e.target.value) || 0)} className="w-16 px-2 py-1 rounded-lg text-sm text-right outline-none" style={{ background: "var(--surface2)", border: "1px solid var(--border-md)", color: "var(--text-1)" }} />
        ) : (
          <>
            <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: "var(--surface3)", color: "var(--text-2)" }}><Minus className="w-3 h-3" /></button>
            <span className="w-6 text-center text-sm font-mono" style={{ color: "var(--text-1)" }}>{item.quantity}</span>
            <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: "var(--surface3)", color: "var(--text-2)" }}><Plus className="w-3 h-3" /></button>
          </>
        )}
      </div>
      <div className="w-20 text-right text-sm font-mono flex-shrink-0" style={{ color: "var(--text-2)" }}>{formatCurrency(item.price * item.quantity)}</div>
      <button onClick={() => removeItem(item.id)} className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" style={{ color: "var(--red)" }}><X className="w-3.5 h-3.5" /></button>
    </div>
  );
}

function PaymentModal({ total, items, companyName, paperWidth, onClose, onSuccess }: {
  total: number; items: ReturnType<typeof useCart>["items"];
  companyName: string; paperWidth: 58 | 80;
  onClose: () => void; onSuccess: (r: ReceiptData) => void;
}) {
  const [method, setMethod] = useState<"cash" | "card">("cash");
  const [paidStr, setPaidStr] = useState("");
  const [printAfter, setPrintAfter] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const paid = parseFloat(paidStr) || 0;
  const change = Math.max(0, paid - total);
  const shortage = paid > 0 && paid < total ? total - paid : 0;
  const canPay = method === "card" || paid >= total;
  const rounds = [1000, 5000, 10000, 50000];
  const quick = Array.from(new Set([total, ...rounds.map((r) => Math.ceil(total / r) * r)])).filter((v) => v >= total).slice(0, 4);

  const mutation = useMutation({
    mutationFn: () => completeSale({ items, paid: method === "card" ? total : paid, paymentMethod: method }),
    onSuccess: (saleId) => {
      const receipt: ReceiptData = { saleId, companyName, items: items.map((i) => ({ name: i.name, quantity: i.quantity, price: i.price, total: i.price * i.quantity, unit: i.unit })), total, paid: method === "card" ? total : paid, change, paymentMethod: method, createdAt: Date.now(), paperWidth };
      if (printAfter) setTimeout(() => printReceipt(receipt), 300);
      onSuccess(receipt);
    },
    onError: (e) => setError((e as Error).message),
  });

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.65)" }} onClick={onClose} />
      <div className="relative rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl" style={{ background: "var(--surface)", border: "1px solid var(--border-md)" }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border)", background: "var(--surface2)" }}>
          <span className="text-base font-semibold" style={{ color: "var(--text-1)" }}>Оплата</span>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-lg" style={{ color: "var(--text-3)" }} onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface3)")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>×</button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div className="rounded-xl p-4 text-center" style={{ background: "var(--surface2)" }}>
            <div className="text-xs font-mono mb-1" style={{ color: "var(--text-3)" }}>К ОПЛАТЕ</div>
            <div className="text-3xl font-bold tabular-nums" style={{ color: "var(--text-1)" }}>{formatCurrency(total)}</div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {([{id:"cash",label:"Наличные",icon:Banknote},{id:"card",label:"Карта",icon:CreditCard}] as const).map(({id,label,icon:Icon}) => (
              <button key={id} onClick={() => { setMethod(id as "cash"|"card"); setError(""); }} className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all" style={{ border: `1px solid ${method===id?"var(--accent-border)":"var(--border-md)"}`, background: method===id?"var(--accent-soft)":"var(--surface2)", color: method===id?"var(--accent)":"var(--text-3)" }}><Icon className="w-4 h-4" />{label}</button>
            ))}
          </div>
          {method === "cash" && (
            <div className="space-y-2">
              <label className="block text-xs font-mono" style={{ color: "var(--text-3)" }}>Получено наличными</label>
              <input ref={inputRef} type="number" value={paidStr} onChange={(e) => { setPaidStr(e.target.value); setError(""); }} onKeyDown={(e) => e.key==="Enter"&&canPay&&mutation.mutate()} placeholder={formatNumber(total,0)} className="w-full px-4 py-3 rounded-xl text-xl font-mono text-right outline-none transition-all" style={{ background: "var(--surface2)", border: `1px solid ${shortage>0?"rgba(248,113,113,0.4)":canPay?"var(--accent-border)":"var(--border-md)"}`, color: "var(--text-1)" }} />
              <div className="flex gap-1.5">{quick.map((v) => <button key={v} onClick={() => setPaidStr(String(v))} className="flex-1 py-1.5 text-xs font-mono rounded-lg border transition-all" style={{ background: paid===v?"var(--accent-soft)":"var(--surface2)", borderColor: paid===v?"var(--accent-border)":"var(--border-md)", color: paid===v?"var(--accent)":"var(--text-3)" }}>{v>=1000?`${formatNumber(v/1000,0)}к`:formatNumber(v,0)}</button>)}</div>
              {canPay&&paid>0&&<div className="flex items-center justify-between px-4 py-2.5 rounded-xl" style={{ background:"var(--accent-soft)",border:"1px solid var(--accent-border)" }}><span className="text-sm" style={{color:"var(--text-2)"}}>Сдача</span><span className="text-lg font-bold tabular-nums" style={{color:"var(--accent)"}}>{formatCurrency(change)}</span></div>}
              {shortage>0&&<div className="flex items-center justify-between px-4 py-2.5 rounded-xl" style={{background:"var(--red-soft)",border:"1px solid rgba(248,113,113,0.25)"}}><span className="text-sm" style={{color:"var(--text-3)"}}>Не хватает</span><span className="text-sm font-semibold tabular-nums" style={{color:"var(--red)"}}>{formatCurrency(shortage)}</span></div>}
            </div>
          )}
          {error && <div className="text-xs font-mono text-center" style={{ color: "var(--red)" }}>{error}</div>}

          {/* Чекбокс печати */}
          <label className="flex items-center gap-2 cursor-pointer" onClick={() => setPrintAfter(!printAfter)}>
            <div className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-colors" style={{ background: printAfter ? "var(--accent)" : "var(--surface2)", border: `1px solid ${printAfter ? "var(--accent)" : "var(--border-md)"}` }}>
              {printAfter && <svg width="10" height="8" viewBox="0 0 10 8"><path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>}
            </div>
            <span className="text-sm flex items-center gap-1.5" style={{ color: "var(--text-2)" }}><Printer className="w-3.5 h-3.5" />Распечатать чек</span>
          </label>

          <button onClick={() => mutation.mutate()} disabled={!canPay || mutation.isPending} className="w-full py-4 rounded-xl font-bold text-base transition-all disabled:opacity-40 disabled:cursor-not-allowed" style={{ background: "var(--accent)", color: "var(--accent-fg)" }}>
            {mutation.isPending ? "Проводим..." : method==="card" ? "Картой — подтвердить" : "Принять"}
          </button>
        </div>
      </div>
    </div>
  );
}
