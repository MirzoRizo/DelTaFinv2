// src/db/queries/sales.ts
import { getDb } from "../index";
import { generateId } from "../../lib/utils";
import type { CartItem } from "../../store/cart";

export interface Sale {
  id: string;
  total: number;
  paid: number;
  change: number;
  payment_method: string;
  note: string | null;
  created_at: number;
  item_count: number;
}

export interface SaleWithItems extends Sale {
  items: SaleItem[];
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  price: number;
  total: number;
}

// Провести продажу — всё в одной транзакции
export async function completeSale(data: {
  items: CartItem[];
  paid: number;
  paymentMethod: "cash" | "card";
  note?: string;
}): Promise<string> {
  const db = await getDb();
  const saleId = generateId();
  const now = Date.now();
  const total = data.items.reduce((s, i) => s + i.price * i.quantity, 0);
  const change = Math.max(0, data.paid - total);

  // 1. Создаём запись продажи
  await db.execute(
    `INSERT INTO sales (id, total, paid, change, payment_method, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [saleId, total, data.paid, change, data.paymentMethod, data.note ?? null, now]
  );

  // 2. Записываем позиции и списываем остатки
  for (const item of data.items) {
    await db.execute(
      `INSERT INTO sale_items (id, sale_id, product_id, product_name, quantity, price, total)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [generateId(), saleId, item.id, item.name, item.quantity, item.price, item.price * item.quantity]
    );
    // Списываем со склада
    await db.execute(
      `UPDATE products SET quantity = quantity - ?, updated_at = ? WHERE id = ?`,
      [item.quantity, now, item.id]
    );
    // Записываем движение
    await db.execute(
      `INSERT INTO movements (id, product_id, type, quantity, price, note, created_at)
       VALUES (?, ?, 'sale', ?, ?, ?, ?)`,
      [generateId(), item.id, item.quantity, item.price, `Продажа #${saleId.slice(0, 8)}`, now]
    );
  }

  return saleId;
}

// История продаж
export async function getSales(limit = 50): Promise<Sale[]> {
  const db = await getDb();
  return db.select<Sale[]>(
    `SELECT s.*, COUNT(si.id) as item_count
     FROM sales s
     LEFT JOIN sale_items si ON si.sale_id = s.id
     GROUP BY s.id
     ORDER BY s.created_at DESC
     LIMIT ?`,
    [limit]
  );
}

// Продажи за сегодня
export async function getTodayStats() {
  const db = await getDb();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [row] = await db.select<{ count: number; total: number }[]>(
    `SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as total
     FROM sales WHERE created_at >= ?`,
    [startOfDay.getTime()]
  );
  return { count: row?.count ?? 0, total: row?.total ?? 0 };
}

// Одна продажа с позициями
export async function getSaleById(id: string): Promise<SaleWithItems | null> {
  const db = await getDb();
  const [sale] = await db.select<Sale[]>(
    `SELECT s.*, COUNT(si.id) as item_count FROM sales s
     LEFT JOIN sale_items si ON si.sale_id = s.id
     WHERE s.id = ? GROUP BY s.id`,
    [id]
  );
  if (!sale) return null;

  const items = await db.select<SaleItem[]>(
    `SELECT * FROM sale_items WHERE sale_id = ?`, [id]
  );
  return { ...sale, items };
}
