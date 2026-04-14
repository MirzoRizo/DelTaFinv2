// src/pages/Suppliers.tsx
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Truck, Phone, MapPin, Pencil, AlertCircle } from "lucide-react";
import { getSuppliers, createSupplier, updateSupplier } from "../db/queries/suppliers";
import type { Supplier } from "../db/queries/suppliers";
import { formatCurrency } from "../lib/utils";

export function SuppliersPage() {
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const qc = useQueryClient();

  const { data: suppliers = [], isLoading } = useQuery({ queryKey: ["suppliers"], queryFn: getSuppliers });
  const totalDebt = suppliers.reduce((s, sup) => s + sup.total_debt, 0);

  function saved() { setShowModal(false); setEditing(null); qc.invalidateQueries({ queryKey: ["suppliers"] }); }

  return (
    <div className="p-8" style={{ background: "var(--bg)", minHeight: "100%" }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: "var(--text-1)" }}>Поставщики</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-3)" }}>{suppliers.length} поставщиков</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold active:scale-95 transition-all"
          style={{ background: "var(--accent)", color: "var(--accent-fg)" }}>
          <Plus className="w-4 h-4" /> Добавить
        </button>
      </div>

      {/* Общий долг */}
      {totalDebt > 0 && (
        <div className="flex items-center gap-3 p-4 rounded-xl mb-5" style={{ background: "var(--red-soft)", border: "1px solid rgba(248,113,113,0.2)" }}>
          <AlertCircle className="w-5 h-5 flex-shrink-0" style={{ color: "var(--red)" }} />
          <div>
            <div className="text-sm font-medium" style={{ color: "var(--red)" }}>Общий долг поставщикам</div>
            <div className="text-xl font-bold" style={{ color: "var(--red)" }}>{formatCurrency(totalDebt)}</div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">{Array.from({length:4}).map((_,i) => <div key={i} className="h-20 rounded-xl animate-pulse" style={{ background: "var(--surface2)" }} />)}</div>
      ) : suppliers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Truck className="w-10 h-10" style={{ color: "var(--text-4)" }} />
          <div className="text-sm" style={{ color: "var(--text-3)" }}>Нет поставщиков</div>
          <div className="text-xs" style={{ color: "var(--text-4)" }}>Добавляются автоматически при создании накладной</div>
        </div>
      ) : (
        <div className="space-y-2">
          {suppliers.map((sup) => (
            <div key={sup.id} className="flex items-center gap-4 p-4 rounded-xl group transition-colors"
              style={{ background: "var(--surface)", border: "1px solid var(--border-md)" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface2)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "var(--surface)")}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-lg font-semibold"
                style={{ background: "var(--accent-soft)", color: "var(--accent)", border: "1px solid var(--accent-border)" }}>
                {sup.name[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium" style={{ color: "var(--text-1)" }}>{sup.name}</div>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  {sup.phone && (
                    <span className="flex items-center gap-1 text-xs" style={{ color: "var(--text-3)" }}>
                      <Phone className="w-3 h-3" />{sup.phone}
                    </span>
                  )}
                  {sup.address && (
                    <span className="flex items-center gap-1 text-xs" style={{ color: "var(--text-3)" }}>
                      <MapPin className="w-3 h-3" />{sup.address}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                {sup.total_debt > 0 ? (
                  <div>
                    <div className="text-xs" style={{ color: "var(--text-3)" }}>Долг</div>
                    <div className="text-sm font-bold" style={{ color: "var(--red)" }}>{formatCurrency(sup.total_debt)}</div>
                  </div>
                ) : (
                  <div className="text-xs font-mono" style={{ color: "var(--accent)" }}>✓ Без долга</div>
                )}
              </div>
              <button onClick={() => setEditing(sup)}
                className="opacity-0 group-hover:opacity-100 p-2 rounded-lg transition-all"
                style={{ color: "var(--text-3)" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface3)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                <Pencil className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {(showModal || editing) && (
        <SupplierModal supplier={editing ?? undefined} onClose={() => { setShowModal(false); setEditing(null); }} onSaved={saved} />
      )}
    </div>
  );
}

function SupplierModal({ supplier, onClose, onSaved }: { supplier?: Supplier; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!supplier;
  const [form, setForm] = useState({ name: supplier?.name ?? "", phone: supplier?.phone ?? "", address: supplier?.address ?? "", notes: supplier?.notes ?? "" });
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Введи название");
      if (isEdit) await updateSupplier(supplier!.id, { name: form.name.trim(), phone: form.phone.trim()||null, address: form.address.trim()||null, notes: form.notes.trim()||null });
      else await createSupplier({ name: form.name.trim(), phone: form.phone.trim()||null, address: form.address.trim()||null, notes: form.notes.trim()||null });
    },
    onSuccess: onSaved,
    onError: (e) => setError((e as Error).message),
  });

  const inpCls = "w-full px-3 py-2.5 rounded-lg text-sm outline-none transition-all";
  const inpStyle: React.CSSProperties = { background: "var(--surface2)", border: "1px solid var(--border-md)", color: "var(--text-1)" };
  const lbl = "block text-xs font-mono mb-1.5";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 backdrop-blur-sm" style={{ background: "rgba(0,0,0,0.5)" }} onClick={onClose} />
      <div className="relative rounded-2xl w-full max-w-md shadow-2xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border-md)" }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid var(--border)", background: "var(--surface2)" }}>
          <h2 className="text-base font-semibold" style={{ color: "var(--text-1)" }}>{isEdit ? "Редактировать" : "Новый поставщик"}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-xl" style={{ color: "var(--text-3)" }} onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface3)")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>×</button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className={lbl} style={{ color: "var(--text-3)" }}>Название *</label>
            <input autoFocus value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} placeholder="ИП Иванов / ООО Ромашка" className={inpCls} style={inpStyle} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl} style={{ color: "var(--text-3)" }}>Телефон</label>
              <input value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value})} placeholder="+998 90 123 45 67" className={inpCls} style={inpStyle} />
            </div>
            <div>
              <label className={lbl} style={{ color: "var(--text-3)" }}>Адрес</label>
              <input value={form.address} onChange={(e) => setForm({...form, address: e.target.value})} placeholder="Город, улица" className={inpCls} style={inpStyle} />
            </div>
          </div>
          <div>
            <label className={lbl} style={{ color: "var(--text-3)" }}>Примечания</label>
            <textarea value={form.notes} onChange={(e) => setForm({...form, notes: e.target.value})} rows={2} placeholder="Доп. информация..." className={inpCls + " resize-none"} style={inpStyle} />
          </div>
          {error && <div className="text-xs font-mono" style={{ color: "var(--red)" }}>{error}</div>}
          <div className="flex justify-end gap-3 pt-1" style={{ borderTop: "1px solid var(--border)" }}>
            <button onClick={onClose} className="px-4 py-2 text-sm" style={{ color: "var(--text-3)" }}>Отмена</button>
            <button onClick={() => mutation.mutate()} disabled={mutation.isPending}
              className="px-5 py-2.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-50 active:scale-95"
              style={{ background: "var(--accent)", color: "var(--accent-fg)" }}>
              {mutation.isPending ? "..." : isEdit ? "Сохранить" : "Добавить"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
