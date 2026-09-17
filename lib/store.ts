import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { type Product } from './supabase'

export interface CartItem {
  product: Product;
  quantity: number;
  size?: string | null;
  color?: string | null;
}

interface StoreState {
  items: CartItem[];
  addToCart: (product: Product, quantity: number, size?: string | null, color?: string | null) => void;
  removeFromCart: (productId: string, size?: string | null, color?: string | null) => void;
  updateQuantity: (productId: string, quantity: number, size?: string | null, color?: string | null) => void;
  clearCart: () => void;
  getCartSubtotal: () => number;
  getCartDiscount: () => number;
  getCartTotal: () => number;
  getCartCount: () => number;
}

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      items: [],
      addToCart: (product, quantity, size = null, color = null) => {
        set((state) => {
          const existingItem = state.items.find(
            (item) => item.product.id === product.id && item.size === size && item.color === color
          );
          if (existingItem) {
            return {
              items: state.items.map((item) =>
                item.product.id === product.id && item.size === size && item.color === color
                  ? { ...item, quantity: item.quantity + quantity }
                  : item
              ),
            };
          }
          return { items: [...state.items, { product, quantity, size, color }] };
        });
      },
      removeFromCart: (productId, size = null, color = null) => {
        set((state) => ({
          items: state.items.filter(
            (item) => !(item.product.id === productId && item.size === size && item.color === color)
          ),
        }));
      },
      updateQuantity: (productId, quantity, size = null, color = null) => set((state) => ({
        items: state.items.map((item) =>
          item.product.id === productId && item.size === size && item.color === color
            ? { ...item, quantity: Math.max(1, quantity) }
            : item
        ),
      })),
      clearCart: () => set({ items: [] }),
      getCartSubtotal: () => {
        const { items } = get();
        return items.reduce((total, item) => total + item.product.price_mxn * item.quantity, 0);
      },
      getCartDiscount: () => {
        const { items } = get();
        let totalDiscount = 0;
        
        // Group items by product.id to apply discounts across variants
        const grouped = new Map<string, { product: Product, quantity: number }>();
        items.forEach(item => {
          if (!grouped.has(item.product.id)) {
            grouped.set(item.product.id, { product: item.product, quantity: 0 });
          }
          grouped.get(item.product.id)!.quantity += item.quantity;
        });
        
        grouped.forEach(group => {
          let bundlePricing = group.product.bundle_pricing;
          if (typeof bundlePricing === 'string') {
            try {
              bundlePricing = JSON.parse(bundlePricing);
            } catch (e) {
              bundlePricing = [];
            }
          }
          if (!Array.isArray(bundlePricing) || bundlePricing.length === 0) return;
          
          let remainingQty = group.quantity;
          let bestPriceTotal = 0;
          
          // Sort tiers descending by qty
          const tiers = [...bundlePricing].sort((a: any, b: any) => (Number(b.qty) || 0) - (Number(a.qty) || 0));
          
          for (const tier of tiers) {
            const tierQty = Number(tier.qty) || 0;
            const tierPrice = Number(tier.price) || 0;
            if (tierQty > 0 && remainingQty >= tierQty) {
              const bundles = Math.floor(remainingQty / tierQty);
              bestPriceTotal += bundles * tierPrice;
              remainingQty %= tierQty;
            }
          }
          // Add remaining single items at base price
          bestPriceTotal += remainingQty * group.product.price_mxn;
          
          const basePriceTotal = group.quantity * group.product.price_mxn;
          const discount = basePriceTotal - bestPriceTotal;
          if (discount > 0) {
            totalDiscount += discount;
          }
        });
        
        return totalDiscount;
      },
      getCartTotal: () => {
        const { getCartSubtotal, getCartDiscount } = get();
        return getCartSubtotal() - getCartDiscount();
      },
      getCartCount: () => {
        const { items } = get();
        return items.reduce((count, item) => count + item.quantity, 0);
      },
    }),
    {
      name: 'distrito-pipa-cart',
    }
  )
)
