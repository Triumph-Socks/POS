import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle, PackageOpen, PauseCircle, Scale, Search, Trash2, Undo2, ScanBarcode, Weight,
} from "lucide-react";
import { useStore } from "../../state/store";
import { CATEGORIES, catHue, catName, daysUntil, money, qtyStr, round3, sfx, type Product } from "../../lib/core";
import { EmptyState, Field, GhostBtn, KeyCap, Modal, ModalHeader, Pill, PrimaryBtn, inputCls } from "../../components/ui";
import { CartPanel } from "./CartPanel";
import { CheckoutModal } from "./CheckoutModal";

type ScanState = { ok: boolean; code: string } | null;

export function Terminal() {
  const { products, held, addToCart, holdCart, resumeHeld, deleteHeld, cart, pushToast } = useStore();
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<string>("all");
  const [activeIdx, setActiveIdx] = useState(0);
  const [weightFor, setWeightFor] = useState<Product | null>(null);
  const [showHeld, setShowHeld] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [quickCash, setQuickCash] = useState(false);
  const [scan, setScan] = useState<ScanState>(null);
  const [flashId, setFlashId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const scanTimer = useRef<number>(0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (cat !== "all" && p.category !== cat) return false;
      if (!q) return true;
      return p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q) || p.barcode.includes(q) || p.sku.toLowerCase().includes(q);
    });
  }, [products, query, cat]);

  useEffect(() => setActiveIdx(0), [query, cat]);

  const flash = useCallback((id: string) => {
    setFlashId(id);
    window.setTimeout(() => setFlashId(null), 700);
  }, []);

  const addProduct = useCallback((p: Product) => {
    if (p.unit === "kg") { setWeightFor(p); return; }
    if (addToCart(p)) flash(p.id);
  }, [addToCart, flash]);

  const handleScan = useCallback((code: string) => {
    const p = products.find((x) => x.barcode === code || x.sku.toLowerCase() === code.toLowerCase());
    window.clearTimeout(scanTimer.current);
    if (p) {
      setScan({ ok: true, code });
      if (p.unit === "kg") setWeightFor(p);
      else if (addToCart(p)) flash(p.id);
      sfx.scan();
    } else {
      setScan({ ok: false, code });
      sfx.bad();
      pushToast("error", `Unknown barcode ${code} — not in catalog`);
    }
    scanTimer.current = window.setTimeout(() => setScan(null), 1400);
  }, [products, addToCart, flash, pushToast]);

  // ---------- global keyboard: F-keys + scanner wedge ----------
  useEffect(() => {
    let buf = "";
    let last = 0;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const inField = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";

      if (e.key === "F2") { e.preventDefault(); searchRef.current?.focus(); searchRef.current?.select(); return; }
      if (checkoutOpen || weightFor) return; // let modals own the keyboard
      if (e.key === "F4" && !inField) { e.preventDefault(); if (cart.length) { setQuickCash(true); setCheckoutOpen(true); } return; }
      if (e.key === "F8" && !inField) { e.preventDefault(); holdCart(); return; }
      if (e.key === "F9" && !inField) { e.preventDefault(); if (cart.length) { setQuickCash(false); setCheckoutOpen(true); } return; }

      // barcode wedge: burst of fast keystrokes terminated by Enter
      const nowT = performance.now();
      if (e.key === "Enter") {
        if (buf.length >= 6 && nowT - last < 120) {
          e.preventDefault();
          handleScan(buf.trim());
          buf = "";
          return;
        }
        buf = "";
        if (inField) return;
        if (tag === "BUTTON") return;
        e.preventDefault();
        if (query === "" && cart.length) { setQuickCash(false); setCheckoutOpen(true); }
        return;
      }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (inField && buf.length === 0) { buf = ""; last = nowT; return; } // let inputs behave normally unless a burst is mid-flight
        if (nowT - last < 45) buf += e.key;
        else buf = e.key;
        last = nowT;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cart.length, handleScan, holdCart, query, checkoutOpen, weightFor]);

  const onSearchKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx((i) => Math.min(filtered.length - 1, i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx((i) => Math.max(0, i - 1)); }
    else if (e.key === "Enter" && !e.defaultPrevented) {
      e.preventDefault();
      const exact = filtered.find((p) => p.barcode === query.trim());
      const target = exact ?? filtered[activeIdx];
      if (target) { addProduct(target); if (exact) setQuery(""); }
    } else if (e.key === "Escape") { setQuery(""); (e.target as HTMLInputElement).blur(); }
  };

  const lowCount = products.filter((p) => p.stock > 0 && p.stock <= p.lowAt).length;
  const oosCount = products.filter((p) => p.stock <= 0).length;
  const expiringSoon = products.filter((p) => p.expiry && daysUntil(p.expiry) <= 2).length;

  return (
    <div className="flex h-full min-h-0">
      {/* ============ LEFT 60% : catalog ============ */}
      <section className="flex min-w-0 flex-[3] flex-col">
        {/* scan status strip */}
        <div className={`relative flex h-9 shrink-0 items-center gap-2 overflow-hidden border-b px-5 text-xs font-semibold transition-colors ${
          scan ? (scan.ok ? "border-leaf-700/50 bg-leaf-950 text-leaf-300" : "border-flare-600/50 bg-flare-950 text-flare-300")
            : "border-ink-800 bg-ink-925/40 text-ink-500"
        }`}>
          {scan && (
            <span className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/10 to-transparent"
              style={{ animation: "scanSweep 0.9s linear" }} />
          )}
          <ScanBarcode size={14} className={scan ? (scan.ok ? "text-leaf-400" : "text-flare-400") : ""} />
          {scan ? (
            scan.ok ? <span className="num">SCAN OK · {scan.code}</span> : <span className="num">NO MATCH · {scan.code}</span>
          ) : (
            <span>Scanner armed — fire a barcode or click items · {lowCount} low · {oosCount} out · {expiringSoon} expiring</span>
          )}
          <span className="ml-auto hidden items-center gap-1.5 lg:flex">
            <KeyCap k="F2" wide /> search <span className="mx-1 text-ink-700">·</span>
            <KeyCap k="F4" wide /> cash <span className="mx-1 text-ink-700">·</span>
            <KeyCap k="F8" wide /> hold <span className="mx-1 text-ink-700">·</span>
            <KeyCap k="F9" wide /> pay
          </span>
        </div>

        {/* search + categories */}
        <div className="shrink-0 space-y-3 border-b border-ink-800 px-5 py-3.5">
          <div className="relative">
            <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-500" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onSearchKey}
              placeholder="Search name, brand, SKU or scan barcode…  (F2)"
              className={`${inputCls} h-12 pl-10 pr-24 text-[15px]`}
            />
            <span className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1">
              <KeyCap k="↑↓" wide /><KeyCap k="↵" />
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setCat("all")}
              className={`focus-ring min-h-10 rounded-full border px-4 text-[13px] font-semibold transition-all active:scale-95 ${
                cat === "all" ? "border-leaf-500 bg-leaf-500 text-ink-950" : "border-ink-600 bg-ink-850 text-ink-300 hover:border-ink-500 hover:text-ink-100"
              }`}
            >
              All · {products.length}
            </button>
            {CATEGORIES.map((c) => {
              const n = products.filter((p) => p.category === c.id).length;
              const active = cat === c.id;
              return (
                <button
                  key={c.id} onClick={() => setCat(c.id)}
                  className={`focus-ring flex min-h-10 items-center gap-2 rounded-full border px-4 text-[13px] font-semibold transition-all active:scale-95 ${
                    active ? "text-ink-950" : "border-ink-600 bg-ink-850 text-ink-300 hover:border-ink-500 hover:text-ink-100"
                  }`}
                  style={active ? { background: c.hue, borderColor: c.hue } : undefined}
                >
                  <span className="h-2 w-2 rounded-full" style={{ background: active ? "#0b0f0d" : c.hue }} />
                  {c.name} <span className="num opacity-70">{n}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* product grid */}
        <div ref={gridRef} className="min-h-0 flex-1 overflow-y-auto p-5">
          {filtered.length === 0 ? (
            <EmptyState icon={<PackageOpen size={26} />} title="Nothing matches" sub={`No products found for “${query}” in ${cat === "all" ? "any category" : catName(cat)}. Try another term or clear filters.`} />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
              {filtered.map((p, i) => {
                const oos = p.stock <= 0;
                const low = !oos && p.stock <= p.lowAt;
                const expD = p.expiry ? daysUntil(p.expiry) : null;
                const isFlash = flashId === p.id;
                return (
                  <motion.button
                    key={p.id}
                    layout
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.015, 0.25), type: "spring", stiffness: 380, damping: 30 }}
                    onClick={() => (oos ? (sfx.bad(), pushToast("error", `${p.name} is out of stock`)) : addProduct(p))}
                    onMouseEnter={() => setActiveIdx(i)}
                    className={`focus-ring group relative flex min-h-[118px] flex-col overflow-hidden rounded-xl border p-3.5 text-left transition-all active:scale-[0.97] ${
                      isFlash ? "border-leaf-400 shadow-[0_0_0_3px_rgb(53_197_108/0.25),0_0_30px_rgb(53_197_108/0.2)]"
                        : i === activeIdx && query ? "border-ink-500 bg-ink-800" : "border-ink-750 bg-ink-850 hover:border-ink-600 hover:bg-ink-800"
                    } ${oos ? "opacity-55" : ""}`}
                  >
                    <span className="absolute inset-x-0 top-0 h-[3px]" style={{ background: catHue(p.category) }} />
                    <div className="flex items-start justify-between gap-1">
                      <div className="min-w-0">
                        <p className="truncate text-[14px] font-semibold leading-tight text-ink-100">{p.name}</p>
                        <p className="mt-0.5 truncate text-[11px] text-ink-500">{p.brand} · {p.sku}</p>
                      </div>
                      {p.unit === "kg" && <Weight size={14} className="mt-0.5 shrink-0 text-ice-400" />}
                    </div>
                    <div className="mt-auto flex items-end justify-between pt-2.5">
                      <div className="leading-tight">
                        <div className="num text-[17px] font-bold text-ink-50">{money(p.price)}</div>
                        <div className="text-[10px] uppercase tracking-wider text-ink-500">{p.unit === "kg" ? "per kg" : "each"}</div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {oos ? <Pill tone="red" dot={false}>OUT</Pill>
                          : low ? <Pill tone="amber" dot={false}>{p.unit === "kg" ? p.stock.toFixed(1) : p.stock} low</Pill>
                            : null}
                        {expD !== null && expD <= 2
                          ? <span className="flex items-center gap-1 text-[10px] font-bold text-flare-400"><AlertTriangle size={10} />{expD <= 0 ? "expired" : `${expD}d left`}</span>
                          : null}
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ============ RIGHT 40% : cart ============ */}
      <CartPanel
        onCheckout={() => { setQuickCash(false); setCheckoutOpen(true); }}
        onQuickCash={() => { setQuickCash(true); setCheckoutOpen(true); }}
        onHold={() => holdCart()}
        onShowHeld={() => setShowHeld(true)}
      />

      {/* held bills drawer */}
      <AnimatePresence>
        {showHeld && (
          <>
            <motion.div className="fixed inset-0 z-40 bg-ink-950/70" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowHeld(false)} />
            <motion.aside
              className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-ink-700 bg-ink-900 shadow-pop"
              initial={{ x: "105%" }} animate={{ x: 0 }} exit={{ x: "105%" }}
              transition={{ type: "spring", stiffness: 340, damping: 34 }}
            >
              <div className="flex items-center justify-between border-b border-ink-750 px-5 py-4">
                <div>
                  <h2 className="font-display text-lg font-semibold text-ink-50">Held Bills</h2>
                  <p className="text-xs text-ink-500">Parked carts survive restarts (IndexedDB)</p>
                </div>
                <button onClick={() => setShowHeld(false)} className="focus-ring rounded-lg p-2 text-ink-400 hover:bg-ink-800 hover:text-ink-100"><Undo2 size={18} /></button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                {held.length === 0 ? (
                  <EmptyState icon={<PauseCircle size={26} />} title="No held bills" sub="Press F8 with items in the cart to park a customer's bill and serve the next person in line." />
                ) : (
                  <div className="space-y-3">
                    {held.map((h) => (
                      <motion.div key={h.id} layout initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 30 }}
                        className="rounded-xl border border-ink-750 bg-ink-850 p-4">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-ink-100">{h.label}</p>
                          <span className="num text-xs text-ink-500">{new Date(h.ts).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                        <ul className="mt-2.5 space-y-1 border-t border-ink-750 pt-2.5">
                          {h.lines.map((l) => (
                            <li key={l.key} className="flex justify-between text-[13px] text-ink-300">
                              <span className="truncate">{l.name}</span>
                              <span className="num shrink-0 text-ink-400">{qtyStr(l.qty, l.unit)} · {money(l.price * l.qty)}</span>
                            </li>
                          ))}
                        </ul>
                        <div className="mt-3 flex items-center justify-between">
                          <span className="num text-base font-bold text-ink-50">{money(h.lines.reduce((a, l) => a + l.price * l.qty, 0))}</span>
                          <div className="flex gap-2">
                            <button onClick={() => deleteHeld(h.id)} className="focus-ring flex min-h-10 items-center gap-1.5 rounded-lg border border-flare-600/40 bg-flare-950 px-3.5 text-[13px] font-semibold text-flare-300 transition hover:border-flare-500 active:scale-95">
                              <Trash2 size={14} /> Discard
                            </button>
                            <button onClick={() => { resumeHeld(h.id); setShowHeld(false); }}
                              className="focus-ring flex min-h-10 items-center gap-1.5 rounded-lg bg-leaf-500 px-4 text-[13px] font-bold text-ink-950 transition hover:bg-leaf-400 active:scale-95">
                              Resume
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <WeightModal product={weightFor} onClose={() => setWeightFor(null)}
        onConfirm={(p, kg) => { if (addToCart(p, kg)) flash(p.id); setWeightFor(null); }} />

      <CheckoutModal open={checkoutOpen} quickCash={quickCash} onClose={() => setCheckoutOpen(false)} />
    </div>
  );
}

// ---------- weight prompt for variable-weight items ----------
function WeightModal({ product, onClose, onConfirm }: {
  product: Product | null; onClose: () => void; onConfirm: (p: Product, kg: number) => void;
}) {
  const [kg, setKg] = useState("1.000");
  useEffect(() => { if (product) setKg("1.000"); }, [product]);
  if (!product) return <Modal open={false} onClose={onClose}>{null}</Modal>;
  const val = parseFloat(kg) || 0;
  return (
    <Modal open={!!product} onClose={onClose} width="max-w-md" label="Enter weight">
      <ModalHeader title={<span className="flex items-center gap-2"><Scale size={18} className="text-ice-400" /> Weigh: {product.name}</span>}
        sub={`${money(product.price)} / kg · batch ${product.batch ?? "—"} · ${product.stock.toFixed(1)} kg available`} onClose={onClose} />
      <div className="space-y-4 p-6">
        <Field label="Weight in kilograms">
          <input
            autoFocus type="number" min="0.001" step="0.05" value={kg}
            onChange={(e) => setKg(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && val > 0) onConfirm(product, Math.min(product.stock, round3(val))); }}
            className={`${inputCls} num text-center text-3xl font-bold`}
          />
        </Field>
        <div className="flex flex-wrap gap-2">
          {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 2].map((w) => (
            <button key={w} onClick={() => setKg(w.toFixed(3))}
              className="focus-ring num min-h-11 rounded-lg border border-ink-600 bg-ink-800 px-3.5 text-sm font-semibold text-ink-200 transition hover:border-ice-500 hover:text-ice-300 active:scale-95">
              {w.toFixed(2)}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between rounded-xl border border-ink-750 bg-ink-850 px-4 py-3">
          <span className="text-sm text-ink-400">Line total</span>
          <span className="num text-2xl font-bold text-ink-50">{money(val * product.price)}</span>
        </div>
        <div className="flex gap-3">
          <GhostBtn onClick={onClose} className="flex-1">Cancel <KeyCap k="Esc" wide /></GhostBtn>
          <PrimaryBtn disabled={val <= 0} onClick={() => onConfirm(product, Math.min(product.stock, round3(val)))} className="flex-1">
            Add {val > 0 ? money(val * product.price) : ""}
          </PrimaryBtn>
        </div>
      </div>
    </Modal>
  );
}
