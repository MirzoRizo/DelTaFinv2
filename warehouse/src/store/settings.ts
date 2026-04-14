// src/store/settings.ts
import { create } from "zustand";
import Database from "@tauri-apps/plugin-sql";

export type Theme = "dark" | "light";
export type Currency = "UZS" | "USD" | "RUB" | "KZT";

export interface AppSettings {
  companyName: string;
  currency: Currency;
  currencySymbol: string;
  lowStockAlert: boolean;
  theme: Theme;
  allowNegativeStock: boolean;  // разрешить продажу при нулевом остатке
}

const DEFAULTS: AppSettings = {
  companyName: "Мой склад",
  currency: "UZS",
  currencySymbol: "сум",
  lowStockAlert: true,
  theme: "dark",
  allowNegativeStock: true,
};

interface SettingsStore {
  settings: AppSettings;
  isLoaded: boolean;
  load: () => Promise<void>;
  save: (patch: Partial<AppSettings>) => Promise<void>;
  applyTheme: (theme: Theme) => void;
}

export const useSettings = create<SettingsStore>((set, get) => ({
  settings: DEFAULTS,
  isLoaded: false,

  applyTheme: (theme: Theme) => {
    const root = document.documentElement;
    root.classList.remove("dark", "light");
    root.classList.add(theme);
  },

  load: async () => {
    try {
      const db = await Database.load("sqlite:warehouse.db");
      await db.execute(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`);
      const rows = await db.select<{ key: string; value: string }[]>("SELECT key, value FROM settings", []);

      const stored: Partial<AppSettings> = {};
      for (const row of rows) {
        try { (stored as Record<string, unknown>)[row.key] = JSON.parse(row.value); }
        catch { (stored as Record<string, unknown>)[row.key] = row.value; }
      }

      const merged = { ...DEFAULTS, ...stored };
      set({ settings: merged, isLoaded: true });
      get().applyTheme(merged.theme);
    } catch {
      set({ isLoaded: true });
      get().applyTheme(DEFAULTS.theme);
    }
  },

  save: async (patch) => {
    const next = { ...get().settings, ...patch };
    set({ settings: next });

    if (patch.theme) get().applyTheme(patch.theme);

    const db = await Database.load("sqlite:warehouse.db");
    for (const [key, value] of Object.entries(patch)) {
      await db.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
        [key, JSON.stringify(value)]
      );
    }
  },
}));
