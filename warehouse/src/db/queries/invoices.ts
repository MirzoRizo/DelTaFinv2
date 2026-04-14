// src/db/queries/invoices.ts
import { getDb } from "../index";
import { generateId } from "../../lib/utils";

export type PaymentStatus = "paid" | "debt" | "partial";
export type PaymentMethod = "cash" | "transfer" | "card";

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  price: number;
  total: number;
}

export interface Invoice {
  id: string;
  supplier_id: string | null;
  supplier_name: string;
  invoice_number: string | null;
  payment_status: PaymentStatus;
  payment_method: PaymentMethod;
  due_date: number | null;
  total: number;
  paid_amount: number;
  notes: string | null;
  created_at: number;
  item_count?: number;
}

export interface InvoiceWithItems extends Invoice {
  items: InvoiceItem[];
}

// Список накладных
export async function getInvoices(limit = 100): Promise<Invoice[]> {
  const db = await getDb();
  return db.select<Invoice[]>(
    `SELECT i.*, COUNT(ii.id) as item_count
     FROM invoices i
     LEFT JOIN invoice_items ii ON ii.invoice_id = i.id
     GROUP BY i.id
     ORDER BY i.created_at DESC LIMIT ?`,
    [limit]
  );
}

// Одна накладная с позициями
export async function getInvoiceById(id: string): Promise<InvoiceWithItems | null> {
  const db = await getDb();
  const [inv] = await db.select<Invoice[]>(
    `SELECT i.*, COUNT(ii.id) as item_count FROM invoices i
     LEFT JOIN invoice_items ii ON ii.invoice_id = i.id
     WHERE i.id = ? GROUP BY i.id`,
    [id]
  );
  if (!inv) return null;
  const items = await db.select<InvoiceItem[]>(
    `SELECT * FROM invoice_items WHERE invoice_id = ?`, [id]
  );
  return { ...inv, items };
}

// Создать накладную
export interface CreateInvoiceData {
  supplier_id?: string | null;
  supplier_name: string;
  invoice_number?: string;
  payment_status: PaymentStatus;
  payment_method: PaymentMethod;
  paid_amount: number;
  due_date?: number | null;
  notes?: string;
  items: Array<{
    product_id: string;
    product_name: string;
    quantity: number;
    price: number;
  }>;
}

export async function createInvoice(data: CreateInvoiceData): Promise<string> {
  const db = await getDb();
  const invoiceId = generateId();
  const now = Date.now();
  const total = data.items.reduce((s, i) => s + i.quantity * i.price, 0);

  // 1. Создаём накладную
  await db.execute(
    `INSERT INTO invoices
      (id,supplier_id,supplier_name,invoice_number,payment_status,payment_method,
       due_date,total,paid_amount,notes,created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [
      invoiceId,
      data.supplier_id ?? null,
      data.supplier_name,
      data.invoice_number ?? null,
      data.payment_status,
      data.payment_method,
      data.due_date ?? null,
      total,
      data.paid_amount,
      data.notes ?? null,
      now,
    ]
  );

  // 2. Записываем позиции + обновляем остатки + движения
  for (const item of data.items) {
    await db.execute(
      `INSERT INTO invoice_items (id,invoice_id,product_id,product_name,quantity,price,total)
       VALUES (?,?,?,?,?,?,?)`,
      [generateId(), invoiceId, item.product_id, item.product_name, item.quantity, item.price, item.quantity * item.price]
    );
    // Приём на склад
    await db.execute(
      `UPDATE products SET quantity = quantity + ?, cost_price = ?, updated_at = ? WHERE id = ?`,
      [item.quantity, item.price, now, item.product_id]
    );
    // Движение
    await db.execute(
      `INSERT INTO movements (id,product_id,type,quantity,price,note,invoice_id,created_at)
       VALUES (?,?,'in',?,?,?,?,?)`,
      [generateId(), item.product_id, item.quantity, item.price, `Накладная ${data.invoice_number ?? invoiceId.slice(0,8)}`, invoiceId, now]
    );
  }

  // 3. Обновляем долг поставщика
  if (data.supplier_id && data.payment_status !== "paid") {
    const debt = total - data.paid_amount;
    await db.execute(
      `UPDATE suppliers SET total_debt = total_debt + ? WHERE id = ?`,
      [debt, data.supplier_id]
    );
  }

  return invoiceId;
}

// Оплатить долг по накладной
export async function payInvoiceDebt(invoiceId: string, amount: number): Promise<void> {
  const db = await getDb();
  const [inv] = await db.select<Invoice[]>(
    `SELECT * FROM invoices WHERE id = ?`, [invoiceId]
  );
  if (!inv) return;

  const newPaid = Math.min(inv.paid_amount + amount, inv.total);
  const newStatus: PaymentStatus = newPaid >= inv.total ? "paid" : "partial";

  await db.execute(
    `UPDATE invoices SET paid_amount = ?, payment_status = ? WHERE id = ?`,
    [newPaid, newStatus, invoiceId]
  );

  if (inv.supplier_id) {
    await db.execute(
      `UPDATE suppliers SET total_debt = MAX(0, total_debt - ?) WHERE id = ?`,
      [amount, inv.supplier_id]
    );
  }
}

// Долги по поставщикам
export async function getDebtsBySupplier(): Promise<{ supplier_name: string; total_debt: number; invoice_count: number }[]> {
  const db = await getDb();
  return db.select(
    `SELECT supplier_name,
       SUM(total - paid_amount) as total_debt,
       COUNT(*) as invoice_count
     FROM invoices
     WHERE payment_status != 'paid'
     GROUP BY supplier_name
     ORDER BY total_debt DESC`,
    []
  );
}
