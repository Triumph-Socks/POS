import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Banknote, CreditCard, Printer, QrCode, ShieldAlert, UserRound, Wallet } from "lucide-react";
import { useStore } from "../../state/store";
import { money, round3, type Method, type Payment, type Sale } from "../../lib/core";
import { Field, GhostBtn, KeyCap, Modal, ModalHeader, PrimaryBtn, inputCls } from "../../components/ui";

const METHODS: { id: Method; label: string; icon: React.ReactNode; tint: string }[] = [
  { id: "cash", label: "Cash", icon: <Banknote size={17} />, tint: "text-leaf-400" },
  { id: "card", label: "Credit Card", icon: <CreditCard size={17} />, tint: "text-cobalt-400" },
  { id: "qr", label: "Mobile / QR", icon: <QrCode size={17} />, tint: "text-ice-400" },
  { id: "store_credit", label: "Store Credit", icon: <Wallet size={17} />, tint: "text-tang-400" },
  { id: "on_credit", label: "Khata (On Credit)", icon: <UserRound size={17} />, tint: "text-flare-400" },
];

export function CheckoutModal({ open, quickCash, onClose }: { open: boolean; quickCash: boolean; onClose: () => void }) {
  const { cart, discountPct, customers, cartCustomerId, completeSale, pushToast } = useStore();
  const [alloc, setAlloc] = useState<Record<Method, string>>({ cash: "", card: "", qr: "", store_credit: "", on_credit: "" });
  const [tendered, setTendered] = useState("");
  const [receipt, setReceipt] = useState<Sale | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const subtotal = round3(cart.reduce((a, l) => a + l.price * l.qty, 0));
  const discount = Math.round(subtotal * discountPct) / 100;
  const total = Math.round((subtotal - discount) * 100) / 100;
  const customer = customers.find((c) => c.id === cartCustomerId);

  const val = (m: Method) => Math.max(0, parseFloat(alloc[m]) || 0);
  const others = val("card") + val("qr") + val("store_credit") + val("on_credit");
  const remainingAfterOthers = Math.max(0, round3(total - others));
  const tenderedNum = parseFloat(tendered) || 0;
  const cashApplied = tenderedNum > 0 ? Math.min(tenderedNum, remainingAfterOthers) : val("cash") > 0 ? Math.min(val("cash"), remainingAfterOthers) : 0;
  const change = tenderedNum > 0 ? Math.max(0, round3(tenderedNum - remainingAfterOthers)) : 0;
  const covered = round3(others + cashApplied);
  const remaining = round3(total - covered);
  const overAllocated = others > total + 0.005;

  const creditBlocked = val("on_credit") > 0 && !!customer && round3(customer.balance + val("on_credit")) > customer.creditLimit;
  const needsCustomer = (val("on_credit") > 0 || val("store_credit") > 0) && !customer;
  const insufficientWallet = !!customer && val("store_credit") > customer.storeCredit + 0.005;
  const canComplete = !busy && covered >= total - 0.005 && !overAllocated && !creditBlocked && !needsCustomer && !insufficientWallet;

  useEffect(() => {
    if (open) {
      setReceipt(null); setBusy(false); busyRef.current = false; setTendered("");
      const base: Record<Method, string> = { cash: "", card: "", qr: "", store_credit: "", on_credit: "" };
      if (quickCash) {
        const t = Math.ceil(total / 5) * 5;
        setTendered(String(t));
        base.cash = String(total);
      }
      setAlloc(base);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Enter completes the sale (unless a field/button owns the keystroke)
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key !== "Enter") return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "BUTTON") return;
      e.preventDefault();
      void finish();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  const finish = async () => {
    if (!canComplete || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    const payments: Payment[] = [];
    const push = (method: Method, amount: number) => { if (amount > 0.004) payments.push({ method, amount: round3(amount) }); };
    push("card", val("card")); push("qr", val("qr")); push("store_credit", val("store_credit")); push("on_credit", val("on_credit"));
    if (cashApplied > 0.004) payments.push({ method: "cash", amount: round3(cashApplied), tendered: tenderedNum || round3(cashApplied), change });
    const sale = await completeSale(payments);
    setReceipt(sale);
  };

  const quickTenders = useMemo(() => {
    const exact = remainingAfterOthers;
    const opts = [exact, Math.ceil(exact / 5) * 5, Math.ceil(exact / 10) * 10, Math.ceil(exact / 20) * 20, 50, 100];
    return [...new Set(opts.map((n) => round3(n)))].filter((n) => n > 0).slice(0, 5);
  }, [remainingAfterOthers]);

  return (
    <Modal open={open} onClose={() => (busy ? undefined : receipt ? onClose() : onClose())} width="max-w-3xl" label="Checkout">
      {receipt ? (
        <ReceiptView sale={receipt} change={receipt.payments.find((p) => p.method === "cash")?.change ?? 0} onDone={onClose} />
      ) : (
        <>
          <ModalHeader
            title="Take Payment"
            sub={`${cart.length} line${cart.length === 1 ? "" : "s"} · ${cart.reduce((a, l) => a + (l.unit === "ea" ? l.qty : 1), 0)} items · cashier R. Chen`}
            onClose={onClose}
          />
          <div className="grid gap-0 md:grid-cols-[1fr_1.25fr]">
            {/* left: summary */}
            <div className="border-b border-ink-750 bg-ink-925/60 p-6 md:border-b-0 md:border-r">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500">Bill summary</p>
              <ul className="mt-3 max-h-52 space-y-2 overflow-y-auto pr-1">
                {cart.map((l) => (
                  <li key={l.key} className="flex justify-between gap-3 text-[13px]">
                    <span className="min-w-0 truncate text-ink-300">{l.name} <span className="num text-ink-600">×{l.unit === "kg" ? l.qty.toFixed(3) : l.qty}</span></span>
                    <span className="num shrink-0 font-semibold text-ink-200">{money(l.price * l.qty)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 space-y-1.5 border-t border-dashed border-ink-700 pt-3 text-[13px] text-ink-400">
                <div className="flex justify-between"><span>Subtotal</span><span className="num text-ink-200">{money(subtotal)}</span></div>
                {discount > 0 && <div className="flex justify-between text-gold-300"><span>Discount {discountPct}%</span><span className="num">−{money(discount)}</span></div>}
                <div className="flex items-baseline justify-between pt-2">
                  <span className="font-display text-sm font-bold uppercase tracking-wider text-ink-300">Amount due</span>
                  <span className="num text-3xl font-bold text-leaf-400">{money(total)}</span>
                </div>
              </div>

              {customer && (
                <div className="mt-4 rounded-lg border border-ink-750 bg-ink-850 px-3.5 py-2.5 text-[12px]">
                  <p className="font-semibold text-ink-200">{customer.name}</p>
                  <p className="num mt-0.5 text-ink-500">
                    owes {money(customer.balance)} · wallet {money(customer.storeCredit)} · limit {money(customer.creditLimit)}
                  </p>
                </div>
              )}

              {/* allocation meter */}
              <div className="mt-5">
                <div className="mb-1.5 flex justify-between text-[11px] font-semibold uppercase tracking-wider text-ink-500">
                  <span>Allocated</span>
                  <span className={`num ${remaining > 0.005 ? "text-gold-300" : "text-leaf-400"}`}>
                    {money(Math.min(covered, total))} / {money(total)}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-ink-800">
                  <motion.div
                    className={`h-full rounded-full ${overAllocated ? "bg-flare-500" : remaining > 0.005 ? "bg-gold-500" : "bg-leaf-500"}`}
                    animate={{ width: `${Math.min(100, total === 0 ? 0 : (covered / total) * 100)}%` }}
                    transition={{ type: "spring", stiffness: 260, damping: 30 }}
                  />
                </div>
              </div>
            </div>

            {/* right: tender */}
            <div className="space-y-4 p-6">
              {METHODS.map((m) => {
                if (m.id === "cash") {
                  return (
                    <div key={m.id} className="rounded-xl border border-leaf-700/40 bg-leaf-950/40 p-3.5">
                      <div className="flex items-center justify-between">
                        <span className={`flex items-center gap-2 text-sm font-bold text-ink-100`}><span className={m.tint}>{m.icon}</span> Cash</span>
                        {change > 0 && (
                          <motion.span key={change} initial={{ scale: 1.25 }} animate={{ scale: 1 }}
                            className="num rounded-lg bg-leaf-500/20 px-2.5 py-1 text-sm font-bold text-leaf-300">
                            Change {money(change)}
                          </motion.span>
                        )}
                      </div>
                      <div className="mt-2.5 flex gap-2">
                        <div className="relative flex-1">
                          <span className="num pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-500">$</span>
                          <input value={tendered} onChange={(e) => setTendered(e.target.value.replace(/[^0-9.]/g, ""))}
                            placeholder="Tendered" inputMode="decimal"
                            className={`${inputCls} num pl-7 text-lg font-bold`} />
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {quickTenders.map((t) => (
                          <button key={t} onClick={() => setTendered(String(t))}
                            className={`focus-ring num min-h-9 rounded-md border px-2.5 text-[12px] font-bold transition active:scale-95 ${
                              tenderedNum === t ? "border-leaf-500 bg-leaf-500 text-ink-950" : "border-ink-600 bg-ink-850 text-ink-300 hover:border-leaf-600 hover:text-leaf-300"
                            }`}>
                            {t === remainingAfterOthers ? "Exact" : money(t)}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                }
                const disabledReason =
                  m.id === "store_credit" && customer && customer.storeCredit <= 0 ? "No wallet balance" :
                  (m.id === "on_credit" || m.id === "store_credit") && !customer ? "Pick a customer in cart" : null;
                return (
                  <div key={m.id} className={`rounded-xl border p-3.5 ${alloc[m.id] ? "border-ink-600 bg-ink-800" : "border-ink-750 bg-ink-850"}`}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2 text-sm font-semibold text-ink-100">
                        <span className={m.tint}>{m.icon}</span> {m.label}
                        {disabledReason && <span className="text-[10px] font-medium text-ink-600">· {disabledReason}</span>}
                      </span>
                      <div className="relative w-28">
                        <span className="num pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[12px] text-ink-500">$</span>
                        <input
                          value={alloc[m.id]}
                          onChange={(e) => setAlloc((a) => ({ ...a, [m.id]: e.target.value.replace(/[^0-9.]/g, "") }))}
                          placeholder="0.00" inputMode="decimal"
                          className={`${inputCls} num h-10 px-2 pl-6 text-right text-sm font-bold`}
                        />
                      </div>
                    </div>
                    {(m.id === "store_credit" || m.id === "on_credit") && customer && (
                      <div className="mt-1.5 flex gap-1.5 pl-7">
                        {[0.25, 0.5, 1].map((f) => (
                          <button key={f} onClick={() => setAlloc((a) => ({ ...a, [m.id]: String(round3(total * f)) }))}
                            className="num rounded-md border border-ink-700 px-2 py-0.5 text-[10px] font-bold text-ink-500 transition hover:border-ink-500 hover:text-ink-200">
                            {f === 1 ? "Full" : `${f * 100}%`}
                          </button>
                        ))}
                        {m.id === "store_credit" && (
                          <button onClick={() => setAlloc((a) => ({ ...a, store_credit: String(Math.min(customer.storeCredit, total)) }))}
                            className="num rounded-md border border-tang-600/50 px-2 py-0.5 text-[10px] font-bold text-tang-300 transition hover:border-tang-500">
                            Wallet max {money(customer.storeCredit)}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* warnings */}
              {creditBlocked && customer && (
                <div className="flex items-start gap-2.5 rounded-xl border border-flare-600/60 bg-flare-950 p-3.5 text-[13px] font-semibold text-flare-300">
                  <ShieldAlert size={18} className="mt-0.5 shrink-0" />
                  <span>
                    Credit limit breach — khata would reach {money(round3(customer.balance + val("on_credit")))}, over the approved {money(customer.creditLimit)}. Reduce the on-credit amount or take another tender.
                  </span>
                </div>
              )}
              {insufficientWallet && (
                <div className="flex items-center gap-2 rounded-lg border border-tang-600/50 bg-tang-950 px-3 py-2 text-[12px] font-semibold text-tang-300">
                  <AlertTriangle size={14} /> Store credit exceeds wallet balance {customer ? money(customer.storeCredit) : ""}
                </div>
              )}
              {overAllocated && (
                <div className="flex items-center gap-2 rounded-lg border border-flare-600/50 bg-flare-950 px-3 py-2 text-[12px] font-semibold text-flare-300">
                  <AlertTriangle size={14} /> Over-allocated by {money(round3(others - total))} — only cash may exceed the total
                </div>
              )}

              <div className="flex items-center justify-between gap-3 pt-1">
                <div className="text-[13px] font-semibold text-ink-400">
                  {remaining > 0.005 ? <>Remaining <span className="num ml-1 text-xl font-bold text-gold-300">{money(remaining)}</span></>
                    : <span className="flex items-center gap-1.5 text-leaf-400"><Banknote size={15} /> Fully tendered</span>}
                </div>
                <div className="flex gap-2">
                  <GhostBtn onClick={onClose}>Cancel <KeyCap k="Esc" wide /></GhostBtn>
                  <PrimaryBtn onClick={() => void finish()} disabled={!canComplete} className="min-w-40">
                    Complete Sale <KeyCap k="↵" />
                  </PrimaryBtn>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </Modal>
  );
}

// ---------- receipt ----------
function ReceiptView({ sale, change, onDone }: { sale: Sale; change: number; onDone: () => void }) {
  const { pushToast } = useStore();
  const methodLabel: Record<Method, string> = { cash: "CASH", card: "CARD", qr: "QR / WALLET", store_credit: "STORE CREDIT", on_credit: "KHATA" };
  return (
    <div className="grid md:grid-cols-[1fr_320px]">
      <div className="flex flex-col items-center justify-center gap-4 p-8">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 18, delay: 0.15 }}
          className="grid h-16 w-16 place-items-center rounded-full bg-leaf-500 text-ink-950 shadow-[0_0_50px_rgb(53_197_108/0.45)]">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
        </motion.div>
        <div className="text-center">
          <h2 className="font-display text-2xl font-bold text-ink-50">Payment complete</h2>
          <p className="mt-1 text-sm text-ink-400">Sale <span className="num text-leaf-400">{sale.id}</span> · stock deducted · {sale.payments.map((p) => methodLabel[p.method]).join(" + ")}</p>
        </div>
        <div className="num flex items-baseline gap-2 text-ink-300">
          <span className="text-sm">Collected</span>
          <span className="text-4xl font-bold text-ink-50">{money(sale.total)}</span>
          {change > 0 && <span className="text-sm text-leaf-400">· change {money(change)}</span>}
        </div>
        <div className="mt-2 flex gap-3">
          <GhostBtn onClick={() => pushToast("info", `Receipt ${sale.id} sent to lane printer`)}><Printer size={15} /> Print copy</GhostBtn>
          <PrimaryBtn onClick={onDone} autoFocus>New Sale <KeyCap k="↵" /></PrimaryBtn>
        </div>
      </div>

      {/* paper slip */}
      <div className="overflow-hidden border-t border-ink-750 bg-ink-925 p-6 md:border-l md:border-t-0">
        <motion.div
          initial={{ y: "108%" }} animate={{ y: 0 }}
          transition={{ type: "spring", stiffness: 120, damping: 20, delay: 0.25 }}
          className="receipt-paper receipt-zigzag mx-auto max-w-[270px] px-5 pb-3 pt-5 font-mono text-[11px] leading-relaxed shadow-lift"
        >
          <p className="text-center text-[13px] font-bold tracking-wide">AURA GROCERY №7</p>
          <p className="text-center text-[9px]">214 Meridian Ave · (415) 555-0117</p>
          <p className="mt-2 flex justify-between"><span>{new Date(sale.ts).toLocaleDateString()}</span><span>{new Date(sale.ts).toLocaleTimeString()}</span></p>
          <p className="flex justify-between"><span>Sale {sale.id}</span><span>Cashier {sale.cashier}</span></p>
          <div className="my-2 border-t border-dashed border-[#1c1f1d]/40" />
          {sale.lines.map((l) => (
            <p key={l.productId + l.name} className="flex justify-between gap-2">
              <span className="min-w-0 truncate">{l.name} {l.unit === "kg" ? `${l.qty.toFixed(3)}kg` : `x${l.qty}`}</span>
              <span>{money(l.total)}</span>
            </p>
          ))}
          <div className="my-2 border-t border-dashed border-[#1c1f1d]/40" />
          {sale.discount > 0 && <p className="flex justify-between"><span>DISCOUNT</span><span>-{money(sale.discount)}</span></p>}
          <p className="flex justify-between text-[13px] font-bold"><span>TOTAL</span><span>{money(sale.total)}</span></p>
          {sale.payments.map((p) => (
            <p key={p.method} className="flex justify-between"><span>{methodLabel[p.method]}</span><span>{money(p.amount)}</span></p>
          ))}
          {change > 0 && <p className="flex justify-between font-bold"><span>CHANGE</span><span>{money(change)}</span></p>}
          <div className="mx-auto mt-3 flex h-9 w-4/5 items-stretch justify-between" aria-hidden>
            {sale.id.split("").flatMap((ch, i) => {
              const w = ((ch.charCodeAt(0) % 4) + 1);
              return <span key={i} style={{ width: w, background: "#1c1f1d" }} />;
            })}
          </div>
          <p className="num mt-1 text-center text-[9px] tracking-[0.3em]">{sale.id}</p>
          <p className="mt-2 text-center text-[9px]">Thank you — shop again soon</p>
        </motion.div>
      </div>
    </div>
  );
}
