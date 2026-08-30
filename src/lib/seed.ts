import type { CartLine, Customer, HeldCart, LedgerEntry, Product, Sale, SaleLine } from "./core";
import { mulberry32, round3 } from "./core";

const now = Date.now();
const DAY = 86400000;
const d = (days: number) => now + days * DAY;

export function seedProducts(): Product[] {
  let i = 0;
  const P = (
    name: string, brand: string, category: string, unit: "ea" | "kg",
    price: number, cost: number, stock: number, lowAt: number,
    batch?: string, expiryDays?: number,
  ): Product => {
    i += 1;
    return {
      id: "p" + i,
      name, brand, category, unit, price, cost, stock, lowAt,
      barcode: "8401" + String(7300000 + i * 137).slice(-8) + String(i % 10),
      sku: "GR-" + String(1000 + i),
      batch,
      expiry: expiryDays !== undefined ? d(expiryDays) : undefined,
    };
  };
  return [
    // Produce
    P("Cavendish Bananas", "FarmCo", "produce", "kg", 1.29, 0.8, 42.5, 10, "B-4471-A", 6),
    P("Fuji Apples", "Orchard Row", "produce", "kg", 3.49, 2.1, 28.2, 8, "B-4466-C", 12),
    P("Roma Tomatoes", "Verde", "produce", "kg", 2.99, 1.7, 16.4, 6, "B-4470-B", 5),
    P("Hass Avocado", "Verde", "produce", "ea", 1.99, 1.1, 24, 8, "B-4455-A", 4),
    P("Baby Spinach 250g", "Leaf & Co", "produce", "ea", 3.29, 1.9, 4, 6, "B-4468-D", 3),
    P("Russet Potatoes 2kg", "FarmCo", "produce", "ea", 4.49, 2.6, 33, 8, "B-4449-A", 21),
    // Dairy & Eggs
    P("Whole Milk 1L", "Meadow", "dairy", "ea", 2.49, 1.55, 40, 12, "B-1182-B", 4),
    P("Free-Range Eggs 12pk", "Cluck", "dairy", "ea", 4.99, 3.1, 18, 8, "B-1190-A", 12),
    P("Greek Yogurt 500g", "Meadow", "dairy", "ea", 3.99, 2.4, 12, 6, "B-1195-C", 6),
    P("Salted Butter 250g", "Meadow", "dairy", "ea", 3.79, 2.2, 0, 6, "B-1171-A", 20),
    P("Cheddar Block 400g", "DairyDen", "dairy", "ea", 6.49, 4.1, 9, 5, "B-1166-D", 15),
    // Bakery
    P("Sourdough Loaf", "Crust", "bakery", "ea", 5.49, 2.8, 7, 5, "B-0912-A", 2),
    P("Wholemeal Bread", "Crust", "bakery", "ea", 2.99, 1.4, 14, 6, "B-0915-B", 3),
    P("Butter Croissants 4pk", "Crust", "bakery", "ea", 4.79, 2.3, 5, 6, "B-0918-C", 1),
    P("Blueberry Muffins 2pk", "Crust", "bakery", "ea", 3.49, 1.6, 11, 5, "B-0921-A", 5),
    // Beverages
    P("Filter Coffee 250g", "Ridge Roast", "beverages", "ea", 8.99, 5.6, 21, 6, "B-7702-A"),
    P("Orange Juice 1L", "Sunny Press", "beverages", "ea", 3.99, 2.3, 17, 8, "B-7710-B", 8),
    P("Sparkling Water 6pk", "Fizz", "beverages", "ea", 4.29, 2.4, 26, 8, "B-7716-C"),
    P("Oat Milk 1L", "Harvest", "beverages", "ea", 3.59, 2.1, 3, 6, "B-7721-D", 25),
    P("Green Tea 20 bags", "Leaf & Co", "beverages", "ea", 4.49, 2.6, 19, 6, "B-7727-A"),
    // Snacks
    P("Sea Salt Chips 150g", "Crunch", "snacks", "ea", 2.99, 1.5, 30, 10, "B-3301-B"),
    P("Dark Chocolate 70%", "Cacao Noir", "snacks", "ea", 3.29, 1.8, 22, 8, "B-3308-A"),
    P("Roasted Almonds 200g", "NutHouse", "snacks", "ea", 5.99, 3.7, 13, 6, "B-3312-C"),
    P("Cheese Crackers 250g", "Crunch", "snacks", "ea", 3.79, 2.0, 2, 6, "B-3317-D"),
    P("Granola Bars 6pk", "Harvest", "snacks", "ea", 4.29, 2.3, 15, 6, "B-3322-A"),
    // Pantry
    P("Basmati Rice 2kg", "Golden Field", "pantry", "ea", 7.99, 5.2, 25, 6, "B-5501-A"),
    P("Olive Oil 750ml", "Olea", "pantry", "ea", 11.99, 7.8, 8, 4, "B-5508-B"),
    P("Rolled Oats 1kg", "Harvest", "pantry", "ea", 3.99, 2.2, 27, 8, "B-5512-C"),
    P("Spaghetti 500g", "Pastificio", "pantry", "ea", 1.89, 0.95, 36, 10, "B-5517-D"),
    P("Wildflower Honey 350g", "BeeLine", "pantry", "ea", 6.99, 4.3, 10, 4, "B-5521-A"),
  ];
}

export function seedCustomers(): Customer[] {
  return [
    { id: "c1", name: "Amelia Hart", phone: "+1 415-0132", since: d(-420), balance: 86.4, storeCredit: 25, creditLimit: 150 },
    { id: "c2", name: "Rafael Mendes", phone: "+1 415-0877", since: d(-260), balance: 0, storeCredit: 0, creditLimit: 100 },
    { id: "c3", name: "Priya Nair", phone: "+1 415-2214", since: d(-710), balance: 142.75, storeCredit: 60, creditLimit: 140 },
    { id: "c4", name: "Jonas Keller", phone: "+1 415-3058", since: d(-90), balance: 0, storeCredit: 15, creditLimit: 80 },
    { id: "c5", name: "Fatima Zahra", phone: "+1 415-4491", since: d(-340), balance: 34.2, storeCredit: 0, creditLimit: 120 },
    { id: "c6", name: "Derek Okafor", phone: "+1 415-5527", since: d(-550), balance: 0, storeCredit: 40, creditLimit: 200 },
    { id: "c7", name: "Lena Sørensen", phone: "+1 415-6610", since: d(-150), balance: 12.5, storeCredit: 0, creditLimit: 90 },
    { id: "c8", name: "Marco Bellini", phone: "+1 415-7743", since: d(-820), balance: 210.0, storeCredit: 0, creditLimit: 200 },
  ];
}

export function seedLedger(): LedgerEntry[] {
  const rows: LedgerEntry[] = [];
  const push = (customerId: string, daysAgo: number, type: LedgerEntry["type"], amount: number, note: string, balanceAfter: number) =>
    rows.push({ id: "L-" + rows.length + "-" + customerId, customerId, ts: d(-daysAgo), type, amount, note, balanceAfter });
  push("c1", 21, "credit_sale", 116.4, "Khata sale #A-2231", 116.4);
  push("c1", 9, "payment", -30, "Cash repayment", 86.4);
  push("c3", 14, "credit_sale", 178.75, "Khata sale #A-2287", 178.75);
  push("c3", 6, "payment", -36, "QR repayment", 142.75);
  push("c5", 8, "credit_sale", 34.2, "Khata sale #A-2301", 34.2);
  push("c7", 4, "credit_sale", 12.5, "Khata sale #A-2330", 12.5);
  push("c8", 30, "credit_sale", 165.0, "Khata sale #A-2154", 165.0);
  push("c8", 12, "credit_sale", 45.0, "Khata sale #A-2277", 210.0);
  push("c1", 3, "credit_purchase", 10, "Wallet top-up", 86.4);
  return rows.sort((a, b) => a.ts - b.ts);
}

export function seedSales(products: Product[], customers: Customer[]): Sale[] {
  const rnd = mulberry32(20260214);
  const pick = <T,>(arr: T[]) => arr[Math.floor(rnd() * arr.length)];
  const sales: Sale[] = [];
  const hourWeights = [0, 0, 0, 0, 0, 0, 0, 2, 5, 8, 10, 9, 7, 5, 4, 5, 7, 10, 11, 9, 6, 3, 1, 0];
  const pool = hourWeights.flatMap((w, h) => Array(w).fill(h));
  const cashiers = ["R. Chen", "R. Chen", "M. Ali", "S. Ortiz"];
  let seq = 3100;

  for (let day = 6; day >= 0; day--) {
    const base = new Date(now - day * DAY);
    base.setSeconds(0, 0);
    const count = day === 0 ? 17 : 10 + Math.floor(rnd() * 9);
    for (let s = 0; s < count; s++) {
      const hour = pool[Math.floor(rnd() * pool.length)];
      const ts = new Date(base.getFullYear(), base.getMonth(), base.getDate(), hour, Math.floor(rnd() * 60), Math.floor(rnd() * 60)).getTime();
      const nLines = 1 + Math.floor(rnd() * 5);
      const chosen = new Set<number>();
      while (chosen.size < nLines) chosen.add(Math.floor(rnd() * products.length));
      const lines: SaleLine[] = [...chosen].map((idx) => {
        const p = products[idx];
        const qty = p.unit === "kg" ? round3(0.4 + rnd() * 1.8) : 1 + Math.floor(rnd() * 3);
        return {
          productId: p.id, name: p.name, category: p.category, unit: p.unit,
          price: p.price, cost: p.cost, qty, total: round3(p.price * qty),
        };
      });
      const subtotal = round3(lines.reduce((a, l) => a + l.total, 0));
      const discount = rnd() < 0.15 ? Math.round(subtotal * 0.05 * 100) / 100 : 0;
      const total = Math.round((subtotal - discount) * 100) / 100;
      const cost = round3(lines.reduce((a, l) => a + l.cost * l.qty, 0));
      const cust = rnd() < 0.3 ? pick(customers) : undefined;
      const onCredit = cust && rnd() < 0.12;
      const methods: Sale["payments"] = onCredit
        ? [{ method: "on_credit", amount: total }]
        : (() => {
            const r = rnd();
            if (r < 0.44) return [{ method: "cash" as const, amount: total, tendered: Math.ceil(total / 5) * 5, change: Math.ceil(total / 5) * 5 - total }];
            if (r < 0.72) return [{ method: "card" as const, amount: total }];
            if (r < 0.9) return [{ method: "qr" as const, amount: total }];
            const part = Math.round(total * 0.5 * 100) / 100;
            return [
              { method: "cash" as const, amount: part, tendered: part, change: 0 },
              { method: "card" as const, amount: Math.round((total - part) * 100) / 100 },
            ];
          })();
      seq += 1 + Math.floor(rnd() * 3);
      sales.push({
        id: "A-" + seq, ts, lines,
        itemCount: lines.reduce((a, l) => a + (l.unit === "ea" ? l.qty : 1), 0),
        subtotal, discount, total, cost,
        profit: Math.round((subtotal - discount - cost) * 100) / 100,
        payments: methods, customerId: cust?.id, cashier: pick(cashiers),
      });
    }
  }
  return sales.sort((a, b) => b.ts - a.ts);
}

export function seedHeld(products: Product[]): HeldCart[] {
  const toLine = (p: Product, qty: number): CartLine => ({
    key: p.id + "-1", productId: p.id, name: p.name, brand: p.brand,
    category: p.category, unit: p.unit, price: p.price, cost: p.cost, qty, barcode: p.barcode,
  });
  return [
    {
      id: "H-9F3K", ts: now - 42 * 60000, label: "Hold #1 · walk-in",
      discountPct: 0, lines: [toLine(products[6], 2), toLine(products[11], 1), toLine(products[20], 3)],
    },
  ];
}
