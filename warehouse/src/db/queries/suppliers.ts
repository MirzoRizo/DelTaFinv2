// src/db/queries/suppliers.ts
import { getDb } from "../index";
import { generateId } from "../../lib/utils";

export interface Supplier {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  notes: string | null;
  total_debt: number;
  created_at: number | null;
}

export async function getSuppliers(): Promise<Supplier[]> {
  const db = await getDb();
  return db.select<Supplier[]>(
    `SELECT * FROM suppliers ORDER BY name`, []
  );
}

export async function createSupplier(data: Omit<Supplier, "id" | "created_at" | "total_debt">): Promise<string> {
  const db = await getDb();
  const id = generateId();
  await db.execute(
    `INSERT INTO suppliers (id,name,phone,address,notes,total_debt,created_at) VALUES (?,?,?,?,?,0,?)`,
    [id, data.name, data.phone ?? null, data.address ?? null, data.notes ?? null, Date.now()]
  );
  return id;
}

export async function updateSupplier(id: string, data: Partial<Omit<Supplier, "id" | "created_at">>): Promise<void> {
  const db = await getDb();
  const fields: string[] = [];
  const params: unknown[] = [];
  if (data.name !== undefined)    { fields.push("name = ?");    params.push(data.name); }
  if (data.phone !== undefined)   { fields.push("phone = ?");   params.push(data.phone ?? null); }
  if (data.address !== undefined) { fields.push("address = ?"); params.push(data.address ?? null); }
  if (data.notes !== undefined)   { fields.push("notes = ?");   params.push(data.notes ?? null); }
  if (!fields.length) return;
  params.push(id);
  await db.execute(`UPDATE suppliers SET ${fields.join(", ")} WHERE id = ?`, params);
}
