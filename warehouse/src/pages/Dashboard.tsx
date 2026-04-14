// src/pages/Dashboard.tsx
import { useQuery } from "@tanstack/react-query";
import { Package, TrendingDown, DollarSign, ArrowUpRight } from "lucide-react";
import { getProductStats } from "../db/queries/products";
import { formatCurrency, formatNumber } from "../lib/utils";
import { Link } from "react-router-dom";

export function DashboardPage() {
  const { data: stats, isLoading } = useQuery({ queryKey: ["product-stats"], queryFn: getProductStats });

  return (
    <div className="p-8" style={{ background: "var(--bg)", minHeight: "100%" }}>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold" style={{ color: "var(--text-1)" }}>Главная</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-3)" }}>
          {new Date().toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" })}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard title="Всего товаров" value={isLoading ? "—" : formatNumber(stats?.total ?? 0, 0)} icon={Package} color="blue" href="/products" />
        <StatCard title="Мало на складе" value={isLoading ? "—" : formatNumber(stats?.lowStock ?? 0, 0)} icon={TrendingDown} color={stats?.lowStock ? "red" : "green"} href="/products" hint={stats?.lowStock ? "Требует пополнения" : "Всё в норме"} />
        <StatCard title="Стоимость склада" value={isLoading ? "—" : formatCurrency(stats?.totalValue ?? 0)} icon={DollarSign} color="green" />
      </div>

      <div>
        <h2 className="text-xs font-mono uppercase tracking-widest mb-3" style={{ color: "var(--text-4)" }}>Быстрые действия</h2>
        <div className="grid grid-cols-2 gap-3">
          <QuickAction href="/products"  label="Список товаров"    desc="Просмотр, поиск, редактирование"  icon="📦" />
          <QuickAction href="/invoices"  label="Новая накладная"   desc="Принять товар от поставщика"      icon="📥" />
          <QuickAction href="/movements" label="Списание"          desc="Убрать товар со склада"           icon="📤" />
          <QuickAction href="/categories" label="Категории"        desc="Управление группами товаров"      icon="🏷️" />
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color, href, hint }: {
  title: string; value: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  color: "blue" | "green" | "red"; href?: string; hint?: string;
}) {
  const c = { blue: "#60a5fa", green: "var(--accent)", red: "var(--red)" }[color];
  const card = (
    <div className="rounded-xl p-5 transition-colors group" style={{ background: "var(--surface)", border: "1px solid var(--border-md)" }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface2)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "var(--surface)")}>
      <div className="flex items-start justify-between mb-4">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: c + "18", border: `1px solid ${c}30` }}>
          <Icon className="w-4 h-4" style={{ color: c }} />
        </div>
        {href && <ArrowUpRight className="w-4 h-4 opacity-20 group-hover:opacity-60 transition-opacity" style={{ color: "var(--text-1)" }} />}
      </div>
      <div className="text-2xl font-semibold mb-1" style={{ color: "var(--text-1)" }}>{value}</div>
      <div className="text-sm" style={{ color: "var(--text-3)" }}>{title}</div>
      {hint && <div className="text-xs mt-0.5 font-mono" style={{ color: "var(--text-4)" }}>{hint}</div>}
    </div>
  );
  if (href) return <Link to={href}>{card}</Link>;
  return card;
}

function QuickAction({ href, label, desc, icon }: { href: string; label: string; desc: string; icon: string }) {
  return (
    <Link to={href} className="flex items-center gap-4 p-4 rounded-xl transition-all group"
      style={{ background: "var(--surface)", border: "1px solid var(--border-md)" }}
      onMouseEnter={(e: React.MouseEvent<HTMLAnchorElement>) => (e.currentTarget.style.background = "var(--surface2)")}
      onMouseLeave={(e: React.MouseEvent<HTMLAnchorElement>) => (e.currentTarget.style.background = "var(--surface)")}>
      <span className="text-2xl">{icon}</span>
      <div>
        <div className="text-sm font-medium" style={{ color: "var(--text-1)" }}>{label}</div>
        <div className="text-xs mt-0.5" style={{ color: "var(--text-3)" }}>{desc}</div>
      </div>
    </Link>
  );
}
