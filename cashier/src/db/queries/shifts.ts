// cashier/src/db/queries/shifts.ts
import { getDb } from "../index";
import { generateId } from "../../../src/lib/utils";

export interface Shift {
  id: string;
  opened_at: number;
  closed_at: number | null;
  opening_cash: number;
  closing_cash: number | null;
  total_sales: number | null;
  total_returns: number | null;
  sales_count: number | null;
  cashier_name: string | null;
  notes: string | null;
}

export interface Return {
  id: string;
  sale_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  price: number;
  total: number;
  reason: string | null;
  created_at: number;
}

// ─── Инициализация таблиц ──────────────────────────────────

export async function ensureShiftTables() {
  const db = await getDb();
  await db.execute(`
    CREATE TABLE IF NOT EXISTS shifts (
      id TEXT PRIMARY KEY,
      opened_at INTEGER NOT NULL,
      closed_at INTEGER,
      opening_cash REAL NOT NULL DEFAULT 0,
      closing_cash REAL,
      total_sales REAL,
      total_returns REAL,
      sales_count INTEGER,
      cashier_name TEXT,
      notes TEXT
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS returns (
      id TEXT PRIMARY KEY,
      sale_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      quantity REAL NOT NULL,
      price REAL NOT NULL,
      total REAL NOT NULL,
      reason TEXT,
      shift_id TEXT,
      created_at INTEGER NOT NULL
    )
  `);
}

// ─── Смены ─────────────────────────────────────────────────

export async function getCurrentShift(): Promise<Shift | null> {
  const db = await getDb();
  const rows = await db.select<Shift[]>(
    `SELECT * FROM shifts WHERE closed_at IS NULL ORDER BY opened_at DESC LIMIT 1`, []
  );
  return rows[0] ?? null;
}

export async function openShift(data: { openingCash: number; cashierName?: string }): Promise<string> {
  const db = await getDb();
  const id = generateId();
  await db.execute(
    `INSERT INTO shifts (id, opened_at, opening_cash, cashier_name) VALUES (?, ?, ?, ?)`,
    [id, Date.now(), data.openingCash, data.cashierName ?? null]
  );
  return id;
}

export async function closeShift(shiftId: string, data: {
  closingCash: number;
  notes?: string;
}): Promise<void> {
  const db = await getDb();

  // Считаем итоги смены
  const shift = await db.select<Shift[]>(`SELECT * FROM shifts WHERE id = ?`, [shiftId]);
  const openedAt = shift[0]?.opened_at ?? 0;

  const [salesRow] = await db.select<{ total: number; count: number }[]>(
    `SELECT COALESCE(SUM(total),0) as total, COUNT(*) as count FROM sales WHERE created_at >= ?`,
    [openedAt]
  );
  const [returnsRow] = await db.select<{ total: number }[]>(
    `SELECT COALESCE(SUM(total),0) as total FROM returns WHERE created_at >= ?`,
    [openedAt]
  );

  await db.execute(
    `UPDATE shifts SET
      closed_at = ?, closing_cash = ?,
      total_sales = ?, total_returns = ?,
      sales_count = ?, notes = ?
     WHERE id = ?`,
    [
      Date.now(), data.closingCash,
      salesRow?.total ?? 0, returnsRow?.total ?? 0,
      salesRow?.count ?? 0,
      data.notes ?? null,
      shiftId,
    ]
  );
}

export async function getShiftStats(shiftId: string) {
  const db = await getDb();
  const [shift] = await db.select<Shift[]>(`SELECT * FROM shifts WHERE id = ?`, [shiftId]);
  if (!shift) return null;

  const [sales] = await db.select<{ total: number; count: number; cash: number; card: number }[]>(
    `SELECT
       COALESCE(SUM(total),0) as total,
       COUNT(*) as count,
       COALESCE(SUM(CASE WHEN payment_method='cash' THEN total ELSE 0 END),0) as cash,
       COALESCE(SUM(CASE WHEN payment_method='card' THEN total ELSE 0 END),0) as card
     FROM sales WHERE created_at >= ?`,
    [shift.opened_at]
  );
  const [returns] = await db.select<{ total: number; count: number }[]>(
    `SELECT COALESCE(SUM(total),0) as total, COUNT(*) as count FROM returns WHERE created_at >= ?`,
    [shift.opened_at]
  );

  return {
    shift,
    sales: sales ?? { total: 0, count: 0, cash: 0, card: 0 },
    returns: returns ?? { total: 0, count: 0 },
    netRevenue: (sales?.total ?? 0) - (returns?.total ?? 0),
  };
}

export async function getLastShifts(limit = 10): Promise<Shift[]> {
  const db = await getDb();
  return db.select<Shift[]>(
    `SELECT * FROM shifts ORDER BY opened_at DESC LIMIT ?`, [limit]
  );
}

// ─── Возвраты ──────────────────────────────────────────────

export interface SaleForReturn {
  id: string;
  total: number;
  created_at: number;
  payment_method: string;
  items: Array<{
    id: string;
    product_id: string;
    product_name: string;
    quantity: number;
    price: number;
    total: number;
    already_returned: number;
  }>;
}

export async function getSaleForReturn(saleId: string): Promise<SaleForReturn | null> {
  const db = await getDb();
  const [sale] = await db.select<{ id: string; total: number; created_at: number; payment_method: string }[]>(
    `SELECT id, total, created_at, payment_method FROM sales WHERE id = ?`, [saleId]
  );
  if (!sale) return null;

  const items = await db.select<{
    id: string; product_id: string; product_name: string;
    quantity: number; price: number; total: number; already_returned: number;
  }[]>(
    `SELECT si.*,
       COALESCE((SELECT SUM(r.quantity) FROM returns r WHERE r.sale_id = ? AND r.product_id = si.product_id), 0) as already_returned
     FROM sale_items si WHERE si.sale_id = ?`,
    [saleId, saleId]
  );

  return { ...sale, items };
}

// Возврат без чека — просто по товару
export async function returnWithoutReceipt(data: {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  reason?: string;
  shiftId?: string;
}): Promise<void> {
  const db = await getDb();
  const now = Date.now();

  await db.execute(
    `INSERT INTO returns (id, sale_id, product_id, product_name, quantity, price, total, reason, shift_id, created_at)
     VALUES (?, 'no-receipt', ?, ?, ?, ?, ?, ?, ?, ?)`,
    [generateId(), data.productId, data.productName, data.quantity, data.price, data.quantity * data.price, data.reason ?? null, data.shiftId ?? null, now]
  );

  await db.execute(
    `UPDATE products SET quantity = quantity + ?, updated_at = ? WHERE id = ?`,
    [data.quantity, now, data.productId]
  );

  await db.execute(
    `INSERT INTO movements (id, product_id, type, quantity, price, note, created_at)
     VALUES (?, ?, 'in', ?, ?, 'Возврат без чека', ?)`,
    [generateId(), data.productId, data.quantity, data.price, now]
  );
}

export async function createReturn(data: {
  saleId: string;
  items: Array<{ productId: string; productName: string; quantity: number; price: number }>;
  reason?: string;
  shiftId?: string;
}): Promise<void> {
  const db = await getDb();
  const now = Date.now();

  for (const item of data.items) {
    if (item.quantity <= 0) continue;

    await db.execute(
      `INSERT INTO returns (id, sale_id, product_id, product_name, quantity, price, total, reason, shift_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [generateId(), data.saleId, item.productId, item.productName, item.quantity, item.price, item.quantity * item.price, data.reason ?? null, data.shiftId ?? null, now]
    );

    // Восстанавливаем остаток
    await db.execute(
      `UPDATE products SET quantity = quantity + ?, updated_at = ? WHERE id = ?`,
      [item.quantity, now, item.productId]
    );

    // Движение
    await db.execute(
      `INSERT INTO movements (id, product_id, type, quantity, price, note, created_at)
       VALUES (?, ?, 'in', ?, ?, ?, ?)`,
      [generateId(), item.productId, item.quantity, item.price, `Возврат по чеку #${data.saleId.slice(0,8)}`, now]
    );
  }
}
