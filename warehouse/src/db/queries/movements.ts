// src/db/queries/movements.ts
import { getDb } from "../index";
import { generateId } from "../../lib/utils";

export interface MovementWithProduct {
  id: string;
  product_id: string;
  type: string;
  quantity: number;
  price: number | null;
  note: string | null;
  created_at: number | null;
  product_name: string;
  product_sku: string | null;
}

export async function getMovements(filters?: {
  productId?: string;
  type?: string;
  limit?: number;
}): Promise<MovementWithProduct[]> {
  const db = await getDb();
  const params: unknown[] = [];

  let sql = `
    SELECT m.*, p.name as product_name, p.sku as product_sku
    FROM movements m
    INNER JOIN products p ON m.product_id = p.id
    WHERE 1=1
  `;

  if (filters?.productId) { sql += ` AND m.product_id = ?`; params.push(filters.productId); }
  if (filters?.type)      { sql += ` AND m.type = ?`;       params.push(filters.type); }

  sql += ` ORDER BY m.created_at DESC LIMIT ?`;
  params.push(filters?.limit ?? 200);

  return db.select<MovementWithProduct[]>(sql, params);
}

export async function receiveStock(data: {
  productId: string;
  quantity: number;
  price?: number;
  note?: string;
}): Promise<void> {
  const db = await getDb();
  const now = Date.now();
  await db.execute(
    `INSERT INTO movements (id, product_id, type, quantity, price, note, created_at)
     VALUES (?,?,?,?,?,?,?)`,
    [generateId(), data.productId, "in", data.quantity, data.price ?? null, data.note ?? null, now]
  );
  await db.execute(
    `UPDATE products SET quantity = quantity + ?, updated_at = ? WHERE id = ?`,
    [data.quantity, now, data.productId]
  );
}

export async function writeOffStock(data: {
  productId: string;
  quantity: number;
  note?: string;
}): Promise<void> {
  const db = await getDb();

  const rows = await db.select<{ quantity: number }[]>(
    `SELECT quantity FROM products WHERE id = ?`, [data.productId]
  );
  const current = rows[0]?.quantity ?? 0;
  if (current < data.quantity) {
    throw new Error(`Недостаточно товара. Доступно: ${current}`);
  }

  const now = Date.now();
  await db.execute(
    `INSERT INTO movements (id, product_id, type, quantity, price, note, created_at)
     VALUES (?,?,?,?,?,?,?)`,
    [generateId(), data.productId, "out", data.quantity, null, data.note ?? null, now]
  );
  await db.execute(
    `UPDATE products SET quantity = quantity - ?, updated_at = ? WHERE id = ?`,
    [data.quantity, now, data.productId]
  );
}

export async function adjustStock(data: {
  productId: string;
  newQuantity: number;
  note?: string;
}): Promise<void> {
  const db = await getDb();

  const rows = await db.select<{ quantity: number }[]>(
    `SELECT quantity FROM products WHERE id = ?`, [data.productId]
  );
  const current = rows[0]?.quantity ?? 0;
  const diff = data.newQuantity - current;

  const now = Date.now();
  await db.execute(
    `INSERT INTO movements (id, product_id, type, quantity, price, note, created_at)
     VALUES (?,?,?,?,?,?,?)`,
    [
      generateId(), data.productId, "adjustment",
      Math.abs(diff), null,
      data.note ?? `Корректировка: ${diff >= 0 ? "+" : ""}${diff}`,
      now,
    ]
  );
  await db.execute(
    `UPDATE products SET quantity = ?, updated_at = ? WHERE id = ?`,
    [data.newQuantity, now, data.productId]
  );
}
