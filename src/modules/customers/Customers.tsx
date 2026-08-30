import { useEffect, useMemo, useState } from "react";
import {
  createColumnHelper, flexRender, getCoreRowModel, getSortedRowModel, useReactTable, type SortingState,
} from "@tanstack/react-table";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpDown, BellRing, BookOpenText, Coins, Pencil, PhoneCall, Receipt, Search, UserPlus, X } from "lucide-react";
import { useStore } from "../../state/store";
import { dateStr, dateTimeStr, money, uid, type Customer, type LedgerEntry } from "../../lib/core";
import { EmptyState, Field, GhostBtn, Modal, ModalHeader, Pill, PrimaryBtn, SectionTitle, inputCls } from "../../components/ui";

const col = createColumnHelper<Customer>();

function creditTone(c: Customer): "green" | "amber" | "red" {
  const r = c.balance / Math.max(1, c.creditLimit);
  if (c.balance <= 0) return "green";
  return r >= 1 ? "red" : r >= 0.7 ? "amber" : "green";
}

export function Customers() {
  const { customers, upsertCustomer, recordPayment, ledger, sales, pushToast } = useStore();
  const [query, setQuery] = useState("");
  const [sorting, setSorting] = useState<SortingState>([{ id: "balance", desc: true }]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Customer | "new" | null>(null);
  const [paying, setPaying] = useState(false);

  const data = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) => c.name.toLowerCase().includes(q) || c.phone.includes(q));
  }, [customers, query]);

  const columns = useMemo(() => [
    col.accessor("name", {
      header: "Customer",
      cell: (i) => {
        const c = i.row.original;
        return (
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink-800 text-[12px] font-bold text-ice-300">
              {c.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
            </span>
            <div className="leading-tight">
              <p className="text-[13.5px] font-semibold text-ink-100">{c.name}</p>
              <p className="num text-[11px] text-ink-500">{c.phone} · since {dateStr(c.since)}</p>
            </div>
          </div>
        );
      },
    }),
    col.accessor("storeCredit", {
      header: "Wallet",
      cell: (i) => <span className={`num text-[13px] font-semibold ${i.getValue() > 0 ? "text-tang-300" : "text-ink-600"}`}>{money(i.getValue())}</span>,
    }),
    col.accessor("balance", {
      header: "Outstanding",
      cell: (i) => {
        const c = i.row.original;
        const r = Math.min(1, c.balance / Math.max(1, c.creditLimit));
        const tone = creditTone(c);
        return (
          <div className="w-40">
            <div className="flex items-baseline justify-between">
              <span className={`num text-[13.5px] font-bold ${tone === "red" ? "text-flare-400" : tone === "amber" ? "text-gold-300" : "text-ink-100"}`}>{money(c.balance)}</span>
              <span className="num text-[10px] text-ink-500">of {money(c.creditLimit)}</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-800">
              <div className={`h-full rounded-full ${tone === "red" ? "bg-flare-500" : tone === "amber" ? "bg-gold-500" : "bg-leaf-500"}`} style={{ width: `${r * 100}%` }} />
            </div>
          </div>
        );
      },
    }),
    col.display({
      id: "status", header: "Status",
      cell: (i) => {
        const c = i.row.original;
        const t = creditTone(c);
        return t === "red" ? <Pill tone="red">Over limit</Pill> : t === "amber" ? <Pill tone="amber">Nearing limit</Pill> : c.balance > 0 ? <Pill tone="green">Good standing</Pill> : <Pill tone="gray">No dues</Pill>;
      },
    }),
    col.display({
      id: "actions", header: "",
      cell: (i) => {
        const c = i.row.original;
        return (
          <div className="flex justify-end gap-1.5">
            <button title="Send payment reminder (simulated)" onClick={() => pushToast("info", `Reminder sent to ${c.name} · ${c.phone}`)}
              className="focus-ring grid h-9 w-9 place-items-center rounded-lg border border-ink-700 text-ink-400 transition hover:border-gold-600/60 hover:text-gold-300 active:scale-90"><BellRing size={14} /></button>
            <button title="Edit customer" onClick={() => setEditing(c)}
              className="focus-ring grid h-9 w-9 place-items-center rounded-lg border border-ink-700 text-ink-400 transition hover:border-ice-500/60 hover:text-ice-300 active:scale-90"><Pencil size={14} /></button>
            <button title="Open ledger" onClick={() => setOpenId(c.id)}
              className="focus-ring flex min-h-9 items-center gap-1.5 rounded-lg bg-ink-800 px-3 text-[12.5px] font-bold text-ink-200 transition hover:bg-ink-750 hover:text-leaf-300 active:scale-95">
              <BookOpenText size={14} /> Ledger
            </button>
          </div>
        );
      },
    }),
  ], [pushToast]);

  const table = useReactTable({ data, columns, state: { sorting }, onSortingChange: setSorting, getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel() });

  const totalDue = customers.reduce((a, c) => a + c.balance, 0);
  const overLimit = customers.filter((c) => c.balance >= c.creditLimit && c.balance > 0).length;
  const open = customers.find((c) => c.id === openId) ?? null;
  const openLedger = open ? ledger.filter((l) => l.customerId === open.id) : [];
  const openReceipts = open ? sales.filter((s) => s.customerId === open.id).slice(0, 8) : [];

  return (
    <div className="flex h-full flex-col p-6">
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Customers on file", value: String(customers.length), tone: "text-ink-100" },
          { label: "Outstanding khata", value: money(totalDue), tone: "text-gold-400" },
          { label: "Over credit limit", value: String(overLimit), tone: overLimit ? "text-flare-400" : "text-ink-100" },
          { label: "Wallet balances", value: money(customers.reduce((a, c) => a + c.storeCredit, 0)), tone: "text-tang-300" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-ink-800 bg-ink-900/80 px-4 py-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-500">{s.label}</p>
            <p className={`num mt-1 text-xl font-bold ${s.tone}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-64 flex-1">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-500" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name or phone…" className={`${inputCls} pl-10`} />
        </div>
        <PrimaryBtn onClick={() => setEditing("new")} className="min-h-11"><UserPlus size={16} /> New Customer</PrimaryBtn>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-ink-800 bg-ink-900/70">
        <div className="h-full overflow-auto">
          <table className="w-full border-collapse text-left">
            <thead className="sticky top-0 z-10 bg-ink-900">
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id} className="border-b border-ink-750">
                  {hg.headers.map((h) => (
                    <th key={h.id} className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.12em] text-ink-500">
                      {h.isPlaceholder ? null : (
                        <button onClick={h.column.getToggleSortingHandler()}
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
                <motion.tr key={row.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(ri * 0.02, 0.25) }}
                  className="cursor-pointer border-b border-ink-800/70 transition-colors last:border-0 hover:bg-ink-850/70"
                  onClick={() => setOpenId(row.original.id)}>
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3 align-middle">{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                  ))}
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ledger drawer */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div className="fixed inset-0 z-40 bg-ink-950/70" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpenId(null)} />
            <motion.aside
              className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-ink-700 bg-ink-900 shadow-pop"
              initial={{ x: "105%" }} animate={{ x: 0 }} exit={{ x: "105%" }}
              transition={{ type: "spring", stiffness: 340, damping: 34 }}
            >
              <div className="border-b border-ink-750 px-5 py-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="font-display text-lg font-bold text-ink-50">{open.name}</h2>
                    <p className="num mt-0.5 text-[12px] text-ink-500">{open.phone} · member since {dateStr(open.since)}</p>
                  </div>
                  <button onClick={() => setOpenId(null)} className="focus-ring rounded-lg p-2 text-ink-400 hover:bg-ink-800 hover:text-ink-100"><X size={18} /></button>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-ink-850 px-2 py-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-ink-500">Owes</p>
                    <p className={`num text-[15px] font-bold ${creditTone(open) === "red" ? "text-flare-400" : "text-ink-100"}`}>{money(open.balance)}</p>
                  </div>
                  <div className="rounded-lg bg-ink-850 px-2 py-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-ink-500">Wallet</p>
                    <p className="num text-[15px] font-bold text-tang-300">{money(open.storeCredit)}</p>
                  </div>
                  <div className="rounded-lg bg-ink-850 px-2 py-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-ink-500">Limit</p>
                    <p className="num text-[15px] font-bold text-ink-300">{money(open.creditLimit)}</p>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <button onClick={() => setPaying(true)} disabled={open.balance <= 0}
                    className="focus-ring flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-leaf-500 text-[13px] font-bold text-ink-950 transition hover:bg-leaf-400 active:scale-95 disabled:bg-ink-800 disabled:text-ink-500">
                    <Coins size={15} /> Record repayment
                  </button>
                  <button onClick={() => pushToast("info", `SMS reminder sent to ${open.name} · ${money(open.balance)} due`)}
                    className="focus-ring flex min-h-11 items-center justify-center gap-2 rounded-lg border border-gold-600/50 bg-gold-950 px-4 text-[13px] font-bold text-gold-300 transition hover:border-gold-500 active:scale-95">
                    <PhoneCall size={15} /> Remind
                  </button>
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                <SectionTitle title={`Ledger · ${openLedger.length} entries`} />
                {openLedger.length === 0 ? (
                  <EmptyState icon={<BookOpenText size={24} />} title="Clean slate" sub="No khata activity recorded for this customer yet." />
                ) : (
                  <ul className="space-y-2">
                    {openLedger.map((e) => <LedgerRow key={e.id} e={e} />)}
                  </ul>
                )}

                <div className="mt-5">
                  <SectionTitle title={`Purchase history · ${openReceipts.length}`} />
                  {openReceipts.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-ink-750 px-3.5 py-3 text-center text-[12px] text-ink-600">No receipts attached to this profile yet</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {openReceipts.map((s) => (
                        <li key={s.id} className="flex items-center gap-3 rounded-lg border border-ink-800 bg-ink-850 px-3 py-2.5">
                          <Receipt size={14} className="shrink-0 text-ink-500" />
                          <div className="min-w-0 leading-tight">
                            <p className="num text-[12px] font-bold text-ink-200">{s.id}</p>
                            <p className="text-[10.5px] text-ink-500">{dateTimeStr(s.ts)} · {s.itemCount} items · {s.payments.map((p) => p.method === "cash" ? "cash" : p.method === "card" ? "card" : p.method === "qr" ? "qr" : p.method === "store_credit" ? "wallet" : "khata").join("+")}</p>
                          </div>
                          <span className="num ml-auto shrink-0 text-[13px] font-bold text-leaf-400">{money(s.total)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {open && <PaymentModal open={paying} customer={open} onClose={() => setPaying(false)} onSave={(amt, note) => { const entry = recordPayment(open.id, amt, note); pushToast("success", `Payment ${money(amt)} recorded · receipt ${entry.id}`); setPaying(false); }} />}
      <CustomerModal editing={editing} onClose={() => setEditing(null)} onSave={(c) => { upsertCustomer(c); pushToast("success", editing === "new" ? `${c.name} added to directory` : `${c.name} updated`); setEditing(null); }} />
    </div>
  );
}

function LedgerRow({ e }: { e: LedgerEntry }) {
  const meta = {
    credit_sale: { label: "Khata sale", tone: "text-flare-400", bg: "bg-flare-950 border-flare-600/40", sign: "+" },
    payment: { label: "Repayment", tone: "text-leaf-400", bg: "bg-leaf-950 border-leaf-700/50", sign: "−" },
    credit_purchase: { label: "Wallet spend", tone: "text-tang-300", bg: "bg-tang-950 border-tang-600/40", sign: "−" },
    adjust: { label: "Adjustment", tone: "text-ice-300", bg: "bg-ice-950 border-ice-600/40", sign: "" },
  }[e.type];
  return (
    <li className={`rounded-xl border p-3 ${meta.bg}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="leading-tight">
          <p className={`text-[13px] font-bold ${meta.tone}`}>{meta.label}</p>
          <p className="text-[11px] text-ink-400">{e.note}</p>
        </div>
        <span className={`num text-[15px] font-bold ${meta.tone}`}>{meta.sign}{money(Math.abs(e.amount))}</span>
      </div>
      <div className="num mt-1.5 flex justify-between text-[10.5px] text-ink-500">
        <span>{dateTimeStr(e.ts)} · {e.id}</span>
        <span>bal. after {money(e.balanceAfter)}</span>
      </div>
    </li>
  );
}

function PaymentModal({ open, customer, onClose, onSave }: { open: boolean; customer: Customer; onClose: () => void; onSave: (amt: number, note: string) => void }) {
  const [amt, setAmt] = useState("");
  const [note, setNote] = useState("Cash repayment at counter");
  useEffect(() => { if (open) { setAmt(String(customer.balance)); setNote("Cash repayment at counter"); } }, [open, customer]);
  const v = Math.max(0, parseFloat(amt) || 0);
  return (
    <Modal open={open} onClose={onClose} width="max-w-sm" label="Record repayment">
      <ModalHeader title="Record repayment" sub={`${customer.name} owes ${money(customer.balance)}`} onClose={onClose} />
      <div className="space-y-4 p-6">
        <Field label="Amount received" hint={<button className="num text-leaf-400 hover:underline" onClick={() => setAmt(String(customer.balance))}>full {money(customer.balance)}</button>}>
          <input autoFocus type="number" step="0.01" value={amt} onChange={(e) => setAmt(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && v > 0 && v <= customer.balance + 0.005) onSave(Math.min(v, customer.balance), note); }}
            className={`${inputCls} num text-2xl font-bold`} />
        </Field>
        <Field label="Note / receipt memo">
          <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        {v > customer.balance + 0.005 && <p className="text-[12px] font-semibold text-gold-300">Exceeds outstanding balance — the surplus stays as goodwill, not wallet credit.</p>}
        <div className="flex gap-2.5">
          <GhostBtn onClick={onClose} className="flex-1">Cancel</GhostBtn>
          <PrimaryBtn disabled={v <= 0} onClick={() => onSave(Math.min(v, customer.balance) || v, note)} className="flex-1">Record & issue receipt</PrimaryBtn>
        </div>
      </div>
    </Modal>
  );
}

function CustomerModal({ editing, onClose, onSave }: { editing: Customer | "new" | null; onClose: () => void; onSave: (c: Customer) => void }) {
  const isNew = editing === "new";
  const base: Customer = isNew || !editing
    ? { id: uid("c"), name: "", phone: "+1 415-", since: Date.now(), balance: 0, storeCredit: 0, creditLimit: 100 }
    : editing;
  const [form, setForm] = useState<Customer>(base);
  useEffect(() => { setForm(base); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [editing]);
  const set = <K extends keyof Customer>(k: K, v: Customer[K]) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <Modal open={!!editing} onClose={onClose} width="max-w-md" label="Customer editor">
      <ModalHeader title={isNew ? "New customer" : `Edit · ${base.name}`} sub="Khata ledger & wallet are managed from the ledger drawer" onClose={onClose} />
      <div className="space-y-4 p-6">
        <Field label="Full name"><input autoFocus className={inputCls} value={form.name} onChange={(e) => set("name", e.target.value)} /></Field>
        <Field label="Phone"><input className={`${inputCls} num`} value={form.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Credit limit ($)"><input type="number" className={`${inputCls} num`} value={form.creditLimit || ""} onChange={(e) => set("creditLimit", parseFloat(e.target.value) || 0)} /></Field>
          <Field label="Wallet credit ($)"><input type="number" step="0.01" className={`${inputCls} num`} value={form.storeCredit || ""} onChange={(e) => set("storeCredit", parseFloat(e.target.value) || 0)} /></Field>
        </div>
        <div className="flex justify-end gap-2.5">
          <GhostBtn onClick={onClose}>Cancel</GhostBtn>
          <PrimaryBtn disabled={!form.name.trim()} onClick={() => onSave({ ...form, name: form.name.trim() })}>{isNew ? "Add customer" : "Save changes"}</PrimaryBtn>
        </div>
      </div>
    </Modal>
  );
}
