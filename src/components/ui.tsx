import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, animate, motion } from "framer-motion";
import { X } from "lucide-react";

// ---------- Modal shell ----------
export function Modal({ open, onClose, children, width = "max-w-2xl", label }: {
  open: boolean; onClose: () => void; children: ReactNode; width?: string; label?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } };
    window.addEventListener("keydown", h, true);
    return () => window.removeEventListener("keydown", h, true);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-ink-950/80 backdrop-blur-[3px]" onClick={onClose} />
          <motion.div
            role="dialog" aria-label={label}
            className={`relative w-full ${width} max-h-[92vh] overflow-hidden rounded-xl border border-ink-700 bg-ink-900 shadow-pop`}
            initial={{ opacity: 0, scale: 0.94, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function ModalHeader({ title, sub, onClose, tone = "text-ink-100" }: {
  title: ReactNode; sub?: ReactNode; onClose: () => void; tone?: string;
}) {
  return (
    <div className="flex items-start justify-between border-b border-ink-750 px-6 py-4">
      <div>
        <h2 className={`font-display text-lg font-semibold tracking-tight ${tone}`}>{title}</h2>
        {sub && <p className="mt-0.5 text-xs text-ink-400">{sub}</p>}
      </div>
      <button onClick={onClose} aria-label="Close"
        className="focus-ring -mr-1 rounded-lg p-2 text-ink-400 transition hover:bg-ink-800 hover:text-ink-100">
        <X size={18} />
      </button>
    </div>
  );
}

// ---------- Small atoms ----------
export function KeyCap({ k, wide = false }: { k: string; wide?: boolean }) {
  return (
    <kbd className={`num inline-flex h-6 items-center justify-center rounded-md border border-ink-600 bg-ink-800 px-1.5 text-[11px] font-medium text-ink-200 shadow-[inset_0_-2px_0_rgb(0_0_0/0.35)] ${wide ? "min-w-11" : "min-w-6"}`}>
      {k}
    </kbd>
  );
}

export function Pill({ tone, children, dot = true }: { tone: "green" | "amber" | "red" | "ice" | "gray" | "cobalt" | "tang"; children: ReactNode; dot?: boolean }) {
  const map = {
    green: "bg-leaf-950 text-leaf-300 border-leaf-700/50",
    amber: "bg-gold-950 text-gold-300 border-gold-600/40",
    red: "bg-flare-950 text-flare-300 border-flare-600/40",
    ice: "bg-ice-950 text-ice-300 border-ice-600/40",
    cobalt: "bg-cobalt-950 text-cobalt-300 border-cobalt-600/40",
    tang: "bg-tang-950 text-tang-300 border-tang-600/40",
    gray: "bg-ink-800 text-ink-300 border-ink-600",
  } as const;
  const dotMap = {
    green: "bg-leaf-400", amber: "bg-gold-400", red: "bg-flare-400",
    ice: "bg-ice-400", cobalt: "bg-cobalt-400", tang: "bg-tang-400", gray: "bg-ink-400",
  } as const;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium leading-none ${map[tone]}`}>
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${dotMap[tone]}`} />}
      {children}
    </span>
  );
}

export function StockPill({ stock, lowAt }: { stock: number; lowAt: number }) {
  if (stock <= 0) return <Pill tone="red">Out of stock</Pill>;
  if (stock <= lowAt) return <Pill tone="amber">Low · {stock}</Pill>;
  return <Pill tone="green">In stock · {stock}</Pill>;
}

// ---------- Animated counter ----------
export function CountUp({ value, prefix = "", suffix = "", decimals = 0, className = "" }: {
  value: number; prefix?: string; suffix?: string; decimals?: number; className?: string;
}) {
  const [display, setDisplay] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    const controls = animate(prev.current, value, {
      duration: 0.8, ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setDisplay(v),
    });
    prev.current = value;
    return () => controls.stop();
  }, [value]);
  return (
    <span className={`num ${className}`}>
      {prefix}{display.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}
    </span>
  );
}

// ---------- Buttons ----------
export function PrimaryBtn({ children, onClick, disabled, className = "", autoFocus }: {
  children: ReactNode; onClick?: () => void; disabled?: boolean; className?: string; autoFocus?: boolean;
}) {
  return (
    <button
      onClick={onClick} disabled={disabled} autoFocus={autoFocus}
      className={`focus-ring inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-leaf-500 px-5 text-sm font-semibold text-ink-950 transition-all hover:bg-leaf-400 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-ink-700 disabled:text-ink-400 ${className}`}
    >
      {children}
    </button>
  );
}

export function GhostBtn({ children, onClick, className = "", title }: {
  children: ReactNode; onClick?: () => void; className?: string; title?: string;
}) {
  return (
    <button
      onClick={onClick} title={title}
      className={`focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-ink-600 bg-ink-800/60 px-4 text-sm font-medium text-ink-200 transition-all hover:border-ink-500 hover:bg-ink-750 hover:text-ink-50 active:scale-[0.98] ${className}`}
    >
      {children}
    </button>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-400">
        {label}{hint}
      </span>
      {children}
    </label>
  );
}

export const inputCls =
  "focus-ring w-full rounded-lg border border-ink-600 bg-ink-925 px-3.5 py-2.5 text-sm text-ink-100 placeholder:text-ink-500 transition focus:border-leaf-600";

export function EmptyState({ icon, title, sub }: { icon: ReactNode; title: string; sub: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
      <div className="rounded-2xl border border-ink-700 bg-ink-850 p-4 text-ink-500">{icon}</div>
      <p className="font-display text-sm font-semibold text-ink-200">{title}</p>
      <p className="max-w-60 text-xs leading-relaxed text-ink-500">{sub}</p>
    </div>
  );
}

export function SectionTitle({ title, right }: { title: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h3 className="font-display text-[13px] font-semibold uppercase tracking-[0.14em] text-ink-300">{title}</h3>
      {right}
    </div>
  );
}
