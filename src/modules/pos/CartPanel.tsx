import { AnimatePresence, motion } from "framer-motion";
import { Banknote, Eraser, Minus, PauseCircle, Plus, ShoppingCart, Trash2, UserRound, Wallet } from "lucide-react";
import { useStore } from "../../state/store";
import { money, qtyStr, round3 } from "../../lib/core";
import { GhostBtn, KeyCap, PrimaryBtn } from "../../components/ui";

export function CartPanel({ onCheckout, onQuickCash, onHold, onShowHeld }: {
  onCheckout: () => void; onQuickCash: () => void; onHold: () => void; onShowHeld: () => void;
}) {
  const { cart, setLineQty, removeLine, clearCart, discountPct, setDiscountPct,
    customers, cartCustomerId, setCartCustomer, held, pushToast } = useStore();

  const subtotal = round3(cart.reduce((a, l) => a + l.price * l.qty, 0));
  const discount = Math.round(subtotal * discountPct) / 100;
  const total = Math.round((subtotal - discount) * 100) / 100;
  const itemCount = cart.length;
  const customer = customers.find((c) => c.id === cartCustomerId);
  const projected = customer ? customer.balance + total : 0;
  const overLimit = !!customer && projected > customer.creditLimit;

  const bump = (key: string, delta: number) => {
    const line = cart.find((l) => l.key === key);
    if (!line) return;
    setLineQty(key, line.unit === "kg" ? line.qty + delta * 0.1 : line.qty + delta);
  };

  return (
    <section className="flex w-[38%] min-w-[340px] max-w-[460px] shrink-0 flex-col border-l border-ink-800 bg-ink-925/80">
      {/* header row */}
      <div className="flex items-center justify-between border-b border-ink-800 px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <span className="relative grid h-9 w-9 place-items-center rounded-lg bg-ink-800 text-leaf-400">
            <ShoppingCart size={17} />
            {itemCount > 0 && (
              <motion.span key={itemCount} initial={{ scale: 1.6 }} animate={{ scale: 1 }}
                className="num absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-leaf-500 px-1 text-[10px] font-bold text-ink-950">
                {itemCount}
              </motion.span>
            )}
          </span>
          <div className="leading-tight">
            <p className="font-display text-sm font-bold text-ink-100">Current Sale</p>
            <p className="num text-[11px] text-ink-500">{itemCount} line{itemCount === 1 ? "" : "s"}</p>
          </div>
        </div>
        <div className="flex gap-1.5">
          <button onClick={onShowHeld} title="Held bills"
            className="focus-ring relative rounded-lg border border-ink-700 bg-ink-850 p-2.5 text-ink-300 transition hover:border-gold-600/60 hover:text-gold-300 active:scale-95">
            <PauseCircle size={16} />
            {held.length > 0 && <span className="num absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-gold-500 px-0.5 text-[9px] font-bold text-ink-950">{held.length}</span>}
          </button>
          <button onClick={() => { if (cart.length) { clearCart(); pushToast("info", "Cart cleared"); } }} title="Clear cart"
            className="focus-ring rounded-lg border border-ink-700 bg-ink-850 p-2.5 text-ink-300 transition hover:border-flare-600/60 hover:text-flare-300 active:scale-95">
            <Eraser size={16} />
          </button>
        </div>
      </div>

      {/* customer picker */}
      <div className="border-b border-ink-800 px-5 py-3">
        <div className="relative">
          <UserRound size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
          <select
            value={cartCustomerId ?? ""}
            onChange={(e) => setCartCustomer(e.target.value || undefined)}
            className="focus-ring h-11 w-full appearance-none rounded-lg border border-ink-700 bg-ink-850 pl-9 pr-8 text-sm font-medium text-ink-100 transition hover:border-ink-600"
          >
            <option value="">Walk-in customer</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · owes {money(c.balance)}
              </option>
            ))}
          </select>
          <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-500" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m6 9 6 6 6-6" /></svg>
        </div>
        {customer && (
          <div className={`mt-2 flex items-center justify-between rounded-lg border px-3 py-2 text-[12px] font-semibold ${
            overLimit ? "border-flare-600/50 bg-flare-950 text-flare-300" : "border-ink-750 bg-ink-850 text-ink-400"}`}>
            <span>Khata if fully on credit</span>
            <span className="num">{money(projected)} / limit {money(customer.creditLimit)}{overLimit && " · OVER"}</span>
          </div>
        )}
      </div>

      {/* lines */}
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {cart.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <motion.div animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 2.6, ease: "easeInOut" }}
              className="rounded-2xl border border-dashed border-ink-700 p-5 text-ink-600">
              <ShoppingCart size={30} />
            </motion.div>
            <p className="text-sm font-semibold text-ink-400">Scan or tap items to begin</p>
            <p className="max-w-52 text-xs leading-relaxed text-ink-600">Duplicate scans auto-increment quantity. Weighted items prompt for kilograms.</p>
          </div>
        ) : (
          <ul className="space-y-1.5">
            <AnimatePresence initial={false}>
              {cart.map((l) => (
                <motion.li
                  key={l.key} layout
                  initial={{ opacity: 0, x: 46, scale: 0.96 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: -30, height: 0, marginBottom: 0 }}
                  transition={{ type: "spring", stiffness: 480, damping: 36 }}
                  className="group rounded-xl border border-ink-800 bg-ink-850 px-3 py-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[13.5px] font-semibold text-ink-100">{l.name}</p>
                      <p className="num text-[11px] text-ink-500">{money(l.price)}{l.unit === "kg" ? "/kg" : ""} · {l.barcode}</p>
                    </div>
                    <button onClick={() => removeLine(l.key)} aria-label={`Remove ${l.name}`}
                      className="focus-ring rounded-md p-1.5 text-ink-600 opacity-0 transition group-hover:opacity-100 hover:bg-flare-950 hover:text-flare-400">
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <button onClick={() => bump(l.key, -1)} aria-label="Decrease"
                        className="focus-ring grid h-9 w-9 place-items-center rounded-lg border border-ink-700 bg-ink-800 text-ink-300 transition hover:border-ink-500 hover:text-ink-100 active:scale-90">
                        <Minus size={14} />
                      </button>
                      <input
                        value={l.unit === "kg" ? l.qty.toFixed(3) : l.qty}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          if (!Number.isNaN(v) && v >= 0) setLineQty(l.key, v);
                          else if (e.target.value === "") setLineQty(l.key, 0);
                        }}
                        className="num focus-ring h-9 w-16 rounded-lg border border-ink-700 bg-ink-925 text-center text-[13px] font-bold text-ink-100"
                        inputMode="decimal"
                      />
                      <button onClick={() => bump(l.key, 1)} aria-label="Increase"
                        className="focus-ring grid h-9 w-9 place-items-center rounded-lg border border-ink-700 bg-ink-800 text-ink-300 transition hover:border-leaf-600 hover:text-leaf-400 active:scale-90">
                        <Plus size={14} />
                      </button>
                      <span className="ml-1 text-[10px] font-bold uppercase tracking-wider text-ink-500">{l.unit === "kg" ? "kg" : "units"}</span>
                    </div>
                    <motion.span key={l.qty} initial={{ scale: 1.18, color: "#5bd98a" }} animate={{ scale: 1, color: "#f2f7f3" }}
                      className="num text-[15px] font-bold">
                      {money(l.price * l.qty)}
                    </motion.span>
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>

      {/* discount + totals */}
      <div className="shrink-0 space-y-3 border-t border-ink-800 px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-500">Discount</span>
          <div className="ml-auto flex gap-1.5">
            {[0, 5, 10].map((d) => (
              <button key={d} onClick={() => setDiscountPct(d)}
                className={`focus-ring num min-h-9 rounded-lg border px-3 text-[13px] font-bold transition active:scale-95 ${
                  discountPct === d ? "border-gold-500 bg-gold-500/15 text-gold-300" : "border-ink-700 bg-ink-850 text-ink-400 hover:border-ink-500 hover:text-ink-200"
                }`}>
                {d === 0 ? "None" : `${d}%`}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5 border-t border-dashed border-ink-750 pt-3 text-[13.5px]">
          <div className="flex justify-between text-ink-400"><span>Subtotal</span><span className="num text-ink-200">{money(subtotal)}</span></div>
          <div className="flex justify-between text-ink-400">
            <span>Discount {discountPct > 0 && `(${discountPct}%)`}</span>
            <span className="num text-gold-300">−{money(discount)}</span>
          </div>
          <div className="flex items-baseline justify-between pt-1">
            <span className="font-display text-sm font-bold uppercase tracking-wider text-ink-300">Total due</span>
            <motion.span key={total} initial={{ scale: 1.08, color: "#5bd98a" }} animate={{ scale: 1, color: "#f2f7f3" }}
              className="num text-[32px] font-bold leading-none">
              {money(total)}
            </motion.span>
          </div>
        </div>

        <div className="grid grid-cols-[1fr_1.6fr] gap-2.5 pt-1">
          <GhostBtn onClick={onHold} className="min-h-[52px] flex-col !gap-0.5 !py-1 text-[12px]">
            <span className="flex items-center gap-1.5"><PauseCircle size={15} className="text-gold-400" /> Hold</span>
            <span className="flex items-center gap-1 text-[10px] font-normal text-ink-500"><KeyCap k="F8" wide /></span>
          </GhostBtn>
          <div className="grid grid-cols-2 gap-2.5">
            <button onClick={() => { if (cart.length) onQuickCash(); }}
              className="focus-ring flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-lg border border-leaf-700/70 bg-leaf-950 text-[12px] font-bold text-leaf-300 transition hover:border-leaf-500 active:scale-[0.97] disabled:opacity-40"
              disabled={!cart.length}>
              <span className="flex items-center gap-1.5"><Banknote size={15} /> Cash</span>
              <span className="flex items-center gap-1 text-[10px] font-medium text-leaf-500/80"><KeyCap k="F4" wide /></span>
            </button>
            <button onClick={() => { if (cart.length) onCheckout(); }}
              className="focus-ring flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-lg bg-leaf-500 text-[12px] font-bold text-ink-950 shadow-[0_8px_24px_-8px_rgb(53_197_108/0.5)] transition hover:bg-leaf-400 active:scale-[0.97] disabled:opacity-40"
              disabled={!cart.length}>
              <span className="flex items-center gap-1.5"><Wallet size={15} /> Pay</span>
              <span className="flex items-center gap-1 text-[10px] text-ink-950/70"><KeyCap k="F9" wide /></span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
