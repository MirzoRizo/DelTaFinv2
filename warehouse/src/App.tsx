// src/App.tsx
import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  LayoutDashboard,
  Package,
  Tags,
  ArrowLeftRight,
  BarChart2,
  FileText,
  Truck,
  Settings,
  Warehouse,
} from 'lucide-react';
import { cn } from './lib/utils';
import { useSettings } from './store/settings';
import { DashboardPage } from './pages/Dashboard';
import { ProductsPage } from './pages/Products';
import { CategoriesPage } from './pages/Categories';
import { MovementsPage } from './pages/Movements';
import { ReportsPage } from './pages/Reports';
import { InvoicesPage } from './pages/Invoices';
import { SuppliersPage } from './pages/Suppliers';
import { SettingsPage } from './pages/Settings';
import { getPowerSync } from './lib/sync';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30000, retry: 1 } },
});
const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Главная', end: true },
  { to: '/products', icon: Package, label: 'Товары' },
  { to: '/categories', icon: Tags, label: 'Категории' },
  { to: '/invoices', icon: FileText, label: 'Накладные' },
  { to: '/suppliers', icon: Truck, label: 'Поставщики' },
  { to: '/movements', icon: ArrowLeftRight, label: 'Движения' },
  { to: '/reports', icon: BarChart2, label: 'Отчёты' },
  { to: '/settings', icon: Settings, label: 'Настройки' },
];

function Sidebar({ companyName }: { companyName: string }) {
  return (
    <aside
      className="w-[210px] flex-shrink-0 flex flex-col h-screen sticky top-0"
      style={{
        background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
      }}
    >
      <div
        className="px-4 py-4"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{
              background: 'var(--accent-soft)',
              border: '1px solid var(--accent-border)',
            }}
          >
            <Warehouse className="w-4 h-4" style={{ color: 'var(--accent)' }} />
          </div>
          <div className="min-w-0">
            <div
              className="text-sm font-semibold truncate"
              style={{ color: 'var(--text-1)' }}
            >
              {companyName}
            </div>
            <div
              className="text-xs font-mono mt-0.5"
              style={{ color: 'var(--text-4)' }}
            >
              Склад v1.0
            </div>
          </div>
        </div>
      </div>
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-auto">
        {navItems.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all',
                isActive ? 'font-medium' : 'hover:opacity-80',
              )
            }
            style={({ isActive }) => ({
              background: isActive ? 'var(--accent-soft)' : 'transparent',
              color: isActive ? 'var(--accent)' : 'var(--text-3)',
            })}
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>
      <div
        className="px-4 py-3"
        style={{ borderTop: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-1.5">
          <div
            className="w-1.5 h-1.5 rounded-full animate-pulse"
            style={{ background: 'var(--accent)' }}
          />
          <div className="text-xs font-mono" style={{ color: 'var(--text-4)' }}>
            OFFLINE · LOCAL
          </div>
        </div>
      </div>
    </aside>
  );
}

function AppInner() {
  const { load, settings } = useSettings();
  useEffect(() => {
    load();
    if (localStorage.getItem('sync_enabled') === 'true') {
      import('./lib/sync').then(({ startSync }) =>
        startSync().catch(console.error),
      );
    }
  }, []);
  return (
    <BrowserRouter>
      <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
        <Sidebar companyName={settings.companyName} />
        <main className="flex-1" style={{ overflowY: 'auto', height: '100vh' }}>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/categories" element={<CategoriesPage />} />
            <Route path="/invoices" element={<InvoicesPage />} />
            <Route path="/suppliers" element={<SuppliersPage />} />
            <Route path="/movements" element={<MovementsPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppInner />
    </QueryClientProvider>
  );
}
