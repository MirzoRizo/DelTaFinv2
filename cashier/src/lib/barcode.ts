// src/lib/barcode.ts
// Генерация и парсинг штрих-кодов EAN-13

// ─── Контрольная цифра EAN-13 ────────────────────────────────
export function ean13CheckDigit(digits12: string): number {
  const d = digits12.split("").map(Number);
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += d[i] * (i % 2 === 0 ? 1 : 3);
  }
  return (10 - (sum % 10)) % 10;
}

export function makeEan13(digits12: string): string {
  return digits12 + ean13CheckDigit(digits12);
}

export function validateEan13(barcode: string): boolean {
  if (!/^\d{13}$/.test(barcode)) return false;
  const check = ean13CheckDigit(barcode.slice(0, 12));
  return check === parseInt(barcode[12]);
}

// ─── Внутренний штрих-код (префикс 200) ──────────────────────
// Формат: 200 + 9 случайных цифр + контрольная
export function generateInternalBarcode(): string {
  const random9 = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10)).join("");
  return makeEan13("200" + random9);
}

// ─── PLU-код для весового товара ─────────────────────────────
// PLU — 5-значный внутренний номер (00001–99999)
export function generatePluCode(existingCodes: number[]): number {
  const max = existingCodes.length > 0 ? Math.max(...existingCodes) : 0;
  return max + 1;
}

// Штрих-код весового товара (для настройки весов):
// Формат: 2 + PLU(5 цифр) + 00000 + контрольная
// Вес кодируется весами в момент печати
export function generateWeightBarcode(plu: number): string {
  const pluStr = String(plu).padStart(5, "0");
  return makeEan13("2" + pluStr + "00000");
}

// ─── Парсинг весового штрих-кода с кассы ─────────────────────
// Весы печатают: 2 + PLU(5) + вес_в_граммах(5) + контрольная
export interface WeightBarcodeData {
  plu: number;
  weightKg: number;
}

export function parseWeightBarcode(barcode: string): WeightBarcodeData | null {
  if (!/^\d{13}$/.test(barcode)) return null;
  if (barcode[0] !== "2") return null;
  if (!validateEan13(barcode)) return null;

  const plu = parseInt(barcode.slice(1, 6));
  const weightGrams = parseInt(barcode.slice(6, 11));
  return { plu, weightKg: weightGrams / 1000 };
}

export type BarcodeType = "standard" | "internal" | "weight";

export const BARCODE_TYPE_LABELS: Record<BarcodeType, string> = {
  standard: "Готовый штрих-код",
  internal: "Сгенерировать (внутренний)",
  weight:   "Весовой (PLU)",
};
