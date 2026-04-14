// cashier/src/App.tsx
import { useEffect } from "react";
import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Store, Clock, Settings } from "lucide-react";
import { cn } from "./lib/utils";
import { useCart } from "./store/cart";
import { useCashierSettings } from "./store/settings";
import { POSPage } from "./pages/POS";
import { HistoryPage } from "./pages/History";
import { CashierSettingsPage } from "./pages/CashierSettings";
import { getDb } from "./db/index";

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 15000, retry: 1 } } });
getDb().catch(console.error);

function Nav() {
  const cart = useCart();
  const navItems = [
    { to: "/", icon: Store, label: "Касса", end: true, badge: cart.items.length },
    { to: "/history", icon: Clock, label: "История" },
    { to: "/settings", icon: Settings, label: "Настройки" },
  ];
  return (
    <nav className="flex flex-shrink-0" style={{ borderTop: "1px solid var(--border)", background: "var(--surface)" }}>
      {navItems.map(({ to, icon: Icon, label, end, badge }) => (
        <NavLink key={to} to={to} end={end}
          className={({ isActive }) => cn("flex-1 flex flex-col items-center gap-1 py-3 text-xs transition-colors relative", isActive ? "" : "hover:opacity-70")}
          style={({ isActive }) => ({ color: isActive ? "var(--accent)" : "var(--text-3)" })}>
          {({ isActive }) => (
            <>
              {isActive && <div className="absolute top-0 left-1/4 right-1/4 h-0.5 rounded-full" style={{ background: "var(--accent)" }} />}
              <div className="relative">
                <Icon className="w-5 h-5" />
                {badge ? (
                  <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full flex items-center justify-center" style={{ background: "var(--accent)" }}>
                    <span className="text-[8px] font-bold" style={{ color: "var(--accent-fg)" }}>{badge}</span>
                  </div>
                ) : null}
              </div>
              <span>{label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

function AppInner() {
  const { load } = useCashierSettings();
  useEffect(() => { load(); }, []);
  return (
    <BrowserRouter>
      <div className="flex flex-col h-screen overflow-hidden" style={{ background: "var(--bg)" }}>
        <main className="flex-1 overflow-hidden">
          <Routes>
            <Route path="/" element={<POSPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/settings" element={<CashierSettingsPage />} />
          </Routes>
        </main>
        <Nav />
      </div>
    </BrowserRouter>
  );
}

export default function App() {
  return <QueryClientProvider client={queryClient}><AppInner /></QueryClientProvider>;
}
