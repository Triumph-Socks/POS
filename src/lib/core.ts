// ---------- Domain types ----------
export type Unit = "ea" | "kg";

export interface Category {
  id: string;
  name: string;
  hue: string; // accent hex used across charts + cards
}

export interface Product {
  id: string;
  name: string;
  brand: string;
  barcode: string;
  sku: string;
  category: string; // category id
  unit: Unit;
  price: number;
  cost: number;
  stock: number;
  lowAt: number;
  batch?: string;
  expiry?: number; // epoch ms
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  since: number;
  balance: number; // outstanding khata (owes store)
  storeCredit: number; // prepaid wallet
  creditLimit: number;
}

export type LedgerType = "credit_sale" | "payment" | "credit_purchase" | "adjust";

export interface LedgerEntry {
  id: string;
  customerId: string;
  ts: number;
  type: LedgerType;
  amount: number; // signed effect on balance for credit_sale(+)/payment(-); absolute otherwise
  note: string;
  balanceAfter: number;
}

export interface SaleLine {
  productId: string;
  name: string;
  category: string;
  unit: Unit;
  price: number;
  cost: number;
  qty: number;
  total: number;
}

export type Method = "cash" | "card" | "qr" | "store_credit" | "on_credit";

export interface Payment {
  method: Method;
  amount: number;
  tendered?: number;
  change?: number;
}

export interface Sale {
  id: string;
  ts: number;
  lines: SaleLine[];
  itemCount: number;
  subtotal: number;
  discount: number;
  total: number;
  cost: number;
  profit: number;
  payments: Payment[];
  customerId?: string;
  cashier: string;
}

export interface CartLine {
  key: string; // productId + seq, allows same product twice at different weights
  productId: string;
  name: string;
  brand: string;
  category: string;
  unit: Unit;
  price: number;
  cost: number;
  qty: number;
  barcode: string;
}

export interface HeldCart {
  id: string;
  ts: number;
  label: string;
  customerId?: string;
  discountPct: number;
  lines: CartLine[];
}

export type ToastKind = "success" | "error" | "info" | "warn";

// ---------- Constants ----------
export const TAX_RATE = 0.05;
export const CHANGE_FUND = 150;

export const CATEGORIES: Category[] = [
  { id: "produce", name: "Produce", hue: "#35c56c" },
  { id: "dairy", name: "Dairy & Eggs", hue: "#6a9ef5" },
  { id: "bakery", name: "Bakery", hue: "#f2b33d" },
  { id: "beverages", name: "Beverages", hue: "#53c6de" },
  { id: "snacks", name: "Snacks", hue: "#f0954f" },
  { id: "pantry", name: "Pantry", hue: "#b48ce0" },
];

export const catName = (id: string) => CATEGORIES.find((c) => c.id === id)?.name ?? id;
export const catHue = (id: string) => CATEGORIES.find((c) => c.id === id)?.hue ?? "#8b9c90";

// ---------- Formatters ----------
export const money = (n: number) =>
  (n < 0 ? "-$" : "$") +
  Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const money0 = (n: number) => "$" + Math.round(n).toLocaleString("en-US");

export const qtyStr = (n: number, unit: Unit) =>
  unit === "kg" ? n.toFixed(3).replace(/0+$/, "").replace(/\.$/, "") + " kg" : String(n);

export const pct = (n: number) => (n >= 0 ? "+" : "") + n.toFixed(1) + "%";

export const timeStr = (ts: number) =>
  new Date(ts).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });

export const dateStr = (ts: number) =>
  new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });

export const dateTimeStr = (ts: number) => `${dateStr(ts)} · ${timeStr(ts)}`;

export const daysUntil = (ts: number) => Math.ceil((ts - Date.now()) / 86400000);

// ---------- IDs & rng ----------
export const uid = (p: string) => p + "-" + Math.random().toString(36).slice(2, 8).toUpperCase();

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const round3 = (n: number) => Math.round(n * 1000) / 1000;

// ---------- Audio cues (WebAudio, no assets) ----------
let ctx: AudioContext | null = null;
function ac(): AudioContext | null {
  try {
    if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}
function tone(freq: number, at: number, dur: number, type: OscillatorType, vol = 0.12) {
  const c = ac();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, c.currentTime + at);
  g.gain.linearRampToValueAtTime(vol, c.currentTime + at + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + at + dur);
  o.connect(g).connect(c.destination);
  o.start(c.currentTime + at);
  o.stop(c.currentTime + at + dur + 0.05);
}
export const sfx = {
  scan: () => { tone(1245, 0, 0.07, "square", 0.09); tone(1660, 0.07, 0.09, "square", 0.08); },
  bad: () => { tone(196, 0, 0.16, "sawtooth", 0.1); tone(147, 0.1, 0.2, "sawtooth", 0.09); },
  tap: () => tone(880, 0, 0.045, "triangle", 0.06),
  chime: () => { tone(660, 0, 0.1, "sine", 0.1); tone(990, 0.09, 0.14, "sine", 0.1); tone(1320, 0.18, 0.22, "sine", 0.09); },
  hold: () => { tone(520, 0, 0.08, "triangle", 0.09); tone(390, 0.08, 0.12, "triangle", 0.08); },
};
