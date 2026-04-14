// src/pages/Settings.tsx
import { useEffect, useState } from 'react';
import { useSettings } from '../store/settings';
import {
  Check,
  Building2,
  Coins,
  Bell,
  Moon,
  Sun,
  ShieldAlert,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { SyncSettings } from '../components/SyncSettings';
import { Cloud } from 'lucide-react';

const CURRENCIES = [
  { value: 'UZS', label: 'Узбекский сум', symbol: 'сум' },
  { value: 'USD', label: 'Доллар США', symbol: '$' },
  { value: 'RUB', label: 'Российский рубль', symbol: '₽' },
  { value: 'KZT', label: 'Казахский тенге', symbol: '₸' },
];

export function SettingsPage() {
  const { settings, load, save, isLoaded } = useSettings();
  const [form, setForm] = useState(settings);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    setForm(settings);
  }, [settings]);

  async function handleSave() {
    await save(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (!isLoaded)
    return (
      <div className="p-8" style={{ color: 'var(--text-3)' }}>
        Загрузка...
      </div>
    );

  return (
    <div className="p-8 max-w-xl overflow-auto">
      <div className="mb-6">
        <h1
          className="text-2xl font-semibold"
          style={{ color: 'var(--text-1)' }}
        >
          Настройки
        </h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-3)' }}>
          Параметры приложения
        </p>
      </div>

      <div className="space-y-4">
        {/* Тема */}
        <Section icon={Sun} title="Оформление">
          <div>
            <label
              className="block text-xs font-mono mb-2"
              style={{ color: 'var(--text-3)' }}
            >
              Тема
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { val: 'dark', label: 'Тёмная', icon: Moon },
                  { val: 'light', label: 'Светлая', icon: Sun },
                ] as const
              ).map(({ val, label, icon: Icon }) => (
                <button
                  key={val}
                  onClick={() => setForm({ ...form, theme: val })}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-xl border text-sm font-medium transition-all',
                    form.theme === val
                      ? 'border-[--accent-border] text-[--accent]'
                      : 'text-[--text-2] hover:text-[--text-1]',
                  )}
                  style={{
                    background:
                      form.theme === val
                        ? 'var(--accent-soft)'
                        : 'var(--surface2)',
                    borderColor:
                      form.theme === val
                        ? 'var(--accent-border)'
                        : 'var(--border-md)',
                  }}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                  {form.theme === val && (
                    <Check
                      className="w-3.5 h-3.5 ml-auto"
                      style={{ color: 'var(--accent)' }}
                    />
                  )}
                </button>
              ))}
            </div>
          </div>
        </Section>

        {/* Название */}
        <Section icon={Building2} title="Организация">
          <div>
            <label
              className="block text-xs font-mono mb-1.5"
              style={{ color: 'var(--text-3)' }}
            >
              Название компании / склада
            </label>
            <input
              value={form.companyName}
              onChange={(e) =>
                setForm({ ...form, companyName: e.target.value })
              }
              placeholder="Мой склад"
              style={{
                background: 'var(--surface2)',
                border: '1px solid var(--border-md)',
                color: 'var(--text-1)',
              }}
              className="w-full px-3 py-2.5 rounded-lg text-sm outline-none focus:border-[--accent] transition-all placeholder:text-[--text-3]"
            />
          </div>
        </Section>

        {/* Валюта */}
        <Section icon={Coins} title="Валюта">
          <div className="grid grid-cols-2 gap-2">
            {CURRENCIES.map((c) => (
              <button
                key={c.value}
                onClick={() =>
                  setForm({
                    ...form,
                    currency: c.value as typeof form.currency,
                    currencySymbol: c.symbol,
                  })
                }
                className="flex items-center gap-3 p-3 rounded-xl border text-left transition-all"
                style={{
                  background:
                    form.currency === c.value
                      ? 'var(--accent-soft)'
                      : 'var(--surface2)',
                  borderColor:
                    form.currency === c.value
                      ? 'var(--accent-border)'
                      : 'var(--border-md)',
                  color:
                    form.currency === c.value
                      ? 'var(--accent)'
                      : 'var(--text-2)',
                }}
              >
                <span className="text-lg font-mono w-6 text-center">
                  {c.symbol}
                </span>
                <div>
                  <div className="text-sm font-medium">{c.value}</div>
                  <div className="text-xs" style={{ color: 'var(--text-3)' }}>
                    {c.label}
                  </div>
                </div>
                {form.currency === c.value && (
                  <Check className="w-3.5 h-3.5 ml-auto" />
                )}
              </button>
            ))}
          </div>
        </Section>

        {/* Поведение */}
        <Section icon={ShieldAlert} title="Контроль остатков">
          <div className="space-y-3">
            <Toggle
              label="Разрешить отрицательный остаток"
              desc="Продажа товара даже когда остаток = 0. Показывает предупреждение."
              value={form.allowNegativeStock}
              onChange={(v) => setForm({ ...form, allowNegativeStock: v })}
            />
            <Toggle
              label="Предупреждение при низком остатке"
              desc="Значок ⚠ когда остаток ≤ минимального"
              value={form.lowStockAlert}
              onChange={(v) => setForm({ ...form, lowStockAlert: v })}
            />
          </div>
        </Section>
        <Section icon={Cloud} title="Синхронизация между устройствами">
          <SyncSettings />
        </Section>
        {/* Кнопка сохранения */}
        <div className="pt-1">
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-medium text-sm transition-all"
            style={{
              background: saved ? 'var(--accent-soft)' : 'var(--accent)',
              color: saved ? 'var(--accent)' : 'var(--accent-fg)',
              border: saved ? '1px solid var(--accent-border)' : 'none',
            }}
          >
            {saved ? (
              <>
                <Check className="w-4 h-4" /> Сохранено
              </>
            ) : (
              'Сохранить настройки'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        border: '1px solid var(--border-md)',
        background: 'var(--surface)',
      }}
    >
      <div
        className="flex items-center gap-2.5 px-5 py-3.5"
        style={{
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface2)',
        }}
      >
        <Icon className="w-4 h-4" style={{ color: 'var(--text-3)' }} />
        <span
          className="text-sm font-medium"
          style={{ color: 'var(--text-2)' }}
        >
          {title}
        </span>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

function Toggle({
  label,
  desc,
  value,
  onChange,
}: {
  label: string;
  desc: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start justify-between gap-4 cursor-pointer group py-1">
      <div>
        <div
          className="text-sm font-medium transition-colors"
          style={{ color: 'var(--text-1)' }}
        >
          {label}
        </div>
        <div className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
          {desc}
        </div>
      </div>
      <button
        onClick={() => onChange(!value)}
        className="relative flex-shrink-0 rounded-full transition-colors mt-0.5"
        style={{
          width: 40,
          height: 22,
          background: value ? 'var(--accent)' : 'var(--surface3)',
          border: '1px solid var(--border-md)',
        }}
      >
        <div
          className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all"
          style={{ left: value ? 20 : 2 }}
        />
      </button>
    </label>
  );
}
