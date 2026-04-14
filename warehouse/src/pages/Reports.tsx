// src/pages/Reports.tsx
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, FileSpreadsheet, FileText, TrendingUp, Package, DollarSign, AlertTriangle } from "lucide-react";
import { getProducts } from "../db/queries/products";
import { getMovements } from "../db/queries/movements";
import { getCategories } from "../db/queries/categories";
import { formatCurrency, formatNumber } from "../lib/utils";

async function doExport(products: Awaited<ReturnType<typeof getProducts>>, fmt: "xlsx" | "csv") {
  const XLSX = await import("xlsx");
  const rows = products.map((p) => ({
    "Название": p.name, "Артикул": p.sku ?? "", "Штрих-код": p.barcode ?? "",
    "Тип": p.barcode_type === "weight" ? "Весовой" : p.barcode_type === "internal" ? "Внутренний" : "Стандарт",
    "Категория": p.category_name ?? "", "Ед.": p.unit_short_name ?? "шт",
    "Остаток": p.quantity, "Мин.остаток": p.min_quantity,
    "Себестоимость": p.cost_price, "Цена продажи": p.sale_price,
    "Сумма (себест.)": p.quantity * p.cost_price,
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Товары");
  const stamp = new Date().toISOString().slice(0,10).replace(/-/g,"");
  XLSX.writeFile(wb, `tovary_${stamp}.${fmt}`, fmt === "csv" ? { bookType: "csv" } : undefined);
}

async function doExportMovements(movements: Awaited<ReturnType<typeof getMovements>>) {
  const XLSX = await import("xlsx");
  const tl: Record<string,string> = { in:"Приём", out:"Списание", sale:"Продажа", adjustment:"Корректировка" };
  const rows = movements.map((m) => ({
    "Дата": m.created_at ? new Date(m.created_at).toLocaleString("ru-RU") : "",
    "Тип": tl[m.type] ?? m.type, "Товар": m.product_name, "Артикул": m.product_sku ?? "",
    "Количество": m.quantity, "Цена": m.price ?? "", "Примечание": m.note ?? "",
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Движения");
  XLSX.writeFile(wb, `dvizheniya_${new Date().toISOString().slice(0,10).replace(/-/g,"")}.xlsx`);
}

export function ReportsPage() {
  const [expP, setExpP] = useState(false);
  const [expM, setExpM] = useState(false);

  const { data: products = [] } = useQuery({ queryKey: ["products","","",false], queryFn: () => getProducts() });
  const { data: movements = [] } = useQuery({ queryKey: ["movements","all"], queryFn: () => getMovements({ limit: 1000 }) });
  const { data: categories = [] } = useQuery({ queryKey: ["categories"], queryFn: getCategories });

  const totalValue = products.reduce((s,p) => s + p.quantity * p.cost_price, 0);
  const totalSaleValue = products.reduce((s,p) => s + p.quantity * p.sale_price, 0);
  const lowStockItems = products.filter((p) => p.min_quantity > 0 && p.quantity <= p.min_quantity);
  const topByValue = [...products].sort((a,b) => b.quantity*b.cost_price - a.quantity*a.cost_price).slice(0,10);
  const catStats = categories.map((cat) => {
    const ps = products.filter((p) => p.category_id === cat.id);
    return { ...cat, count: ps.length, value: ps.reduce((s,p) => s + p.quantity*p.cost_price, 0) };
  }).sort((a,b) => b.value - a.value);
  const weekAgo = Date.now() - 7*24*60*60*1000;
  const recentIn  = movements.filter((m) => m.type==="in"  && (m.created_at??0)>=weekAgo).length;
  const recentOut = movements.filter((m) => (m.type==="out"||m.type==="sale") && (m.created_at??0)>=weekAgo).length;

  return (
    <div className="p-8" style={{ background: "var(--bg)", minHeight: "100%" }}>
      <div className="mb-6">
        <h1 className="text-xl font-semibold" style={{ color: "var(--text-1)" }}>Отчёты</h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--text-3)" }}>Аналитика и экспорт данных</p>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-8">
        {[
          { icon: DollarSign, label: "Стоимость склада",   value: formatCurrency(totalValue),       sub: `Продажная: ${formatCurrency(totalSaleValue)}`, color: "green" },
          { icon: Package,    label: "Позиций товаров",    value: formatNumber(products.length,0),  sub: `Нет остатка: ${products.filter(p=>p.quantity<=0).length}`, color: "blue" },
          { icon: AlertTriangle, label: "Мало на складе", value: String(lowStockItems.length),      sub: "Ниже минимума", color: lowStockItems.length>0?"red":"green" },
          { icon: TrendingUp, label: "Движений за 7 дней", value: String(recentIn+recentOut),       sub: `+${recentIn} приём · −${recentOut} списание`, color: "amber" },
        ].map(({ icon: Icon, label, value, sub, color }) => {
          const c = { green:"var(--accent)", blue:"#60a5fa", red:"var(--red)", amber:"#fbbf24" }[color];
          return (
            <div key={label} className="rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border-md)" }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3" style={{ background: (c as string)+"18", border: `1px solid ${c}30` }}>
                <Icon className="w-4 h-4" style={{ color: c as string }} />
              </div>
              <div className="text-xl font-semibold mb-0.5" style={{ color: "var(--text-1)" }}>{value}</div>
              <div className="text-xs" style={{ color: "var(--text-3)" }}>{label}</div>
              <div className="text-xs mt-0.5 font-mono" style={{ color: "var(--text-4)" }}>{sub}</div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-[1fr_300px] gap-6">
        <div className="space-y-5">
          {/* Топ */}
          <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border-md)" }}>
            <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--border)", background: "var(--surface2)" }}>
              <span className="text-sm font-semibold" style={{ color: "var(--text-1)" }}>Топ-10 по стоимости остатка</span>
            </div>
            {topByValue.length === 0
              ? <div className="py-10 text-center text-sm" style={{ color: "var(--text-3)" }}>Нет данных</div>
              : topByValue.map((p, i) => {
                  const val = p.quantity * p.cost_price;
                  const maxVal = (topByValue[0].quantity * topByValue[0].cost_price) || 1;
                  return (
                    <div key={p.id} className="flex items-center gap-4 px-5 py-3 transition-colors" style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)" }} onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface2)")} onMouseLeave={(e) => (e.currentTarget.style.background = "var(--surface)")}>
                      <div className="text-xs font-mono w-5 flex-shrink-0" style={{ color: "var(--text-4)" }}>{String(i+1).padStart(2,"0")}</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm truncate mb-1.5" style={{ color: "var(--text-2)" }}>{p.name}</div>
                        <div className="h-1 rounded-full overflow-hidden" style={{ background: "var(--surface3)" }}>
                          <div className="h-full rounded-full" style={{ width: `${(val/maxVal)*100}%`, background: "var(--accent)" }} />
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-sm font-mono" style={{ color: "var(--text-2)" }}>{formatCurrency(val)}</div>
                        <div className="text-xs mt-0.5" style={{ color: "var(--text-4)" }}>{formatNumber(p.quantity)} {p.unit_short_name ?? "шт"}</div>
                      </div>
                    </div>
                  );
                })
            }
          </div>

          {/* Мало на складе */}
          {lowStockItems.length > 0 && (
            <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(248,113,113,0.2)" }}>
              <div className="px-5 py-4 flex items-center gap-2" style={{ borderBottom: "1px solid rgba(248,113,113,0.15)", background: "var(--red-soft)" }}>
                <AlertTriangle className="w-4 h-4" style={{ color: "var(--red)" }} />
                <span className="text-sm font-semibold" style={{ color: "var(--red)" }}>Требуют пополнения ({lowStockItems.length})</span>
              </div>
              {lowStockItems.map((p) => (
                <div key={p.id} className="flex items-center justify-between px-5 py-3" style={{ borderBottom: "1px solid rgba(248,113,113,0.08)", background: "var(--surface)" }}>
                  <div>
                    <div className="text-sm" style={{ color: "var(--text-1)" }}>{p.name}</div>
                    <div className="text-xs font-mono mt-0.5" style={{ color: "var(--text-3)" }}>{p.category_name ?? "Без категории"}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium font-mono" style={{ color: "var(--red)" }}>{formatNumber(p.quantity)} {p.unit_short_name ?? "шт"}</div>
                    <div className="text-xs" style={{ color: "var(--text-4)" }}>мин: {formatNumber(p.min_quantity)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          {/* Экспорт */}
          <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border-md)" }}>
            <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--border)", background: "var(--surface2)" }}>
              <span className="text-sm font-semibold" style={{ color: "var(--text-1)" }}>Экспорт данных</span>
            </div>
            <div className="p-4 space-y-2" style={{ background: "var(--surface)" }}>
              {[
                { label: "Excel (.xlsx)", sub: `${products.length} позиций`, color: "var(--accent)", onClick: async () => { setExpP(true); try { await doExport(products,"xlsx"); } finally { setExpP(false); } } },
                { label: "CSV файл",     sub: "Для Google Sheets",           color: "#60a5fa",        onClick: async () => { setExpP(true); try { await doExport(products,"csv"); } finally { setExpP(false); } } },
                { label: "История движений", sub: `${movements.length} записей`, color: "#fbbf24",    onClick: async () => { setExpM(true); try { await doExportMovements(movements); } finally { setExpM(false); } } },
              ].map(({ label, sub, color, onClick }) => (
                <button key={label} onClick={onClick} disabled={expP || expM}
                  className="w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left disabled:opacity-40"
                  style={{ background: "var(--surface2)", border: "1px solid var(--border-md)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface3)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "var(--surface2)")}>
                  <FileSpreadsheet className="w-4 h-4 flex-shrink-0" style={{ color }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm" style={{ color: "var(--text-1)" }}>{label}</div>
                    <div className="text-xs font-mono" style={{ color: "var(--text-3)" }}>{sub}</div>
                  </div>
                  <Download className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--text-4)" }} />
                </button>
              ))}
            </div>
          </div>

          {/* По категориям */}
          <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border-md)" }}>
            <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--border)", background: "var(--surface2)" }}>
              <span className="text-sm font-semibold" style={{ color: "var(--text-1)" }}>По категориям</span>
            </div>
            <div className="p-4 space-y-2" style={{ background: "var(--surface)" }}>
              {catStats.length === 0 && <div className="text-xs text-center py-4" style={{ color: "var(--text-3)" }}>Нет категорий</div>}
              {catStats.map((cat) => (
                <div key={cat.id} className="flex items-center justify-between py-2" style={{ borderBottom: "1px solid var(--border)" }}>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cat.color ?? "#6366f1" }} />
                    <span className="text-sm truncate max-w-[120px]" style={{ color: "var(--text-2)" }}>{cat.name}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-mono" style={{ color: "var(--text-2)" }}>{formatCurrency(cat.value)}</div>
                    <div className="text-xs" style={{ color: "var(--text-4)" }}>{cat.count} поз.</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
