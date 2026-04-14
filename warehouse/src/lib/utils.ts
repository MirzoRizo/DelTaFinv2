// src/lib/utils.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }
export function generateId(): string { return crypto.randomUUID(); }

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("ru-UZ", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount) + " сум";
}
export function formatNumber(n: number, decimals = 2): string {
  return new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 0, maximumFractionDigits: decimals }).format(n);
}
export function formatDate(ts: Date | number | null | undefined): string {
  if (!ts) return "—";
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(typeof ts === "number" ? new Date(ts) : ts);
}
export function formatTime(ts: number | null | undefined): string {
  if (!ts) return "—";
  return new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(ts));
}
export function debounce<T extends (...args: unknown[]) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout>;
  return ((...args: unknown[]) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); }) as T;
}
