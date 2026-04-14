// src/db/queries/products.ts
import { getDb } from "../index";
import { generateId } from "../../lib/utils";
import type { BarcodeType } from "../../lib/barcode";

export interface ProductWithRelations {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  description: string | null;
  category_id: string | null;
  unit_id: string | null;
  cost_price: number;
  sale_price: number;
  quantity: number;
  min_quantity: number;
  is_active: number;
  barcode_type: BarcodeType;
  plu_code: number | null;
  created_at: number | null;
  updated_at: number | null;
  category_name: string | null;
  category_color: string | null;
  unit_short_name: string | null;
}

export interface CreateProductData {
  name: string;
  sku?: string | null;
  barcode?: string | null;
  description?: string | null;
  category_id?: string | null;
  unit_id?: string | null;
  cost_price?: number;
  sale_price?: number;
  quantity?: number;
  min_quantity?: number;
  barcode_type?: BarcodeType;
  plu_code?: number | null;
}

export async function getProducts(filters?: {
  search?: string;
  categoryId?: string;
  lowStock?: boolean;
}): Promise<ProductWithRelations[]> {
  const db = await getDb();
  const params: unknown[] = [];
  let sql = `
    SELECT p.*,
      c.name AS category_name, c.color AS category_color,
      u.short_name AS unit_short_name
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN units u ON p.unit_id = u.id
    WHERE p.is_active = 1`;

  if (filters?.search) {
    const t = `%${filters.search}%`;
    sql += ` AND (p.name LIKE ? OR p.sku LIKE ? OR p.barcode LIKE ?)`;
    params.push(t, t, t);
  }
  if (filters?.categoryId) { sql += ` AND p.category_id = ?`; params.push(filters.categoryId); }
  if (filters?.lowStock) { sql += ` AND p.min_quantity > 0 AND p.quantity <= p.min_quantity`; }
  sql += ` ORDER BY p.updated_at DESC`;
  return db.select<ProductWithRelations[]>(sql, params);
}

export async function getProductByBarcode(barcode: string): Promise<ProductWithRelations | null> {
  const db = await getDb();
  const rows = await db.select<ProductWithRelations[]>(
    `SELECT p.*, c.name AS category_name, c.color AS category_color, u.short_name AS unit_short_name
     FROM products p
     LEFT JOIN categories c ON p.category_id = c.id
     LEFT JOIN units u ON p.unit_id = u.id
     WHERE p.is_active = 1 AND (p.barcode = ? OR p.sku = ?) LIMIT 1`,
    [barcode, barcode]
  );
  return rows[0] ?? null;
}

export async function getProductByPlu(plu: number): Promise<ProductWithRelations | null> {
  const db = await getDb();
  const rows = await db.select<ProductWithRelations[]>(
    `SELECT p.*, c.name AS category_name, c.color AS category_color, u.short_name AS unit_short_name
     FROM products p
     LEFT JOIN categories c ON p.category_id = c.id
     LEFT JOIN units u ON p.unit_id = u.id
     WHERE p.is_active = 1 AND p.plu_code = ? LIMIT 1`,
    [plu]
  );
  return rows[0] ?? null;
}

export async function getMaxPluCode(): Promise<number> {
  const db = await getDb();
  const rows = await db.select<{ max_plu: number | null }[]>(
    `SELECT MAX(plu_code) as max_plu FROM products`, []
  );
  return rows[0]?.max_plu ?? 0;
}

export async function getProductById(id: string): Promise<ProductWithRelations | null> {
  const db = await getDb();
  const rows = await db.select<ProductWithRelations[]>(
    `SELECT p.*, c.name AS category_name, c.color AS category_color, u.short_name AS unit_short_name
     FROM products p
     LEFT JOIN categories c ON p.category_id = c.id
     LEFT JOIN units u ON p.unit_id = u.id
     WHERE p.id = ? LIMIT 1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function createProduct(data: CreateProductData): Promise<string> {
  const db = await getDb();
  const id = generateId();
  const now = Date.now();
  await db.execute(
    `INSERT INTO products
      (id,name,sku,barcode,description,category_id,unit_id,
       cost_price,sale_price,quantity,min_quantity,is_active,
       barcode_type,plu_code,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,1,?,?,?,?)`,
    [
      id, data.name, data.sku ?? null, data.barcode ?? null,
      data.description ?? null, data.category_id ?? null,
      data.unit_id ?? "unit-pcs",
      data.cost_price ?? 0, data.sale_price ?? 0,
      data.quantity ?? 0, data.min_quantity ?? 0,
      data.barcode_type ?? "standard",
      data.plu_code ?? null,
      now, now,
    ]
  );
  return id;
}

export async function updateProduct(id: string, data: Partial<CreateProductData>): Promise<void> {
  const db = await getDb();
  const now = Date.now();
  const fields: string[] = [];
  const params: unknown[] = [];

  const map: [keyof CreateProductData, string][] = [
    ["name","name"],["sku","sku"],["barcode","barcode"],["description","description"],
    ["category_id","category_id"],["unit_id","unit_id"],["cost_price","cost_price"],
    ["sale_price","sale_price"],["min_quantity","min_quantity"],
    ["barcode_type","barcode_type"],["plu_code","plu_code"],
  ];
  for (const [key, col] of map) {
    if (key in data) { fields.push(`${col} = ?`); params.push(data[key] ?? null); }
  }
  if (!fields.length) return;
  fields.push("updated_at = ?");
  params.push(now, id);
  await db.execute(`UPDATE products SET ${fields.join(", ")} WHERE id = ?`, params);
}

export async function deactivateProduct(id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE products SET is_active=0, updated_at=? WHERE id=?`, [Date.now(), id]);
}

export async function getProductStats() {
  const db = await getDb();
  const [t] = await db.select<{count:number}[]>(`SELECT COUNT(*) as count FROM products WHERE is_active=1`,[]);
  const [l] = await db.select<{count:number}[]>(`SELECT COUNT(*) as count FROM products WHERE is_active=1 AND min_quantity>0 AND quantity<=min_quantity`,[]);
  const [v] = await db.select<{total:number}[]>(`SELECT COALESCE(SUM(quantity*cost_price),0) as total FROM products WHERE is_active=1`,[]);
  return { total: t?.count ?? 0, lowStock: l?.count ?? 0, totalValue: v?.total ?? 0 };
}
