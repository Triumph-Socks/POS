import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { db, getMeta, setMeta, wipeAll } from "../lib/db";
import { seedCustomers, seedHeld, seedLedger, seedProducts, seedSales } from "../lib/seed";
import {
  round3, sfx, uid,
  type CartLine, type Customer, type HeldCart, type LedgerEntry, type Payment, type Product,
  type Sale, type SaleLine, type ToastKind,
} from "../lib/core";

export type View = "pos" | "inventory" | "customers" | "dashboard";
export interface Toast { id: string; kind: ToastKind; msg: string }

interface StoreShape {
  booted: boolean;
  view: View; setView: (v: View) => void;
  products: Product[]; customers: Customer[]; sales: Sale[]; ledger: LedgerEntry[]; held: HeldCart[];
  cart: CartLine[]; cartCustomerId?: string; discountPct: number;
  setCartCustomer: (id?: string) => void; setDiscountPct: (n: number) => void;
  addToCart: (p: Product, qty?: number) => boolean;
  setLineQty: (key: string, qty: number) => void; removeLine: (key: string) => void; clearCart: () => void;
  holdCart: () => void; resumeHeld: (id: string) => void; deleteHeld: (id: string) => void;
  completeSale: (payments: Payment[]) => Promise<Sale>;
  upsertProduct: (p: Product) => void; deleteProduct: (id: string) => void; adjustStock: (id: string, delta: number) => void;
  upsertCustomer: (c: Customer) => void;
  recordPayment: (customerId: string, amount: number, note: string) => LedgerEntry;
  online: boolean; simOffline: boolean; setSimOffline: (b: boolean) => void;
  queueCount: number; syncing: boolean; lastSync: number;
  toasts: Toast[]; pushToast: (kind: ToastKind, msg: string) => void; dismissToast: (id: string) => void;
  resetDemo: () => Promise<void>;
}

const Ctx = createContext<StoreShape | null>(null);

export function useStore(): StoreShape {
  const v = useContext(Ctx);
  if (!v) throw new Error("store missing");
  return v;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [booted, setBooted] = useState(false);
  const [view, setView] = useState<View>("pos");
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [held, setHeld] = useState<HeldCart[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartCustomerId, setCartCustomerId] = useState<string | undefined>(undefined);
  const [discountPct, setDiscountPct] = useState(0);

  const [browserOnline, setBrowserOnline] = useState(navigator.onLine);
  const [simOffline, setSimOffline] = useState(false);
  const [queueCount, setQueueCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(Date.now());
  const [toasts, setToasts] = useState<Toast[]>([]);

  const online = browserOnline && !simOffline;
  const onlineRef = useRef(online);
  onlineRef.current = online;

  const pushToast = useCallback((kind: ToastKind, msg: string) => {
    const id = uid("T");
    setToasts((t) => [...t.slice(-3), { id, kind, msg }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3800);
  }, []);
  const dismissToast = useCallback((id: string) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  // ---------- boot / seed ----------
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const count = await db.products.count();
        if (count === 0) {
          const p = seedProducts();
          const c = seedCustomers();
          await db.products.bulkPut(p);
          await db.customers.bulkPut(c);
          await db.sales.bulkPut(seedSales(p, c));
          await db.ledger.bulkPut(seedLedger());
          await db.held.bulkPut(seedHeld(p));
          await setMeta("seededAt", Date.now());
        }
        const [p, c, s, l, h, q] = await Promise.all([
          db.products.toArray(), db.customers.toArray(), db.sales.orderBy("ts").reverse().toArray(),
          db.ledger.orderBy("ts").reverse().toArray(), db.held.toArray(), getMeta<string[]>("syncQueue", []),
        ]);
        if (!live) return;
        setProducts(p); setCustomers(c); setSales(s); setLedger(l); setHeld(h); setQueueCount(q.length);
      } catch {
        // IndexedDB unavailable — run fully in-memory from seeds
        if (!live) return;
        const p = seedProducts(); const c = seedCustomers();
        setProducts(p); setCustomers(c); setSales(seedSales(p, c)); setLedger(seedLedger()); setHeld(seedHeld(p));
      }
      if (live) setBooted(true);
    })();
    return () => { live = false; };
  }, []);

  // ---------- connectivity listeners ----------
  useEffect(() => {
    const on = () => setBrowserOnline(true);
    const off = () => setBrowserOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  // ---------- sync engine: drains queued sales when online ----------
  useEffect(() => {
    if (!booted) return;
    if (!online) { setSyncing(false); return; }
    const t = window.setInterval(async () => {
      const q = await getMeta<string[]>("syncQueue", []);
      if (q.length > 0) {
        setSyncing(true);
        setQueueCount(q.length);
        await new Promise((r) => setTimeout(r, 550));
        const rest = q.slice(1);
        await setMeta("syncQueue", rest);
        setQueueCount(rest.length);
        setLastSync(Date.now());
        if (rest.length === 0) setSyncing(false);
      } else {
        setSyncing(false);
        setQueueCount(0);
      }
    }, 1100);
    return () => window.clearInterval(t);
  }, [online, booted]);

  const enqueue = useCallback(async (saleId: string) => {
    const q = await getMeta<string[]>("syncQueue", []);
    await setMeta("syncQueue", [...q, saleId]);
    setQueueCount(q.length + 1);
  }, []);

  // ---------- cart ----------
  const addToCart = useCallback((p: Product, qty = p.unit === "kg" ? 1 : 1): boolean => {
    if (p.stock <= 0) { sfx.bad(); pushToast("error", `${p.name} is out of stock`); return false; }
    let capped = false;
    setCart((c) => {
      const existing = c.find((l) => l.productId === p.id);
      if (existing && p.unit === "ea") {
        if (existing.qty >= p.stock) { capped = true; return c; }
        return c.map((l) => (l.productId === p.id ? { ...l, qty: Math.min(p.stock, l.qty + qty) } : l));
      }
      if (existing && p.unit === "kg") {
        const nq = round3(existing.qty + qty);
        if (existing.qty >= p.stock) { capped = true; return c; }
        return c.map((l) => (l.productId === p.id ? { ...l, qty: Math.min(p.stock, nq) } : l));
      }
      const line: CartLine = {
        key: p.id + "-" + (c.length + 1), productId: p.id, name: p.name, brand: p.brand,
        category: p.category, unit: p.unit, price: p.price, cost: p.cost,
        qty: Math.min(p.stock, round3(qty)), barcode: p.barcode,
      };
      return [...c, line];
    });
    if (capped) { sfx.bad(); pushToast("warn", `Only ${p.stock} in stock for ${p.name}`); return false; }
    sfx.tap();
    return true;
  }, [pushToast]);

  const setLineQty = useCallback((key: string, qty: number) => {
    setCart((c) => c.map((l) => (l.key === key ? { ...l, qty: Math.max(0, round3(qty)) } : l)).filter((l) => l.qty > 0));
  }, []);
  const removeLine = useCallback((key: string) => setCart((c) => c.filter((l) => l.key !== key)), []);
  const clearCart = useCallback(() => { setCart([]); setCartCustomerId(undefined); setDiscountPct(0); }, []);

  // ---------- hold / resume ----------
  const holdCart = useCallback(() => {
    if (cart.length === 0) { pushToast("warn", "Cart is empty — nothing to hold"); return; }
    const cust = customers.find((x) => x.id === cartCustomerId);
    const h: HeldCart = {
      id: uid("H"), ts: Date.now(),
      label: `Hold #${held.length + 1} · ${cust ? cust.name : "walk-in"}`,
      customerId: cartCustomerId, discountPct, lines: cart,
    };
    setHeld((hh) => [h, ...hh]);
    void db.held.put(h);
    sfx.hold();
    pushToast("info", `Bill held — ${cart.length} item${cart.length > 1 ? "s" : ""} parked`);
    setCart([]); setCartCustomerId(undefined); setDiscountPct(0);
  }, [cart, customers, cartCustomerId, discountPct, held.length, pushToast]);

  const resumeHeld = useCallback((id: string) => {
    const h = held.find((x) => x.id === id);
    if (!h) return;
    if (cart.length > 0) {
      const swap: HeldCart = { id: uid("H"), ts: Date.now(), label: `Hold · auto-parked`, customerId: cartCustomerId, discountPct, lines: cart };
      setHeld((hh) => [swap, ...hh.filter((x) => x.id !== id)]);
      void db.held.put(swap);
    } else {
      setHeld((hh) => hh.filter((x) => x.id !== id));
    }
    void db.held.delete(id);
    setCart(h.lines); setCartCustomerId(h.customerId); setDiscountPct(h.discountPct);
    setView("pos");
    sfx.chime();
    pushToast("success", `Resumed ${h.label}`);
  }, [held, cart, cartCustomerId, discountPct, pushToast]);

  const deleteHeld = useCallback((id: string) => {
    setHeld((hh) => hh.filter((x) => x.id !== id));
    void db.held.delete(id);
  }, []);

  // ---------- checkout ----------
  const completeSale = useCallback(async (payments: Payment[]): Promise<Sale> => {
    const subtotal = round3(cart.reduce((a, l) => a + l.price * l.qty, 0));
    const discount = Math.round(subtotal * discountPct) / 100;
    const total = Math.round((subtotal - discount) * 100) / 100;
    const cost = round3(cart.reduce((a, l) => a + l.cost * l.qty, 0));
    const lines: SaleLine[] = cart.map((l) => ({
      productId: l.productId, name: l.name, category: l.category, unit: l.unit,
      price: l.price, cost: l.cost, qty: l.qty, total: round3(l.price * l.qty),
    }));
    const sale: Sale = {
      id: uid("A"), ts: Date.now(), lines,
      itemCount: cart.reduce((a, l) => a + (l.unit === "ea" ? l.qty : 1), 0),
      subtotal, discount, total, cost,
      profit: Math.round((subtotal - discount - cost) * 100) / 100,
      payments, customerId: cartCustomerId, cashier: "R. Chen",
    };

    // stock deduction
    const nextProducts = products.map((p) => {
      const line = lines.find((l) => l.productId === p.id);
      return line ? { ...p, stock: Math.max(0, round3(p.stock - line.qty)) } : p;
    });
    setProducts(nextProducts);
    void db.products.bulkPut(nextProducts.filter((p) => lines.some((l) => l.productId === p.id)));

    // customer ledger effects
    const onCredit = payments.filter((p) => p.method === "on_credit").reduce((a, p) => a + p.amount, 0);
    const fromCredit = payments.filter((p) => p.method === "store_credit").reduce((a, p) => a + p.amount, 0);
    if (cartCustomerId && (onCredit > 0 || fromCredit > 0)) {
      const cust = customers.find((c) => c.id === cartCustomerId);
      if (cust) {
        let balance = cust.balance;
        let credit = cust.storeCredit;
        const entries: LedgerEntry[] = [];
        if (onCredit > 0) {
          balance = round3(balance + onCredit);
          entries.push({ id: uid("L"), customerId: cust.id, ts: sale.ts, type: "credit_sale", amount: onCredit, note: `Khata sale ${sale.id}`, balanceAfter: balance });
        }
        if (fromCredit > 0) {
          credit = round3(Math.max(0, credit - fromCredit));
          entries.push({ id: uid("L"), customerId: cust.id, ts: sale.ts, type: "credit_purchase", amount: fromCredit, note: `Wallet used on ${sale.id}`, balanceAfter: balance });
        }
        const updated = { ...cust, balance, storeCredit: credit };
        setCustomers((cs) => cs.map((c) => (c.id === cust.id ? updated : c)));
        setLedger((l) => [...entries, ...l]);
        void db.customers.put(updated);
        void db.ledger.bulkPut(entries);
      }
    }

    setSales((s) => [sale, ...s]);
    void db.sales.put(sale);

    if (!onlineRef.current) {
      await enqueue(sale.id);
      pushToast("warn", "Offline — receipt queued for cloud sync");
    } else {
      setLastSync(Date.now());
    }
    clearCart();
    sfx.chime();
    return sale;
  }, [cart, discountPct, cartCustomerId, products, customers, enqueue, clearCart, pushToast]);

  // ---------- inventory CRUD ----------
  const upsertProduct = useCallback((p: Product) => {
    setProducts((ps) => {
      const exists = ps.some((x) => x.id === p.id);
      return exists ? ps.map((x) => (x.id === p.id ? p : x)) : [p, ...ps];
    });
    void db.products.put(p);
  }, []);
  const deleteProduct = useCallback((id: string) => {
    setProducts((ps) => ps.filter((x) => x.id !== id));
    void db.products.delete(id);
  }, []);
  const adjustStock = useCallback((id: string, delta: number) => {
    setProducts((ps) => {
      const next = ps.map((p) => (p.id === id ? { ...p, stock: Math.max(0, round3(p.stock + delta)) } : p));
      const hit = next.find((p) => p.id === id);
      if (hit) void db.products.put(hit);
      return next;
    });
    sfx.tap();
  }, []);

  // ---------- customers ----------
  const upsertCustomer = useCallback((c: Customer) => {
    setCustomers((cs) => {
      const exists = cs.some((x) => x.id === c.id);
      return exists ? cs.map((x) => (x.id === c.id ? c : x)) : [...cs, c];
    });
    void db.customers.put(c);
  }, []);

  const recordPayment = useCallback((customerId: string, amount: number, note: string): LedgerEntry => {
    const cust = customers.find((c) => c.id === customerId);
    const balance = cust ? round3(Math.max(0, cust.balance - amount)) : 0;
    const entry: LedgerEntry = { id: uid("L"), customerId, ts: Date.now(), type: "payment", amount: -amount, note, balanceAfter: balance };
    if (cust) {
      const updated = { ...cust, balance };
      setCustomers((cs) => cs.map((c) => (c.id === customerId ? updated : c)));
      void db.customers.put(updated);
    }
    setLedger((l) => [entry, ...l]);
    void db.ledger.put(entry);
    return entry;
  }, [customers]);

  // ---------- demo reset ----------
  const resetDemo = useCallback(async () => {
    await wipeAll();
    const p = seedProducts(); const c = seedCustomers();
    await db.products.bulkPut(p); await db.customers.bulkPut(c);
    await db.sales.bulkPut(seedSales(p, c)); await db.ledger.bulkPut(seedLedger()); await db.held.bulkPut(seedHeld(p));
    setProducts(p); setCustomers(c);
    setSales(await db.sales.orderBy("ts").reverse().toArray());
    setLedger(await db.ledger.orderBy("ts").reverse().toArray());
    setHeld(await db.held.toArray());
    setCart([]); setCartCustomerId(undefined); setDiscountPct(0);
    pushToast("success", "Demo data regenerated");
  }, [pushToast]);

  const value = useMemo<StoreShape>(() => ({
    booted, view, setView,
    products, customers, sales, ledger, held,
    cart, cartCustomerId, discountPct,
    setCartCustomer: setCartCustomerId, setDiscountPct,
    addToCart, setLineQty, removeLine, clearCart,
    holdCart, resumeHeld, deleteHeld,
    completeSale, upsertProduct, deleteProduct, adjustStock,
    upsertCustomer, recordPayment,
    online, simOffline, setSimOffline,
    queueCount, syncing, lastSync,
    toasts, pushToast, dismissToast, resetDemo,
  }), [booted, view, products, customers, sales, ledger, held, cart, cartCustomerId, discountPct,
    addToCart, setLineQty, removeLine, clearCart, holdCart, resumeHeld, deleteHeld, completeSale,
    upsertProduct, deleteProduct, adjustStock, upsertCustomer, recordPayment, online, simOffline,
    queueCount, syncing, lastSync, toasts, pushToast, dismissToast, resetDemo]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
