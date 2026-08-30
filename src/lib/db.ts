import Dexie, { type Table } from "dexie";
import type { Customer, HeldCart, LedgerEntry, Product, Sale } from "./core";

export interface MetaRow {
  key: string;
  value: unknown;
}

class AuraPOSDB extends Dexie {
  products!: Table<Product, string>;
  customers!: Table<Customer, string>;
  sales!: Table<Sale, string>;
  ledger!: Table<LedgerEntry, string>;
  held!: Table<HeldCart, string>;
  meta!: Table<MetaRow, string>;

  constructor() {
    super("aurapos-grocery");
    this.version(1).stores({
      products: "id, barcode, category, name, stock",
      customers: "id, name, balance",
      sales: "id, ts, customerId",
      ledger: "id, customerId, ts",
      held: "id, ts",
      meta: "key",
    });
  }
}

export const db = new AuraPOSDB();

export async function getMeta<T>(key: string, fallback: T): Promise<T> {
  try {
    const row = await db.meta.get(key);
    return row ? (row.value as T) : fallback;
  } catch {
    return fallback;
  }
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  try {
    await db.meta.put({ key, value });
  } catch {
    /* in-memory mode continues regardless */
  }
}

export async function wipeAll(): Promise<void> {
  try {
    await Promise.all([
      db.products.clear(),
      db.customers.clear(),
      db.sales.clear(),
      db.ledger.clear(),
      db.held.clear(),
      db.meta.clear(),
    ]);
  } catch {
    /* noop */
  }
}
