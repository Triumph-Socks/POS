import { motion } from "framer-motion";
import { StoreProvider, useStore } from "./state/store";
import { Layout } from "./components/Layout";
import { Terminal } from "./modules/pos/Terminal";
import { Inventory } from "./modules/inventory/Inventory";
import { Customers } from "./modules/customers/Customers";
import { Dashboard } from "./modules/dashboard/Dashboard";

function BootSplash() {
  return (
    <div className="aura-bg relative grid h-screen place-items-center overflow-hidden">
      <div className="grid-overlay scanline pointer-events-none absolute inset-0" />
      <div className="relative flex flex-col items-center gap-5">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 20 }}
          className="grid h-16 w-16 place-items-center rounded-2xl bg-leaf-500 text-ink-950 shadow-[0_0_60px_rgb(53_197_108/0.4)]"
        >
          <svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor" aria-hidden>
            <rect x="3" y="5" width="2.6" height="14" rx="1" /><rect x="7.4" y="5" width="1.6" height="14" rx=".8" opacity=".85" />
            <rect x="10.8" y="5" width="3.4" height="14" rx="1" /><rect x="16" y="5" width="1.6" height="14" rx=".8" opacity=".85" />
            <rect x="19.4" y="5" width="1.8" height="14" rx=".9" />
          </svg>
        </motion.div>
        <div className="text-center">
          <p className="font-display text-xl font-bold tracking-tight text-ink-50">AuraPOS</p>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-leaf-500">Grocery Edition</p>
        </div>
        <div className="flex items-center gap-2 text-[12px] font-medium text-ink-500">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-leaf-500" />
          Opening local database · hydrating catalog…
        </div>
      </div>
    </div>
  );
}

function Shell() {
  const { booted, view } = useStore();
  if (!booted) return <BootSplash />;
  return (
    <Layout>
      {view === "pos" && <Terminal />}
      {view === "inventory" && <Inventory />}
      {view === "customers" && <Customers />}
      {view === "dashboard" && <Dashboard />}
    </Layout>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
