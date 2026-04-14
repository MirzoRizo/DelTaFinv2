// cashier/src/store/settings.ts
import { create } from "zustand";
import Database from "@tauri-apps/plugin-sql";

export interface CashierSettings {
  companyName: string;
  currency: string;
  theme: "dark" | "light";
  paperWidth: 58 | 80;
  printOnSale: boolean; // автопечать после продажи
  allowNegativeStock: boolean;
}

const DEFAULTS: CashierSettings = {
  companyName: "Мой магазин",
  currency: "UZS",
  theme: "dark",
  paperWidth: 80,
  printOnSale: false,
  allowNegativeStock: true,
};

interface SettingsStore {
  settings: CashierSettings;
  isLoaded: boolean;
  load: () => Promise<void>;
  save: (patch: Partial<CashierSettings>) => Promise<void>;
}

export const useCashierSettings = create<SettingsStore>((set, get) => ({
  settings: DEFAULTS,
  isLoaded: false,

  load: async () => {
    try {
      const db = await Database.load("sqlite:warehouse.db");
      const rows = await db.select<{ key: string; value: string }[]>(
        "SELECT key, value FROM settings", []
      );
      const stored: Partial<CashierSettings> = {};
      for (const row of rows) {
        try { (stored as Record<string, unknown>)[row.key] = JSON.parse(row.value); }
        catch { (stored as Record<string, unknown>)[row.key] = row.value; }
      }
      const merged = { ...DEFAULTS, ...stored };
      set({ settings: merged, isLoaded: true });

      // Применяем тему
      document.documentElement.classList.remove("dark", "light");
      document.documentElement.classList.add(merged.theme);
    } catch {
      set({ isLoaded: true });
    }
  },

  save: async (patch) => {
    const next = { ...get().settings, ...patch };
    set({ settings: next });
    if (patch.theme) {
      document.documentElement.classList.remove("dark", "light");
      document.documentElement.classList.add(patch.theme);
    }
    const db = await Database.load("sqlite:warehouse.db");
    for (const [key, value] of Object.entries(patch)) {
      await db.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
        [key, JSON.stringify(value)]
      );
    }
  },
}));
