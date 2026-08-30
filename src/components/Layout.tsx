import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle, BarChart3, CheckCircle2, CloudOff, Info, Loader2, PackageOpen,
  RefreshCw, ScanLine, Users, Wifi, WifiOff, X, XCircle,
} from "lucide-react";
import { useStore, type View } from "../state/store";
import { timeStr } from "../lib/core";

function Clock() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const dte = new Date(now);
  return (
    <div className="hidden text-right leading-tight md:block">
      <div className="num text-lg font-semibold text-ink-100">{timeStr(now)}</div>
      <div className="text-[10px] uppercase tracking-[0.14em] text-ink-500">
        {dte.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
      </div>
    </div>
  );
}

function SyncBadge() {
  const { online, queueCount, syncing, lastSync, simOffline, setSimOffline, pushToast } = useStore();
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => { setSimOffline(!simOffline); pushToast(simOffline ? "success" : "warn", simOffline ? "Back online — draining sync queue" : "Simulated offline: local-first mode engaged"); }}
        title="Toggle simulated network outage"
        className={`focus-ring flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all active:scale-95 ${
          online
            ? "border-leaf-700/60 bg-leaf-950 text-leaf-300 hover:border-leaf-600"
            : "border-flare-600/50 bg-flare-950 text-flare-300 hover:border-flare-500"
        }`}
      >
        {online ? <Wifi size={13} /> : <WifiOff size={13} />}
        <span className="hidden lg:inline">{simOffline ? "Link off (sim)" : "Link on"}</span>
      </button>

      <div
        className={`flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold ${
          !online
            ? "border-flare-600/50 bg-flare-950 text-flare-300"
            : queueCount > 0 || syncing
              ? "border-gold-600/40 bg-gold-950 text-gold-300"
              : "border-leaf-700/60 bg-leaf-950 text-leaf-300"
        }`}
        title={online ? `Last sync ${timeStr(lastSync)}` : "Operating on local IndexedDB storage"}
      >
        <span
          className={`h-2 w-2 rounded-full ${
            !online ? "bg-flare-400" : queueCount > 0 || syncing ? "bg-gold-400 pulse-dot-amber" : "bg-leaf-400 pulse-dot"
          }`}
        />
        {!online ? (
          <span className="flex items-center gap-1.5"><CloudOff size={13} /> Offline · local mode {queueCount > 0 && `· ${queueCount} queued`}</span>
        ) : syncing || queueCount > 0 ? (
          <span className="flex items-center gap-1.5"><Loader2 size={13} className="animate-spin" /> Syncing · {queueCount} queued</span>
        ) : (
          <span className="flex items-center gap-1.5"><CheckCircle2 size={13} /> Online · synced {timeStr(lastSync)}</span>
        )}
      </div>
    </div>
  );
}

function Toasts() {
  const { toasts, dismissToast } = useStore();
  const icon = {
    success: <CheckCircle2 size={16} className="text-leaf-400" />,
    error: <XCircle size={16} className="text-flare-400" />,
    warn: <AlertTriangle size={16} className="text-gold-400" />,
    info: <Info size={16} className="text-ice-400" />,
  } as const;
  const bar = { success: "bg-leaf-500", error: "bg-flare-500", warn: "bg-gold-500", info: "bg-ice-500" } as const;
  return (
    <div className="pointer-events-none fixed right-4 top-16 z-[70] flex w-80 flex-col gap-2">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.button
            key={t.id} layout onClick={() => dismissToast(t.id)}
            initial={{ opacity: 0, x: 60, scale: 0.95 }} animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40, scale: 0.95 }} transition={{ type: "spring", stiffness: 420, damping: 32 }}
            className="pointer-events-auto relative flex items-start gap-2.5 overflow-hidden rounded-lg border border-ink-700 bg-ink-850 px-3.5 py-3 text-left shadow-lift"
          >
            <span className={`absolute inset-y-0 left-0 w-1 ${bar[t.kind]}`} />
            <span className="mt-0.5 shrink-0">{icon[t.kind]}</span>
            <span className="text-[13px] font-medium leading-snug text-ink-100">{t.msg}</span>
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}

const NAV: { id: View; label: string; icon: ReactNode }[] = [
  { id: "pos", label: "Terminal", icon: <ScanLine size={19} /> },
  { id: "inventory", label: "Inventory", icon: <PackageOpen size={19} /> },
  { id: "customers", label: "Ledgers", icon: <Users size={19} /> },
  { id: "dashboard", label: "Dashboard", icon: <BarChart3 size={19} /> },
];

export function Layout({ children }: { children: ReactNode }) {
  const { view, setView, held, resetDemo, pushToast } = useStore();
  return (
    <div className="aura-bg relative flex h-screen overflow-hidden">
      <div className="grid-overlay scanline pointer-events-none absolute inset-0" />

      {/* sidebar */}
      <aside className="relative z-10 flex w-[68px] shrink-0 flex-col border-r border-ink-800 bg-ink-925/90 xl:w-52">
        <div className="flex h-16 items-center gap-2.5 border-b border-ink-800 px-4">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-leaf-500 text-ink-950 shadow-[0_0_24px_rgb(53_197_108/0.35)]">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden>
              <rect x="3" y="5" width="2.6" height="14" rx="1" /><rect x="7.4" y="5" width="1.6" height="14" rx=".8" opacity=".85" />
              <rect x="10.8" y="5" width="3.4" height="14" rx="1" /><rect x="16" y="5" width="1.6" height="14" rx=".8" opacity=".85" />
              <rect x="19.4" y="5" width="1.8" height="14" rx=".9" />
            </svg>
          </div>
          <div className="hidden leading-tight xl:block">
            <div className="font-display text-[15px] font-bold tracking-tight text-ink-50">AuraPOS</div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-leaf-500">Grocery Ed.</div>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-1 p-2.5">
          {NAV.map((n) => {
            const active = view === n.id;
            return (
              <button
                key={n.id} onClick={() => setView(n.id)}
                title={n.label}
                className={`focus-ring group relative flex min-h-12 items-center gap-3 rounded-lg px-3 text-sm font-semibold transition-all ${
                  active ? "bg-ink-800 text-leaf-400" : "text-ink-400 hover:bg-ink-850 hover:text-ink-200"
                }`}
              >
                {active && <motion.span layoutId="nav-glow" className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-leaf-500" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
                <span className="shrink-0">{n.icon}</span>
                <span className="hidden xl:inline">{n.label}</span>
                {n.id === "pos" && held.length > 0 && (
                  <span className="num ml-auto hidden rounded-full bg-gold-500/15 px-2 py-0.5 text-[11px] font-bold text-gold-400 xl:inline">{held.length}</span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-ink-800 p-2.5">
          <button
            onClick={() => { void resetDemo(); pushToast("info", "Rebuilding demo dataset…"); }}
            title="Regenerate demo data"
            className="focus-ring flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-[13px] font-medium text-ink-500 transition hover:bg-ink-850 hover:text-ink-300"
          >
            <RefreshCw size={16} className="shrink-0" />
            <span className="hidden xl:inline">Reset demo data</span>
          </button>
          <div className="mt-2 hidden items-center gap-2.5 rounded-lg bg-ink-850 px-3 py-2.5 xl:flex">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-cobalt-500/20 text-[12px] font-bold text-cobalt-300">RC</div>
            <div className="leading-tight">
              <div className="text-[13px] font-semibold text-ink-100">Rae Chen</div>
              <div className="text-[10px] uppercase tracking-wider text-ink-500">Register 02 · Shift A</div>
            </div>
          </div>
        </div>
      </aside>

      {/* main column */}
      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-ink-800 bg-ink-925/70 px-5 backdrop-blur">
          <div className="flex items-center gap-3">
            <h1 className="font-display text-lg font-bold tracking-tight text-ink-50">
              {view === "pos" && "Rapid Checkout"}
              {view === "inventory" && "Stock Control"}
              {view === "customers" && "Customer Ledgers"}
              {view === "dashboard" && "Store Intelligence"}
            </h1>
            {view === "pos" && (
              <span className="num hidden rounded-md border border-ink-700 bg-ink-850 px-2 py-1 text-[11px] text-ink-400 sm:inline">
                Lane 02
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <SyncBadge />
            <div className="h-8 w-px bg-ink-800" />
            <Clock />
          </div>
        </header>

        <main className="min-h-0 flex-1">{children}</main>
      </div>

      <Toasts />
    </div>
  );
}
