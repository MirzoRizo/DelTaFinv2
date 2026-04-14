// cashier/src/pages/CashierSettings.tsx
import { useEffect, useState } from "react";
import { useCashierSettings } from "../store/settings";
import { Check, Printer, Sun, Moon, FileText } from "lucide-react";
import { cn } from "../lib/utils";

export function CashierSettingsPage() {
  const { settings, load, save, isLoaded } = useCashierSettings();
  const [form, setForm] = useState(settings);
  const [saved, setSaved] = useState(false);

  useEffect(() => { load(); }, []);
  useEffect(() => { setForm(settings); }, [isLoaded]);

  async function handleSave() {
    await save(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (!isLoaded) return <div className="p-6 text-sm" style={{ color: "var(--text-3)" }}>Загрузка...</div>;

  const inpStyle: React.CSSProperties = { background: "var(--surface2)", border: "1px solid var(--border-md)", color: "var(--text-1)" };
  const inpCls = "w-full px-3 py-2.5 rounded-lg text-sm outline-none transition-all";

  return (
    <div className="flex flex-col h-screen overflow-auto" style={{ background: "var(--bg)" }}>
      <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)" }}>
        <h1 className="text-base font-semibold" style={{ color: "var(--text-1)" }}>Настройки кассы</h1>
      </div>

      <div className="p-5 space-y-4 flex-1">

        {/* Тема */}
        <Section title="Оформление" icon={Sun}>
          <div className="grid grid-cols-2 gap-2">
            {(["dark","light"] as const).map((t) => (
              <button key={t} onClick={() => setForm({ ...form, theme: t })}
                className="flex items-center gap-2 p-3 rounded-xl text-sm transition-all"
                style={{ border: `1px solid ${form.theme === t ? "var(--accent-border)" : "var(--border-md)"}`, background: form.theme === t ? "var(--accent-soft)" : "var(--surface2)", color: form.theme === t ? "var(--accent)" : "var(--text-3)" }}>
                {t === "dark" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                {t === "dark" ? "Тёмная" : "Светлая"}
                {form.theme === t && <Check className="w-3.5 h-3.5 ml-auto" />}
              </button>
            ))}
          </div>
        </Section>

        {/* Принтер */}
        <Section title="Принтер чеков" icon={Printer}>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-mono mb-1.5" style={{ color: "var(--text-3)" }}>Ширина бумаги</label>
              <div className="grid grid-cols-2 gap-2">
                {([58, 80] as const).map((w) => (
                  <button key={w} onClick={() => setForm({ ...form, paperWidth: w })}
                    className="flex items-center justify-center gap-2 p-2.5 rounded-xl text-sm transition-all"
                    style={{ border: `1px solid ${form.paperWidth === w ? "var(--accent-border)" : "var(--border-md)"}`, background: form.paperWidth === w ? "var(--accent-soft)" : "var(--surface2)", color: form.paperWidth === w ? "var(--accent)" : "var(--text-3)" }}>
                    {w}мм
                    {form.paperWidth === w && <Check className="w-3.5 h-3.5" />}
                  </button>
                ))}
              </div>
            </div>

            <Toggle label="Печатать чек автоматически после продажи" value={form.printOnSale} onChange={(v) => setForm({ ...form, printOnSale: v })} />
          </div>
        </Section>

        {/* Товары */}
        <Section title="Продажи" icon={FileText}>
          <Toggle label="Разрешить продажу при нулевом остатке" value={form.allowNegativeStock} onChange={(v) => setForm({ ...form, allowNegativeStock: v })} desc="Товар продаётся даже если на складе 0" />
        </Section>

        <button onClick={handleSave}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all"
          style={{ background: saved ? "var(--accent-soft)" : "var(--accent)", color: saved ? "var(--accent)" : "var(--accent-fg)", border: saved ? "1px solid var(--accent-border)" : "none" }}>
          {saved ? <><Check className="w-4 h-4" />Сохранено</> : "Сохранить"}
        </button>
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, children }: { icon: React.ComponentType<{ className?: string }>; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border-md)" }}>
      <div className="flex items-center gap-2.5 px-4 py-3" style={{ borderBottom: "1px solid var(--border)", background: "var(--surface2)" }}>
        <Icon className="w-4 h-4" style={{ color: "var(--text-3)" }} />
        <span className="text-sm font-medium" style={{ color: "var(--text-2)" }}>{title}</span>
      </div>
      <div className="px-4 py-4" style={{ background: "var(--surface)" }}>{children}</div>
    </div>
  );
}

function Toggle({ label, desc, value, onChange }: { label: string; desc?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start justify-between gap-4 cursor-pointer py-1">
      <div>
        <div className="text-sm" style={{ color: "var(--text-1)" }}>{label}</div>
        {desc && <div className="text-xs mt-0.5" style={{ color: "var(--text-3)" }}>{desc}</div>}
      </div>
      <button onClick={() => onChange(!value)} className="relative flex-shrink-0 rounded-full transition-colors mt-0.5"
        style={{ width: 40, height: 22, background: value ? "var(--accent)" : "var(--surface3)", border: "1px solid var(--border-md)" }}>
        <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all" style={{ left: value ? 20 : 2 }} />
      </button>
    </label>
  );
}
