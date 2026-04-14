// src/db/index.ts — тот же warehouse.db что и у склада
import Database from "@tauri-apps/plugin-sql";

let _db: Database | null = null;

export async function getDb(): Promise<Database> {
  if (_db) return _db;
  // sqlite:warehouse.db — тот же файл, потому что identifier совпадает
  _db = await Database.load("sqlite:warehouse.db");
  await ensureSalesTable(_db);
  return _db;
}

// Добавляем таблицу продаж если нет (склад её не создаёт)
async function ensureSalesTable(db: Database) {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS sales (
      id TEXT PRIMARY KEY,
      total REAL NOT NULL,
      paid REAL NOT NULL,
      change REAL NOT NULL,
      payment_method TEXT DEFAULT 'cash',
      note TEXT,
      created_at INTEGER NOT NULL
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS sale_items (
      id TEXT PRIMARY KEY,
      sale_id TEXT NOT NULL REFERENCES sales(id),
      product_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      quantity REAL NOT NULL,
      price REAL NOT NULL,
      total REAL NOT NULL
    )
  `);
  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id)
  `);
}
