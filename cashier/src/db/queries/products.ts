// cashier/src/db/queries/products.ts
import { getDb } from "../index";

export interface Product {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  sale_price: number;
  quantity: number;
  unit_short_name: string | null;
  category_name: string | null;
  barcode_type: string;
  plu_code: number | null;
}

const BASE = `
  SELECT p.id, p.name, p.sku, p.barcode, p.sale_price, p.quantity,
         p.barcode_type, p.plu_code,
         u.short_name AS unit_short_name,
         c.name AS category_name
  FROM products p
  LEFT JOIN units u ON p.unit_id = u.id
  LEFT JOIN categories c ON p.category_id = c.id
  WHERE p.is_active = 1
`;

// Поиск по названию, артикулу, штрих-коду
export async function searchProducts(query: string): Promise<Product[]> {
  const db = await getDb();
  if (!query.trim()) {
    return db.select<Product[]>(`${BASE} ORDER BY p.name LIMIT 60`, []);
  }
  const t = `%${query}%`;
  return db.select<Product[]>(
    `${BASE} AND (p.name LIKE ? OR p.sku LIKE ? OR p.barcode LIKE ?) ORDER BY p.name LIMIT 40`,
    [t, t, t]
  );
}

// Поиск по штрих-коду или SKU (для сканера)
export async function getProductByBarcode(code: string): Promise<Product | null> {
  const db = await getDb();
  const rows = await db.select<Product[]>(
    `${BASE} AND (p.barcode = ? OR p.sku = ?) LIMIT 1`,
    [code, code]
  );
  return rows[0] ?? null;
}

// Поиск по PLU (для весовых товаров)
export async function getProductByPlu(plu: number): Promise<Product | null> {
  const db = await getDb();
  const rows = await db.select<Product[]>(
    `${BASE} AND p.plu_code = ? LIMIT 1`,
    [plu]
  );
  return rows[0] ?? null;
}
