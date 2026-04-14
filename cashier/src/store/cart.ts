// cashier/src/store/cart.ts
import { create } from "zustand";

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  maxQuantity: number;
  unit: string;
  overStock: boolean; // товар продаётся сверх остатка
}

interface CartStore {
  items: CartItem[];
  addItem: (product: {
    id: string; name: string; sale_price: number;
    quantity: number; unit_short_name: string | null;
  }, allowNegative?: boolean) => "ok" | "no_price" | "added";
  removeItem: (id: string) => void;
  updateQuantity: (id: string, qty: number) => void;
  clear: () => void;
  total: () => number;
  itemCount: () => number;
}

export const useCart = create<CartStore>((set, get) => ({
  items: [],

  addItem: (product, allowNegative = true) => {
    if (!product.sale_price || product.sale_price <= 0) return "no_price";

    const items = get().items;
    const existing = items.find((i) => i.id === product.id);
    const overStock = product.quantity <= 0 || (existing ? existing.quantity >= product.quantity : false);

    if (overStock && !allowNegative) return "ok"; // заблокировано настройками

    if (existing) {
      set({
        items: items.map((i) =>
          i.id === product.id
            ? { ...i, quantity: i.quantity + 1, overStock: i.quantity + 1 > i.maxQuantity }
            : i
        ),
      });
    } else {
      set({
        items: [...items, {
          id: product.id,
          name: product.name,
          price: product.sale_price,
          quantity: 1,
          maxQuantity: Math.max(product.quantity, 0),
          unit: product.unit_short_name ?? "шт",
          overStock: product.quantity <= 0,
        }],
      });
    }
    return "added";
  },

  removeItem: (id) => set({ items: get().items.filter((i) => i.id !== id) }),

  updateQuantity: (id, qty) => {
    if (qty <= 0) { set({ items: get().items.filter((i) => i.id !== id) }); return; }
    set({
      items: get().items.map((i) =>
        i.id === id ? { ...i, quantity: qty, overStock: qty > i.maxQuantity } : i
      ),
    });
  },

  clear: () => set({ items: [] }),
  total: () => get().items.reduce((s, i) => s + i.price * i.quantity, 0),
  itemCount: () => get().items.reduce((s, i) => s + i.quantity, 0),
}));
