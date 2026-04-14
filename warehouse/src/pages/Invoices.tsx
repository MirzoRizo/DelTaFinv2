// src/pages/Invoices.tsx — Накладные (приём товара)
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, ChevronDown, ChevronUp, Truck, CreditCard, Banknote, ArrowUpRight, X, Search } from "lucide-react";
import { getInvoices, createInvoice, payInvoiceDebt, getDebtsBySupplier } from "../db/queries/invoices";
import type { CreateInvoiceData, PaymentStatus, PaymentMethod } from "../db/queries/invoices";
import { getSuppliers, createSupplier } from "../db/queries/suppliers";
import { getProducts } from "../db/queries/products";
import { formatCurrency, formatNumber, formatDate, cn, generateId } from "../lib/utils";
import { NumericInput } from "../components/ui/NumericInput";

export function InvoicesPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data: invoices = [], isLoading } = useQuery({ queryKey: ["invoices"], queryFn: () => getInvoices(100) });
  const { data: debts = [] } = useQuery({ queryKey: ["debts"], queryFn: getDebtsBySupplier });

  const totalDebt = debts.reduce((s, d) => s + d.total_debt, 0);

  const payMutation = useMutation({
    mutationFn: ({ id, amount }: { id: string; amount: number }) => payInvoiceDebt(id, amount),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["invoices"] }); qc.invalidateQueries({ queryKey: ["debts"] }); },
  });

  const statusConfig: Record<PaymentStatus, { label: string; color: string; bg: string }> = {
    paid:    { label: "Оплачено",     color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
    debt:    { label: "В долг",       color: "text-red-400",     bg: "bg-red-500/10 border-red-500/20" },
    partial: { label: "Частично",     color: "text-amber-400",   bg: "bg-amber-500/10 border-amber-500/20" },
  };

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--bg)" }}>
      <div className="px-6 pt-5 pb-4 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-semibold" style={{ color: "var(--text-1)" }}>Накладные</h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-3)" }}>{invoices.length} накладных</p>
          </div>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95"
            style={{ background: "var(--accent)", color: "var(--accent-fg)" }}>
            <Plus className="w-4 h-4" /> Новая накладная
          </button>
        </div>

        {/* Долги */}
        {debts.length > 0 && (
          <div className="rounded-xl p-4 mb-4" style={{ background: "var(--red-soft)", border: "1px solid rgba(248,113,113,0.2)" }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium" style={{ color: "var(--red)" }}>Общий долг поставщикам</span>
              <span className="text-lg font-bold" style={{ color: "var(--red)" }}>{formatCurrency(totalDebt)}</span>
            </div>
            <div className="space-y-1">
              {debts.map((d, i) => (
                <div key={i} className="flex justify-between text-xs" style={{ color: "var(--text-3)" }}>
                  <span>{d.supplier_name}</span>
                  <span className="font-mono">{formatCurrency(d.total_debt)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto px-6 pb-6">
        {isLoading ? (
          <div className="space-y-2">{Array.from({length:5}).map((_,i) => <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: "var(--surface2)" }} />)}</div>
        ) : invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-2">
            <Truck className="w-10 h-10" style={{ color: "var(--text-4)" }} />
            <div className="text-sm" style={{ color: "var(--text-3)" }}>Накладных пока нет</div>
          </div>
        ) : (
          <div className="space-y-2">
            {invoices.map((inv) => {
              const cfg = statusConfig[inv.payment_status];
              const isExpanded = expandedId === inv.id;
              return (
                <div key={inv.id} className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border-md)" }}>
                  <button onClick={() => setExpandedId(isExpanded ? null : inv.id)}
                    className="w-full flex items-center gap-3 px-4 py-3.5 transition-colors text-left"
                    style={{ background: "var(--surface)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface2)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "var(--surface)")}>
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
                      <Truck className="w-4 h-4" style={{ color: "var(--text-3)" }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium" style={{ color: "var(--text-1)" }}>{inv.supplier_name}</span>
                        {inv.invoice_number && <span className="text-xs font-mono" style={{ color: "var(--text-3)" }}>№{inv.invoice_number}</span>}
                        <span className={cn("text-xs px-2 py-0.5 rounded-full border font-mono", cfg.bg, cfg.color)}>{cfg.label}</span>
                      </div>
                      <div className="text-xs mt-0.5" style={{ color: "var(--text-3)" }}>{formatDate(inv.created_at)} · {inv.item_count} позиций</div>
                    </div>
                    <div className="text-right flex-shrink-0 mr-2">
                      <div className="text-sm font-bold" style={{ color: "var(--text-1)" }}>{formatCurrency(inv.total)}</div>
                      {inv.payment_status !== "paid" && (
                        <div className="text-xs" style={{ color: "var(--red)" }}>долг: {formatCurrency(inv.total - inv.paid_amount)}</div>
                      )}
                    </div>
                    {isExpanded ? <ChevronUp className="w-4 h-4 flex-shrink-0" style={{ color: "var(--text-3)" }} /> : <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color: "var(--text-3)" }} />}
                  </button>

                  {isExpanded && (
                    <div style={{ borderTop: "1px solid var(--border)", background: "var(--surface2)" }}>
                      <InvoiceDetail invoiceId={inv.id} onPay={(amount) => payMutation.mutate({ id: inv.id, amount })} canPay={inv.payment_status !== "paid"} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showCreate && <CreateInvoiceModal onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); qc.invalidateQueries({ queryKey: ["invoices"] }); qc.invalidateQueries({ queryKey: ["debts"] }); qc.invalidateQueries({ queryKey: ["products"] }); }} />}
    </div>
  );
}

// ── Детали накладной ─────────────────────────────────────────

function InvoiceDetail({ invoiceId, onPay, canPay }: { invoiceId: string; onPay: (amount: number) => void; canPay: boolean }) {
  const { data: inv } = useQuery({ queryKey: ["invoice", invoiceId], queryFn: async () => { const { getInvoiceById } = await import("../db/queries/invoices"); return getInvoiceById(invoiceId); } });
  const [payAmount, setPayAmount] = useState(0);

  if (!inv) return <div className="p-4 text-xs" style={{ color: "var(--text-3)" }}>Загрузка...</div>;

  return (
    <div>
      {inv.items.map((item) => (
        <div key={item.id} className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="text-sm" style={{ color: "var(--text-1)" }}>{item.product_name}</div>
          <div className="flex items-center gap-4 text-xs font-mono" style={{ color: "var(--text-3)" }}>
            <span>{formatNumber(item.quantity)} × {formatCurrency(item.price)}</span>
            <span className="w-24 text-right" style={{ color: "var(--text-2)" }}>{formatCurrency(item.total)}</span>
          </div>
        </div>
      ))}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: canPay ? "1px solid var(--border)" : "none" }}>
        <div className="text-xs" style={{ color: "var(--text-3)" }}>
          {inv.notes && <div>Примечание: {inv.notes}</div>}
          <div>Метод: {inv.payment_method === "cash" ? "Наличные" : inv.payment_method === "card" ? "Карта" : "Перевод"}</div>
        </div>
        <div className="text-base font-bold" style={{ color: "var(--text-1)" }}>{formatCurrency(inv.total)}</div>
      </div>
      {canPay && (
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="text-sm" style={{ color: "var(--text-2)" }}>Оплатить долг:</div>
          <div className="flex-1">
            <NumericInput value={payAmount} onChange={setPayAmount} min={0} className="w-full px-3 py-1.5 rounded-lg text-sm outline-none" style={{ background: "var(--surface)", border: "1px solid var(--border-md)", color: "var(--text-1)" }} suffix="сум" />
          </div>
          <button onClick={() => { if (payAmount > 0) { onPay(payAmount); setPayAmount(0); } }}
            className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all"
            style={{ background: "var(--accent)", color: "var(--accent-fg)" }}>
            Оплатить
          </button>
        </div>
      )}
    </div>
  );
}

// ── Создание накладной ────────────────────────────────────────

interface InvoiceLineItem { tempId: string; product_id: string; product_name: string; quantity: number; price: number; }

function CreateInvoiceModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [supplierName, setSupplierName] = useState("");
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("paid");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [paidAmount, setPaidAmount] = useState(0);
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<InvoiceLineItem[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [error, setError] = useState("");

  const { data: suppliers = [] } = useQuery({ queryKey: ["suppliers"], queryFn: getSuppliers });
  const { data: allProducts = [] } = useQuery({ queryKey: ["products", "", undefined, false], queryFn: () => getProducts() });

  const filteredProducts = allProducts.filter((p) =>
    !productSearch || p.name.toLowerCase().includes(productSearch.toLowerCase()) || p.sku?.includes(productSearch)
  ).slice(0, 20);

  const total = lines.reduce((s, l) => s + l.quantity * l.price, 0);

  function addLine(product: typeof allProducts[0]) {
    const existing = lines.find((l) => l.product_id === product.id);
    if (existing) {
      setLines(lines.map((l) => l.product_id === product.id ? { ...l, quantity: l.quantity + 1 } : l));
    } else {
      setLines([...lines, { tempId: generateId(), product_id: product.id, product_name: product.name, quantity: 1, price: product.cost_price }]);
    }
    setProductSearch(""); setShowProductSearch(false);
  }

  function removeLine(tempId: string) { setLines(lines.filter((l) => l.tempId !== tempId)); }
  function updateLine(tempId: string, field: "quantity" | "price", value: number) {
    setLines(lines.map((l) => l.tempId === tempId ? { ...l, [field]: value } : l));
  }

  const mutation = useMutation({
    mutationFn: async () => {
      if (!supplierName.trim()) throw new Error("Укажи поставщика");
      if (lines.length === 0) throw new Error("Добавь хотя бы один товар");
      for (const l of lines) {
        if (l.quantity <= 0) throw new Error(`Количество должно быть > 0`);
        if (l.price <= 0) throw new Error(`Укажи цену для «${l.product_name}»`);
      }

      let resolvedSupplierId = supplierId;
      if (!resolvedSupplierId) {
        const existing = suppliers.find((s) => s.name.toLowerCase() === supplierName.toLowerCase());
        resolvedSupplierId = existing?.id ?? await createSupplier({ name: supplierName.trim(), phone: null, address: null, notes: null });
      }

      const data: CreateInvoiceData = {
        supplier_id: resolvedSupplierId,
        supplier_name: supplierName.trim(),
        invoice_number: invoiceNumber.trim() || undefined,
        payment_status: paymentStatus,
        payment_method: paymentMethod,
        paid_amount: paymentStatus === "paid" ? total : paymentStatus === "debt" ? 0 : paidAmount,
        notes: notes.trim() || undefined,
        items: lines.map((l) => ({ product_id: l.product_id, product_name: l.product_name, quantity: l.quantity, price: l.price })),
      };
      await createInvoice(data);
    },
    onSuccess: onSaved,
    onError: (e) => setError((e as Error).message),
  });

  const inpStyle: React.CSSProperties = { background: "var(--surface2)", border: "1px solid var(--border-md)", color: "var(--text-1)" };
  const inpCls = "w-full px-3 py-2.5 rounded-lg text-sm outline-none transition-all";
  const lbl = "block text-xs font-mono mb-1.5";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 backdrop-blur-sm" style={{ background: "rgba(0,0,0,0.6)" }} onClick={onClose} />
      <div className="relative rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]" style={{ background: "var(--surface)", border: "1px solid var(--border-md)" }}>

        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ borderBottom: "1px solid var(--border)", background: "var(--surface2)" }}>
          <h2 className="text-base font-semibold" style={{ color: "var(--text-1)" }}>Новая накладная</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-xl" style={{ color: "var(--text-3)" }} onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface3)")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>×</button>
        </div>

        <div className="overflow-auto flex-1">
          <div className="p-6 space-y-5">

            {/* Поставщик */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl} style={{ color: "var(--text-3)" }}>Поставщик *</label>
                <div className="relative">
                  <input value={supplierName} onChange={(e) => { setSupplierName(e.target.value); setSupplierId(null); }} placeholder="ИП Иванов / ООО Ромашка" className={inpCls} style={inpStyle} list="suppliers-list" />
                  <datalist id="suppliers-list">{suppliers.map((s) => <option key={s.id} value={s.name} />)}</datalist>
                </div>
              </div>
              <div>
                <label className={lbl} style={{ color: "var(--text-3)" }}>Номер накладной</label>
                <input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="НК-001" className={inpCls} style={inpStyle} />
              </div>
            </div>

            {/* Оплата */}
            <div>
              <label className={lbl} style={{ color: "var(--text-3)" }}>Статус оплаты</label>
              <div className="grid grid-cols-3 gap-2 mb-3">
                {([
                  { val: "paid",    label: "Оплачено",   icon: "✅" },
                  { val: "debt",    label: "В долг",     icon: "📋" },
                  { val: "partial", label: "Частично",   icon: "⏳" },
                ] as { val: PaymentStatus; label: string; icon: string }[]).map(({ val, label, icon }) => (
                  <button key={val} type="button" onClick={() => { setPaymentStatus(val); if (val === "paid") setPaidAmount(0); }}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm transition-all"
                    style={{ border: `1px solid ${paymentStatus === val ? "var(--accent-border)" : "var(--border-md)"}`, background: paymentStatus === val ? "var(--accent-soft)" : "var(--surface2)", color: paymentStatus === val ? "var(--accent)" : "var(--text-3)" }}>
                    <span>{icon}</span>{label}
                  </button>
                ))}
              </div>

              {paymentStatus !== "debt" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lbl} style={{ color: "var(--text-3)" }}>Метод оплаты</label>
                    <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)} className={inpCls + " appearance-none"} style={inpStyle}>
                      <option value="cash">Наличные</option>
                      <option value="transfer">Перевод</option>
                      <option value="card">Карта</option>
                    </select>
                  </div>
                  {paymentStatus === "partial" && (
                    <div>
                      <label className={lbl} style={{ color: "var(--text-3)" }}>Оплачено сейчас</label>
                      <NumericInput value={paidAmount} onChange={setPaidAmount} className={inpCls} style={inpStyle} suffix="сум" />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Товары */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-mono" style={{ color: "var(--text-3)" }}>ТОВАРЫ</label>
                <button type="button" onClick={() => setShowProductSearch(!showProductSearch)}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all"
                  style={{ background: "var(--accent-soft)", color: "var(--accent)", border: "1px solid var(--accent-border)" }}>
                  <Plus className="w-3.5 h-3.5" /> Добавить товар
                </button>
              </div>

              {/* Поиск товара */}
              {showProductSearch && (
                <div className="mb-3 rounded-xl overflow-hidden" style={{ border: "1px solid var(--border-md)" }}>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-3)" }} />
                    <input autoFocus value={productSearch} onChange={(e) => setProductSearch(e.target.value)} placeholder="Поиск товара..." className="w-full pl-9 pr-3 py-2.5 text-sm outline-none" style={{ background: "var(--surface2)", color: "var(--text-1)" }} />
                  </div>
                  <div className="max-h-48 overflow-auto" style={{ borderTop: "1px solid var(--border)" }}>
                    {filteredProducts.map((p) => (
                      <button key={p.id} onClick={() => addLine(p)} className="w-full flex items-center justify-between px-3 py-2.5 text-left transition-colors" style={{ background: "var(--surface)" }} onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface2)")} onMouseLeave={(e) => (e.currentTarget.style.background = "var(--surface)")}>
                        <div>
                          <div className="text-sm" style={{ color: "var(--text-1)" }}>{p.name}</div>
                          <div className="text-xs font-mono" style={{ color: "var(--text-3)" }}>{p.sku ?? ""}</div>
                        </div>
                        <div className="text-xs font-mono" style={{ color: "var(--text-3)" }}>{formatNumber(p.quantity)} {p.unit_short_name ?? "шт"}</div>
                      </button>
                    ))}
                    {filteredProducts.length === 0 && <div className="py-4 text-center text-sm" style={{ color: "var(--text-3)" }}>Не найдено</div>}
                  </div>
                </div>
              )}

              {/* Позиции */}
              {lines.length > 0 && (
                <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border-md)" }}>
                  <div className="grid text-xs font-mono px-3 py-2" style={{ gridTemplateColumns: "2fr 1fr 1fr auto", background: "var(--surface2)", color: "var(--text-3)", borderBottom: "1px solid var(--border)" }}>
                    <div>Товар</div><div>Кол-во</div><div>Цена</div><div></div>
                  </div>
                  {lines.map((line) => (
                    <div key={line.tempId} className="grid items-center px-3 py-2.5" style={{ gridTemplateColumns: "2fr 1fr 1fr auto", borderBottom: "1px solid var(--border)", background: "var(--surface)" }}>
                      <div className="text-sm truncate pr-2" style={{ color: "var(--text-1)" }}>{line.product_name}</div>
                      <NumericInput value={line.quantity} min={0.001} step={0.001} onChange={(v) => updateLine(line.tempId, "quantity", v)} className="px-2 py-1.5 rounded-lg text-sm outline-none text-right" style={{ background: "var(--surface2)", border: "1px solid var(--border-md)", color: "var(--text-1)", width: "80px" }} />
                      <NumericInput value={line.price} min={0} onChange={(v) => updateLine(line.tempId, "price", v)} className="px-2 py-1.5 rounded-lg text-sm outline-none text-right" style={{ background: "var(--surface2)", border: "1px solid var(--border-md)", color: "var(--text-1)", width: "100px" }} />
                      <button onClick={() => removeLine(line.tempId)} className="ml-2 p-1.5 rounded-lg transition-colors" style={{ color: "var(--red)" }} onMouseEnter={(e) => (e.currentTarget.style.background = "var(--red-soft)")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}><X className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                  <div className="flex justify-end px-3 py-2.5" style={{ background: "var(--surface2)" }}>
                    <div className="text-sm font-bold" style={{ color: "var(--text-1)" }}>Итого: {formatCurrency(total)}</div>
                  </div>
                </div>
              )}
            </div>

            {/* Примечание */}
            <div>
              <label className={lbl} style={{ color: "var(--text-3)" }}>Примечание</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Доп. информация..." className={inpCls + " resize-none"} style={inpStyle} />
            </div>

            {error && <div className="text-sm px-4 py-3 rounded-xl" style={{ background: "var(--red-soft)", color: "var(--red)", border: "1px solid rgba(248,113,113,0.2)" }}>{error}</div>}
          </div>
        </div>

        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ borderTop: "1px solid var(--border)", background: "var(--surface2)" }}>
          <div className="text-sm" style={{ color: "var(--text-3)" }}>
            {lines.length > 0 && `${lines.length} позиций · ${formatCurrency(total)}`}
            {paymentStatus === "debt" && total > 0 && <span style={{ color: "var(--red)" }}> · долг {formatCurrency(total)}</span>}
            {paymentStatus === "partial" && paidAmount > 0 && <span style={{ color: "var(--amber)" }}> · долг {formatCurrency(total - paidAmount)}</span>}
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg" style={{ color: "var(--text-3)" }}>Отмена</button>
            <button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="px-5 py-2.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-50 active:scale-95" style={{ background: "var(--accent)", color: "var(--accent-fg)" }}>
              {mutation.isPending ? "Сохранение..." : "Провести накладную"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
