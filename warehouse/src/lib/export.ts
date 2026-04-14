// src/lib/export.ts
// Экспорт данных в Excel (XLSX) и CSV
// Используем библиотеку xlsx (sheetjs) — самая популярная для браузера/Tauri

import * as XLSX from "xlsx";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import type { ProductWithRelations } from "../db/schema";
import type { MovementWithProduct } from "../db/queries/movements";
import { formatDate } from "./utils";

// ─── ЭКСПОРТ ТОВАРОВ ─────────────────────────────────────────

export async function exportProductsToExcel(products: ProductWithRelations[]) {
  const rows = products.map((p) => ({
    "Название": p.name,
    "Артикул": p.sku ?? "",
    "Штрих-код": p.barcode ?? "",
    "Категория": p.category?.name ?? "",
    "Единица": p.unit?.shortName ?? "шт",
    "Остаток": p.quantity,
    "Мин. остаток": p.minQuantity,
    "Себестоимость": p.costPrice,
    "Цена продажи": p.salePrice,
    "Сумма (себест.)": p.quantity * (p.costPrice ?? 0),
    "Дата обновления": formatDate(p.updatedAt),
  }));

  await exportToXlsx(rows, "Товары", "tovary");
}

export async function exportProductsToCsv(products: ProductWithRelations[]) {
  const headers = ["Название", "Артикул", "Штрих-код", "Категория", "Остаток", "Цена продажи"];
  const rows = products.map((p) => [
    p.name,
    p.sku ?? "",
    p.barcode ?? "",
    p.category?.name ?? "",
    p.quantity,
    p.salePrice,
  ]);

  await exportToCsv([headers, ...rows], "tovary");
}

// ─── ЭКСПОРТ ДВИЖЕНИЙ ────────────────────────────────────────

export async function exportMovementsToExcel(movements: MovementWithProduct[]) {
  const typeLabel: Record<string, string> = {
    in: "Приём",
    out: "Списание",
    sale: "Продажа",
    adjustment: "Корректировка",
  };

  const rows = movements.map((m) => ({
    "Дата": formatDate(m.createdAt),
    "Тип": typeLabel[m.type] ?? m.type,
    "Товар": m.product.name,
    "Артикул": m.product.sku ?? "",
    "Количество": m.quantity,
    "Цена": m.price ?? "",
    "Сумма": m.price ? m.quantity * m.price : "",
    "Примечание": m.note ?? "",
  }));

  await exportToXlsx(rows, "Движения", "dvizheniya");
}

// ─── ОБЩИЕ ФУНКЦИИ ───────────────────────────────────────────

async function exportToXlsx(rows: Record<string, unknown>[], sheetName: string, filename: string) {
  const ws = XLSX.utils.json_to_sheet(rows);

  // Ширина колонок
  const colWidths = Object.keys(rows[0] ?? {}).map((key) => ({
    wch: Math.max(key.length, 12),
  }));
  ws["!cols"] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  // Диалог сохранения файла (нативный через Tauri)
  const path = await save({
    defaultPath: `${filename}_${dateStamp()}.xlsx`,
    filters: [{ name: "Excel", extensions: ["xlsx"] }],
  });

  if (!path) return; // пользователь отменил

  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  await writeFile(path, new Uint8Array(buf));
}

async function exportToCsv(rows: unknown[][], filename: string) {
  const csv = rows
    .map((row) =>
      row
        .map((cell) => {
          const s = String(cell ?? "");
          return s.includes(",") || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(",")
    )
    .join("\n");

  // BOM для корректного открытия в Excel с кириллицей
  const bom = "\uFEFF";
  const content = bom + csv;

  const path = await save({
    defaultPath: `${filename}_${dateStamp()}.csv`,
    filters: [{ name: "CSV", extensions: ["csv"] }],
  });

  if (!path) return;

  const encoder = new TextEncoder();
  await writeFile(path, encoder.encode(content));
}

function dateStamp() {
  return new Date().toISOString().slice(0, 10).replace(/-/g, "");
}
