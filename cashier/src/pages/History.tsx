// cashier/src/pages/History.tsx
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Receipt, TrendingUp, ShoppingBag, ChevronDown, ChevronUp } from "lucide-react";
import { getSales, getSaleById, getTodayStats } from "../db/queries/sales";
import { formatCurrency, formatDate, formatNumber } from "../lib/utils";

export function HistoryPage() {
  const { data: stats } = useQuery({ queryKey: ["today-stats"], queryFn: getTodayStats });
  const { data: sales = [], isLoading } = useQuery({ queryKey: ["sales"], queryFn: () => getSales(100) });
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: "var(--bg)" }}>
      {/* Шапка */}
      <div className="flex-shrink-0 px-4 py-4" style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)" }}>
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-base font-semibold" style={{ color: "var(--text-1)" }}>История продаж</h1>
          <div className="text-xs font-mono" style={{ color: "var(--text-3)" }}>
            {new Date().toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl p-3" style={{ background: "var(--surface2)", border: "1px solid var(--border-md)" }}>
            <div className="flex items-center gap-2 mb-1">
              <ShoppingBag className="w-3.5 h-3.5" style={{ color: "#60a5fa" }} />
              <span className="text-xs" style={{ color: "var(--text-3)" }}>Продаж сегодня</span>
            </div>
            <div className="text-xl font-bold" style={{ color: "var(--text-1)" }}>{stats?.count ?? 0}</div>
          </div>
          <div className="rounded-xl p-3" style={{ background: "var(--surface2)", border: "1px solid var(--border-md)" }}>
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-3.5 h-3.5" style={{ color: "var(--accent)" }} />
              <span className="text-xs" style={{ color: "var(--text-3)" }}>Выручка сегодня</span>
            </div>
            <div className="text-xl font-bold" style={{ color: "var(--accent)" }}>{formatCurrency(stats?.total ?? 0)}</div>
          </div>
        </div>
      </div>

      {/* Список */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="p-4 space-y-2">
            {Array.from({length:6}).map((_,i) => <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: "var(--surface2)" }} />)}
          </div>
        ) : sales.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-6">
            <Receipt className="w-10 h-10 mb-3" style={{ color: "var(--text-4)" }} />
            <div className="text-sm" style={{ color: "var(--text-3)" }}>Продаж пока нет</div>
          </div>
        ) : (
          <div className="p-3 space-y-1.5">
            {sales.map((sale) => {
              const isExp = expandedId === sale.id;
              const methodColor = sale.payment_method === "card" ? "#60a5fa" : "var(--accent)";
              return (
                <div key={sale.id} className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border-md)" }}>
                  <button onClick={() => setExpandedId(isExp ? null : sale.id)}
                    className="w-full flex items-center gap-3 px-4 py-3.5 transition-colors text-left"
                    style={{ background: "var(--surface)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface2)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "var(--surface)")}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
                      <Receipt className="w-4 h-4" style={{ color: "var(--text-3)" }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium" style={{ color: "var(--text-1)" }}>#{sale.id.slice(0,8).toUpperCase()}</span>
                        <span className="text-xs" style={{ color: methodColor }}>{sale.payment_method === "card" ? "Карта" : "Наличные"}</span>
                      </div>
                      <div className="text-xs mt-0.5 font-mono" style={{ color: "var(--text-3)" }}>{formatDate(sale.created_at)} · {sale.item_count} поз.</div>
                    </div>
                    <div className="text-right flex-shrink-0 mr-2">
                      <div className="text-sm font-bold" style={{ color: "var(--text-1)" }}>{formatCurrency(sale.total)}</div>
                    </div>
                    {isExp ? <ChevronUp className="w-4 h-4 flex-shrink-0" style={{ color: "var(--text-3)" }} /> : <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color: "var(--text-3)" }} />}
                  </button>

                  {isExp && <SaleDetail saleId={sale.id} />}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function SaleDetail({ saleId }: { saleId: string }) {
  const { data: detail } = useQuery({ queryKey: ["sale", saleId], queryFn: () => getSaleById(saleId) });
  if (!detail) return <div className="p-4 text-xs text-center" style={{ color: "var(--text-3)", borderTop: "1px solid var(--border)" }}>Загрузка...</div>;
  return (
    <div style={{ borderTop: "1px solid var(--border)", background: "var(--surface2)" }}>
      {detail.items.map((item) => (
        <div key={item.id} className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="text-sm" style={{ color: "var(--text-2)" }}>{item.product_name}</div>
          <div className="flex items-center gap-3 text-xs font-mono">
            <span style={{ color: "var(--text-3)" }}>{formatNumber(item.quantity)} × {formatCurrency(item.price)}</span>
            <span className="w-24 text-right" style={{ color: "var(--text-1)" }}>{formatCurrency(item.total)}</span>
          </div>
        </div>
      ))}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="text-xs font-mono" style={{ color: "var(--text-3)" }}>
          Оплачено: {formatCurrency(detail.paid)}
          {detail.change > 0 && ` · Сдача: ${formatCurrency(detail.change)}`}
        </div>
        <div className="text-sm font-bold" style={{ color: "var(--text-1)" }}>{formatCurrency(detail.total)}</div>
      </div>
    </div>
  );
}
