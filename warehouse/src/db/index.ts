// src/db/index.ts
import Database from "@tauri-apps/plugin-sql";

let _db: Database | null = null;

export async function getDb(): Promise<Database> {
  if (_db) return _db;
  _db = await Database.load("sqlite:warehouse.db");
  await runMigrations(_db);
  return _db;
}

async function runMigrations(db: Database) {
  await db.execute(`CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY, name TEXT NOT NULL,
    description TEXT, color TEXT DEFAULT '#6366f1', created_at INTEGER
  )`);
  await db.execute(`CREATE TABLE IF NOT EXISTS units (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, short_name TEXT NOT NULL
  )`);
  await db.execute(`CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, sku TEXT UNIQUE,
    barcode TEXT UNIQUE, description TEXT,
    category_id TEXT REFERENCES categories(id),
    unit_id TEXT REFERENCES units(id),
    cost_price REAL DEFAULT 0, sale_price REAL DEFAULT 0,
    quantity REAL DEFAULT 0, min_quantity REAL DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    barcode_type TEXT DEFAULT 'standard',
    plu_code INTEGER,
    created_at INTEGER, updated_at INTEGER
  )`);
  await db.execute(`CREATE TABLE IF NOT EXISTS movements (
    id TEXT PRIMARY KEY, product_id TEXT NOT NULL REFERENCES products(id),
    type TEXT NOT NULL, quantity REAL NOT NULL,
    price REAL, note TEXT, invoice_id TEXT, created_at INTEGER
  )`);
  await db.execute(`CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY, value TEXT NOT NULL
  )`);
  await db.execute(`CREATE TABLE IF NOT EXISTS suppliers (
    id TEXT PRIMARY KEY, name TEXT NOT NULL,
    phone TEXT, address TEXT, notes TEXT,
    total_debt REAL DEFAULT 0, created_at INTEGER
  )`);
  await db.execute(`CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY,
    supplier_id TEXT REFERENCES suppliers(id),
    supplier_name TEXT NOT NULL,
    invoice_number TEXT,
    payment_status TEXT NOT NULL DEFAULT 'paid',
    payment_method TEXT DEFAULT 'cash',
    due_date INTEGER,
    total REAL NOT NULL DEFAULT 0,
    paid_amount REAL NOT NULL DEFAULT 0,
    notes TEXT,
    created_at INTEGER NOT NULL
  )`);
  await db.execute(`CREATE TABLE IF NOT EXISTS invoice_items (
    id TEXT PRIMARY KEY,
    invoice_id TEXT NOT NULL REFERENCES invoices(id),
    product_id TEXT NOT NULL REFERENCES products(id),
    product_name TEXT NOT NULL,
    quantity REAL NOT NULL, price REAL NOT NULL, total REAL NOT NULL
  )`);
  await db.execute(`CREATE TABLE IF NOT EXISTS sales (
    id TEXT PRIMARY KEY, total REAL NOT NULL, paid REAL NOT NULL,
    change REAL NOT NULL, payment_method TEXT DEFAULT 'cash',
    note TEXT, created_at INTEGER NOT NULL
  )`);
  await db.execute(`CREATE TABLE IF NOT EXISTS sale_items (
    id TEXT PRIMARY KEY, sale_id TEXT NOT NULL REFERENCES sales(id),
    product_id TEXT NOT NULL, product_name TEXT NOT NULL,
    quantity REAL NOT NULL, price REAL NOT NULL, total REAL NOT NULL
  )`);

  // Индексы
  for (const [t,c,n] of [
    ["products","sku","idx_p_sku"], ["products","barcode","idx_p_barcode"],
    ["products","plu_code","idx_p_plu"], ["products","category_id","idx_p_cat"],
    ["movements","product_id","idx_m_product"], ["invoice_items","invoice_id","idx_ii"],
  ]) {
    await db.execute(`CREATE INDEX IF NOT EXISTS ${n} ON ${t}(${c})`);
  }

  // Миграции для существующих БД — добавляем новые колонки
  for (const [table, col, type] of [
    ["products","barcode_type","TEXT DEFAULT 'standard'"],
    ["products","plu_code","INTEGER"],
    ["movements","invoice_id","TEXT"],
  ]) {
    try { await db.execute(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`); } catch { /* уже есть */ }
  }

  await seedUnits(db);
}

async function seedUnits(db: Database) {
  const rows = await db.select<{count:number}[]>("SELECT COUNT(*) as count FROM units",[]);
  if ((rows[0]?.count ?? 0) > 0) return;
  for (const [id,name,short] of [
    ["unit-pcs","Штука","шт"],["unit-kg","Килограмм","кг"],["unit-g","Грамм","г"],
    ["unit-m","Метр","м"],["unit-l","Литр","л"],["unit-box","Коробка","кор"],["unit-pack","Упаковка","уп"],
  ]) {
    await db.execute("INSERT OR IGNORE INTO units(id,name,short_name) VALUES(?,?,?)",[id,name,short]);
  }
}
