import { useEffect, useMemo, useState } from "react";
import {
  createColumnHelper, flexRender, getCoreRowModel, getSortedRowModel, useReactTable, type SortingState,
} from "@tanstack/react-table";
import { motion } from "framer-motion";
import { ArrowUpDown, CalendarClock, Minus, PackagePlus, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useStore } from "../../state/store";
import { CATEGORIES, catHue, catName, dateStr, daysUntil, money, uid, type Product, type Unit } from "../../lib/core";
import { Field, GhostBtn, Modal, ModalHeader, Pill, PrimaryBtn, SectionTitle, StockPill, inputCls } from "../../components/ui";

const col = createColumnHelper<Product>();

export function Inventory() {
  const { products, upsertProduct, deleteProduct, adjustStock, pushToast } = useStore();
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("all");
  const [alertsOnly, setAlertsOnly] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([{ id: "name", desc: false }]);
  const [editing, setEditing] = useState<Product | "new" | null>(null);
  const [deleting, setDeleting] = useState<Product | null>(null);

  const data = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (cat !== "all" && p.category !== cat) return false;
      if (alertsOnly) {
        const alert = p.stock <= p.lowAt || (p.expiry && daysUntil(p.expiry) <= 3);
        if (!alert) return false;
      }
      if (!q) return true;
      return p.name.toLowerCase().includes(q) || p.barcode.includes(q) || p.sku.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q) || (p.batch ?? "").toLowerCase().includes(q);
    });
  }, [products, query, cat, alertsOnly]);

  const columns = useMemo(() => [
    col.accessor("name", {
      header: "Item",
      cell: (i) => {
        const p = i.row.original;
        return (
          <div className="min-w-0">
            <p className="truncate text-[13.5px] font-semibold text-ink-100">{p.name}</p>
            <p className="num text-[11px] text-ink-500">{p.brand} · {p.barcode}</p>
          </div>
        );
      },
    }),
    col.accessor("category", {
      header: "Category",
      cell: (i) => (
        <span className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-300">
          <span className="h-2 w-2 rounded-full" style={{ background: catHue(i.getValue()) }} />
          {catName(i.getValue())}
        </span>
      ),
    }),
    col.accessor("price", {
      header: "Price",
      cell: (i) => <span className="num text-[13px] font-semibold text-ink-100">{money(i.getValue())}{i.row.original.unit === "kg" ? <span className="text-[10px] text-ink-500">/kg</span> : null}</span>,
    }),
    col.accessor((p) => (p.price - p.cost) / p.price, {
      id: "margin",
      header: "Margin",
      cell: (i) => {
        const m = i.getValue() * 100;
        return <span className={`num text-[12.5px] font-semibold ${m < 30 ? "text-gold-300" : "text-leaf-400"}`}>{m.toFixed(0)}%</span>;
      },
    }),
    col.accessor("stock", {
      header: "Stock",
      cell: (i) => {
        const p = i.row.original;
        return (
          <div className="flex items-center gap-2">
            <button onClick={() => adjustStock(p.id, -1)} aria-label="Decrease stock"
              className="focus-ring grid h-8 w-8 place-items-center rounded-md border border-ink-700 text-ink-400 transition hover:border-flare-600/60 hover:text-flare-400 active:scale-90"><Minus size={13} /></button>
            <span className="num w-14 text-center text-[13.5px] font-bold text-ink-100">{p.unit === "kg" ? p.stock.toFixed(1) : p.stock}</span>
            <button onClick={() => adjustStock(p.id, p.unit === "kg" ? 5 : 1)} aria-label="Increase stock"
              className="focus-ring grid h-8 w-8 place-items-center rounded-md border border-ink-700 text-ink-400 transition hover:border-leaf-600/70 hover:text-leaf-400 active:scale-90"><Plus size={13} /></button>
            <StockPill stock={p.stock} lowAt={p.lowAt} />
          </div>
        );
      },
    }),
    col.accessor((p) => p.expiry ?? Infinity, {
      id: "expiry",
      header: "Batch · Expiry",
      cell: (i) => {
        const p = i.row.original;
        if (!p.expiry) return <span className="text-[12px] text-ink-600">{p.batch ?? "—"} · shelf-stable</span>;
        const dte = daysUntil(p.expiry);
        return (
          <div className="leading-tight">
            <p className="num text-[12px] text-ink-400">{p.batch ?? "—"} · {dateStr(p.expiry)}</p>
            {dte <= 0 ? <Pill tone="red">Expired</Pill>
              : dte <= 2 ? <Pill tone="red">{dte}d to expiry</Pill>
                : dte <= 7 ? <Pill tone="amber">{dte}d to expiry</Pill>
                  : <span className="text-[11px] text-ink-600">{dte}d remaining</span>}
          </div>
        );
      },
    }),
    col.display({
      id: "actions",
      header: "",
      cell: (i) => {
        const p = i.row.original;
        return (
          <div className="flex justify-end gap-1.5">
            <button onClick={() => setEditing(p)} title="Edit item"
              className="focus-ring grid h-9 w-9 place-items-center rounded-lg border border-ink-700 text-ink-400 transition hover:border-ice-500/60 hover:text-ice-300 active:scale-90"><Pencil size={14} /></button>
            <button onClick={() => setDeleting(p)} title="Delete item"
              className="focus-ring grid h-9 w-9 place-items-center rounded-lg border border-ink-700 text-ink-400 transition hover:border-flare-600/60 hover:text-flare-400 active:scale-90"><Trash2 size={14} /></button>
          </div>
        );
      },
    }),
  ], [adjustStock]);

  const table = useReactTable({ data, columns, state: { sorting }, onSortingChange: setSorting, getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel() });

  const low = products.filter((p) => p.stock > 0 && p.stock <= p.lowAt).length;
  const oos = products.filter((p) => p.stock <= 0).length;
  const expiring = products.filter((p) => p.expiry && daysUntil(p.expiry) <= 3).length;
  const stockValue = products.reduce((a, p) => a + p.cost * p.stock, 0);

  return (
    <div className="flex h-full flex-col overflow-y-auto p-6">
      {/* stat strip */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "SKUs tracked", value: String(products.length), tone: "text-ink-100" },
          { label: "Low stock lines", value: String(low), tone: low ? "text-gold-400" : "text-ink-100" },
          { label: "Out of stock", value: String(oos), tone: oos ? "text-flare-400" : "text-ink-100" },
          { label: "Stock value (cost)", value: money(stockValue), tone: "text-leaf-400" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-ink-800 bg-ink-900/80 px-4 py-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-500">{s.label}</p>
            <p className={`num mt-1 text-xl font-bold ${s.tone}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-64 flex-1">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-500" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, barcode, SKU, batch…" className={`${inputCls} pl-10`} />
        </div>
        <select value={cat} onChange={(e) => setCat(e.target.value)} className={`${inputCls} w-44`}>
          <option value="all">All categories</option>
          {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button onClick={() => setAlertsOnly((v) => !v)}
          className={`focus-ring flex min-h-11 items-center gap-2 rounded-lg border px-4 text-[13px] font-semibold transition active:scale-95 ${
            alertsOnly ? "border-gold-500 bg-gold-500/15 text-gold-300" : "border-ink-600 bg-ink-850 text-ink-300 hover:border-ink-500"
          }`}>
          <CalendarClock size={15} /> Alerts only · {low + oos + expiring}
        </button>
        <PrimaryBtn onClick={() => setEditing("new")} className="min-h-11"><PackagePlus size={16} /> New Item</PrimaryBtn>
      </div>

      {/* table */}
      <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-ink-800 bg-ink-900/70">
        <div className="h-full overflow-auto">
          <table className="w-full border-collapse text-left">
            <thead className="sticky top-0 z-10 bg-ink-900">
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id} className="border-b border-ink-750">
                  {hg.headers.map((h) => (
                    <th key={h.id} className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.12em] text-ink-500">
                      {h.isPlaceholder ? null : (
                        <button
                          onClick={h.column.getToggleSortingHandler()}
                          className={`focus-ring flex items-center gap-1.5 rounded transition hover:text-ink-200 ${h.column.getIsSorted() ? "text-leaf-400" : ""}`}>
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          {h.column.getCanSort() && <ArrowUpDown size={11} className={h.column.getIsSorted() ? "opacity-100" : "opacity-40"} />}
                        </button>
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row, ri) => (
                <motion.tr key={row.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(ri * 0.02, 0.3) }}
                  className="border-b border-ink-800/70 transition-colors last:border-0 hover:bg-ink-850/70">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3 align-middle">{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                  ))}
                </motion.tr>
              ))}
              {table.getRowModel().rows.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-14 text-center text-sm text-ink-500">No items match the current filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ProductModal editing={editing} onClose={() => setEditing(null)} onSave={(p) => { upsertProduct(p); pushToast("success", editing === "new" ? `${p.name} added to catalog` : `${p.name} updated`); setEditing(null); }} />

      {/* delete confirm */}
      <Modal open={!!deleting} onClose={() => setDeleting(null)} width="max-w-sm" label="Confirm delete">
        {deleting && (
          <div className="p-6">
            <SectionTitle title="Remove item?" />
            <p className="text-sm leading-relaxed text-ink-300">
              <span className="font-semibold text-ink-100">{deleting.name}</span> will be removed from the catalog. Past sales keep their line history.
            </p>
            <div className="mt-5 flex gap-2.5">
              <GhostBtn onClick={() => setDeleting(null)} className="flex-1">Keep it</GhostBtn>
              <button onClick={() => { deleteProduct(deleting.id); pushToast("info", `${deleting.name} deleted`); setDeleting(null); }}
                className="focus-ring flex-1 rounded-lg bg-flare-600 px-4 py-2.5 text-sm font-bold text-ink-50 transition hover:bg-flare-500 active:scale-95">
                Delete item
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ---------- CRUD modal ----------
function localDate(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function ProductModal({ editing, onClose, onSave }: { editing: Product | "new" | null; onClose: () => void; onSave: (p: Product) => void }) {
  const isNew = editing === "new";
  const base: Product = isNew || !editing
    ? { id: uid("p"), name: "", brand: "", barcode: String(Math.floor(8.4e12 + Math.random() * 1e11)), sku: "GR-" + Math.floor(1000 + Math.random() * 9000), category: "produce", unit: "ea", price: 0, cost: 0, stock: 0, lowAt: 5 }
    : editing;
  const [form, setForm] = useState<Product>(base);
  useEffect(() => { setForm(base); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [editing]);

  const set = <K extends keyof Product>(k: K, v: Product[K]) => setForm((f) => ({ ...f, [k]: v }));
  const numSet = (k: keyof Product, v: string) => set(k, v === "" ? 0 : parseFloat(v));

  return (
    <Modal open={!!editing} onClose={onClose} width="max-w-xl" label="Item editor">
      <ModalHeader title={isNew ? "New stock item" : `Edit · ${base.name}`} sub={isNew ? "Barcode auto-generated — rescan to overwrite" : `SKU ${base.sku}`} onClose={onClose} />
      <div className="max-h-[70vh] space-y-4 overflow-y-auto p-6">
        <div className="grid grid-cols-[2fr_1fr] gap-3">
          <Field label="Item name"><input className={inputCls} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Cavendish Bananas" /></Field>
          <Field label="Brand"><input className={inputCls} value={form.brand} onChange={(e) => set("brand", e.target.value)} /></Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Category">
            <select className={inputCls} value={form.category} onChange={(e) => set("category", e.target.value)}>
              {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Sell as">
            <select className={inputCls} value={form.unit} onChange={(e) => set("unit", e.target.value as Unit)}>
              <option value="ea">Fixed unit (each)</option>
              <option value="kg">Variable weight (kg)</option>
            </select>
          </Field>
          <Field label="Barcode"><input className={`${inputCls} num`} value={form.barcode} onChange={(e) => set("barcode", e.target.value)} /></Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label={`Price ${form.unit === "kg" ? "/ kg" : ""}`}><input type="number" step="0.01" className={`${inputCls} num`} value={form.price || ""} onChange={(e) => numSet("price", e.target.value)} /></Field>
          <Field label="Cost"><input type="number" step="0.01" className={`${inputCls} num`} value={form.cost || ""} onChange={(e) => numSet("cost", e.target.value)} /></Field>
          <Field label="On hand"><input type="number" step={form.unit === "kg" ? "0.1" : "1"} className={`${inputCls} num`} value={form.stock || ""} onChange={(e) => numSet("stock", e.target.value)} /></Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Low-stock alert at"><input type="number" className={`${inputCls} num`} value={form.lowAt || ""} onChange={(e) => numSet("lowAt", e.target.value)} /></Field>
          <Field label="Batch no."><input className={`${inputCls} num`} value={form.batch ?? ""} onChange={(e) => set("batch", e.target.value || undefined)} placeholder="B-0000-X" /></Field>
          <Field label="Expiry date">
            <input type="date" className={inputCls}
              value={form.expiry ? localDate(form.expiry) : ""}
              onChange={(e) => set("expiry", e.target.value ? new Date(e.target.value + "T12:00:00").getTime() : undefined)} />
          </Field>
        </div>
        {form.price > 0 && (
          <p className="rounded-lg border border-ink-750 bg-ink-850 px-3.5 py-2.5 text-[12.5px] text-ink-400">
            Margin <span className={`num font-bold ${((form.price - form.cost) / form.price) * 100 < 30 ? "text-gold-300" : "text-leaf-400"}`}>{(((form.price - form.cost) / form.price) * 100).toFixed(1)}%</span>
            {" "}· {form.expiry && daysUntil(form.expiry) <= 3 ? <span className="font-semibold text-flare-400">expires in {daysUntil(form.expiry)}d — set a short shelf-life price</span> : form.expiry ? `expires ${dateStr(form.expiry)}` : "shelf-stable item"}
          </p>
        )}
        <div className="flex justify-end gap-2.5 pt-1">
          <GhostBtn onClick={onClose}>Cancel</GhostBtn>
          <PrimaryBtn
            disabled={!form.name.trim() || form.price <= 0}
            onClick={() => onSave({ ...form, name: form.name.trim() })}
          >
            {isNew ? "Add to catalog" : "Save changes"}
          </PrimaryBtn>
        </div>
      </div>
    </Modal>
  );
}
