// src/db/queries/categories.ts
import { getDb } from "../index";
import { generateId } from "../../lib/utils";

export interface Category {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  created_at: number | null;
  productCount: number;
}

export async function getCategories(): Promise<Category[]> {
  const db = await getDb();
  return db.select<Category[]>(
    `SELECT c.*, COUNT(p.id) as productCount
     FROM categories c
     LEFT JOIN products p ON p.category_id = c.id AND p.is_active = 1
     GROUP BY c.id
     ORDER BY c.name`,
    []
  );
}

export async function createCategory(data: {
  name: string;
  color?: string;
  description?: string;
}): Promise<string> {
  const db = await getDb();
  const id = generateId();
  await db.execute(
    `INSERT INTO categories (id, name, description, color, created_at) VALUES (?,?,?,?,?)`,
    [id, data.name, data.description ?? null, data.color ?? "#6366f1", Date.now()]
  );
  return id;
}

export async function updateCategory(
  id: string,
  data: { name?: string; color?: string; description?: string }
): Promise<void> {
  const db = await getDb();
  const fields: string[] = [];
  const params: unknown[] = [];
  if (data.name !== undefined)        { fields.push("name = ?");        params.push(data.name); }
  if (data.color !== undefined)       { fields.push("color = ?");       params.push(data.color); }
  if (data.description !== undefined) { fields.push("description = ?"); params.push(data.description ?? null); }
  if (fields.length === 0) return;
  params.push(id);
  await db.execute(`UPDATE categories SET ${fields.join(", ")} WHERE id = ?`, params);
}

export async function deleteCategory(id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE products SET category_id = NULL WHERE category_id = ?`, [id]);
  await db.execute(`DELETE FROM categories WHERE id = ?`, [id]);
}
