import { useEffect, useMemo, useState } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { motion } from "framer-motion";
import { ClipboardCheck, Printer, Receipt, TrendingDown, TrendingUp } from "lucide-react";
import { useStore } from "../../state/store";
import { getMeta, setMeta } from "../../lib/db";
import { CATEGORIES, money, money0, pct, round3, type Method } from "../../lib/core";
import { CountUp, Field, GhostBtn, Modal, ModalHeader, PrimaryBtn, SectionTitle, inputCls } from "../../components/ui";

const tooltipStyle = {
  background: "#151c17", border: "1px solid #27332c", borderRadius: 10,
  fontSize: 12, color: "#e2eae4", fontFamily: "IBM Plex Mono, monospace",
} as const;

const methodMeta: Record<Method, { label: string; color: string }> = {
  cash: { label: "Cash", color: "#35c56c" },
  card: { label: "Card", color: "#6a9ef5" },
  qr: { label: "QR / Mobile", color: "#53c6de" },
  store_credit: { label: "Store credit", color: "#f0954f" },
  on_credit: { label: "Khata", color: "#f0655a" },
};

export function Dashboard() {
  const { sales } = useStore();
  const [shiftOpen, setShiftOpen] = useState(false);

  const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
  const yStart = new Date(dayStart); yStart.setDate(yStart.getDate() - 1);

  const { today, yesterday } = useMemo(() => ({
    today: sales.filter((s) => s.ts >= dayStart.getTime()),
    yesterday: sales.filter((s) => s.ts >= yStart.getTime() && s.ts < dayStart.getTime()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [sales]);

  const kpi = (list: typeof sales) => {
    const revenue = list.reduce((a, s) => a + s.total, 0);
    const profit = list.reduce((a, s) => a + s.profit, 0);
    return { revenue, profit, avg: list.length ? revenue / list.length : 0, count: list.length };
  };
  const t = kpi(today); const y = kpi(yesterday);
  const delta = (a: number, b: number) => (b > 0 ? ((a - b) / b) * 100 : 100);

  const hourly = useMemo(() => {
    const buckets = Array.from({ length: 16 }, (_, i) => ({ hour: `${i + 7}:00`, revenue: 0, tx: 0 }));
    today.forEach((s) => {
      const h = new Date(s.ts).getHours() - 7;
      if (h >= 0 && h < 16) { buckets[h].revenue = round3(buckets[h].revenue + s.total); buckets[h].tx += 1; }
    });
    return buckets;
  }, [today]);

  const byCategory = useMemo(() => CATEGORIES.map((c) => ({
    name: c.name, color: c.hue,
    value: round3(sales.reduce((a, s) => a + s.lines.filter((l) => l.category === c.id).reduce((x, l) => x + l.total, 0), 0)),
  })).filter((d) => d.value > 0), [sales]);

  const trend = useMemo(() => {
    const days: { day: string; revenue: number; profit: number; margin: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const ds = new Date(dayStart); ds.setDate(ds.getDate() - i);
      const de = new Date(ds); de.setDate(de.getDate() + 1);
      const list = sales.filter((s) => s.ts >= ds.getTime() && s.ts < de.getTime());
      const revenue = list.reduce((a, s) => a + s.total, 0);
      const profit = list.reduce((a, s) => a + s.profit, 0);
      days.push({
        day: ds.toLocaleDateString("en-US", { weekday: "short" }),
        revenue: Math.round(revenue), profit: Math.round(profit),
        margin: revenue > 0 ? +((profit / revenue) * 100).toFixed(1) : 0,
      });
    }
    return days;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sales]);

  const payMix = useMemo(() => {
    const m: Record<Method, number> = { cash: 0, card: 0, qr: 0, store_credit: 0, on_credit: 0 };
    today.forEach((s) => s.payments.forEach((p) => { m[p.method] = round3(m[p.method] + p.amount); }));
    return (Object.keys(m) as Method[]).map((k) => ({ method: k, ...methodMeta[k], amount: m[k] }))
      .sort((a, b) => b.amount - a.amount);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today]);
  const payTotal = payMix.reduce((a, p) => a + p.amount, 0);

  const cards = [
    { label: "Revenue today", value: t.revenue, d: delta(t.revenue, y.revenue), money: true, accent: "text-leaf-400", dec: 2 },
    { label: "Net profit", value: t.profit, d: delta(t.profit, y.profit), money: true, accent: "text-ice-400", dec: 2 },
    { label: "Avg ticket", value: t.avg, d: delta(t.avg, y.avg), money: true, accent: "text-gold-400", dec: 2 },
    { label: "Transactions", value: t.count, d: delta(t.count, y.count), money: false, accent: "text-cobalt-400", dec: 0 },
  ];

  return (
    <div className="h-full overflow-y-auto p-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {cards.map((c, i) => (
          <motion.div key={c.label} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
            className="relative overflow-hidden rounded-xl border border-ink-800 bg-ink-900/80 px-5 py-4">
            <span className="absolute inset-x-0 top-0 h-[3px]" style={{ background: `linear-gradient(90deg, ${["#35c56c", "#53c6de", "#f2b33d", "#6a9ef5"][i]}, transparent 70%)` }} />
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500">{c.label}</p>
            <div className="mt-1.5 flex items-baseline gap-2.5">
              <CountUp value={c.value} decimals={c.dec} prefix={c.money ? "$" : ""} className={`text-[28px] font-bold leading-none ${c.accent}`} />
              <span className={`num flex items-center gap-1 text-[11.5px] font-bold ${c.d >= 0 ? "text-leaf-400" : "text-flare-400"}`}>
                {c.d >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}{pct(c.d)}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-ink-600">vs yesterday · {c.label === "Transactions" ? `${y.count} sales` : money(c.label === "Avg ticket" ? y.avg : c.label === "Net profit" ? y.profit : y.revenue)}</p>
          </motion.div>
        ))}
      </div>

      {/* charts row 1 */}
      <div className="mt-4 grid gap-4 xl:grid-cols-12">
        <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
          className="rounded-xl border border-ink-800 bg-ink-900/80 p-5 xl:col-span-7">
          <SectionTitle title="Peak sales hours · today" right={<span className="num text-[11px] text-ink-500">{t.count} transactions</span>} />
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourly} margin={{ top: 4, right: 4, left: -14, bottom: 0 }}>
                <CartesianGrid stroke="#202a24" strokeDasharray="3 6" vertical={false} />
                <XAxis dataKey="hour" tick={{ fill: "#6b7d72", fontSize: 10, fontFamily: "IBM Plex Mono" }} axisLine={false} tickLine={false} interval={1} />
                <YAxis tick={{ fill: "#6b7d72", fontSize: 10, fontFamily: "IBM Plex Mono" }} axisLine={false} tickLine={false} tickFormatter={(v) => "$" + v} />
                <Tooltip cursor={{ fill: "rgb(53 197 108 / 0.06)" }} contentStyle={tooltipStyle}
                  formatter={(v: unknown, name: unknown) => [name === "tx" ? `${v} sales` : money(Number(v)), name === "tx" ? "Transactions" : "Revenue"]} />
                <Bar dataKey="revenue" name="revenue" radius={[5, 5, 0, 0]} maxBarSize={26}>
                  {hourly.map((h, i) => <Cell key={i} fill={h.revenue === Math.max(...hourly.map((x) => x.revenue)) && h.revenue > 0 ? "#35c56c" : "#27563b"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.section>

        <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}
          className="rounded-xl border border-ink-800 bg-ink-900/80 p-5 xl:col-span-5">
          <SectionTitle title="Category share · 7 days" />
          <div className="flex items-center gap-2">
            <div className="h-64 flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={byCategory} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="86%" paddingAngle={3} stroke="none">
                    {byCategory.map((c) => <Cell key={c.name} fill={c.color} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: unknown) => money(Number(v))} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="w-36 space-y-2">
              {byCategory.map((c) => (
                <li key={c.name} className="flex items-center gap-2 text-[11.5px]">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: c.color }} />
                  <span className="min-w-0 truncate text-ink-300">{c.name}</span>
                  <span className="num ml-auto font-bold text-ink-200">{money0(c.value)}</span>
                </li>
              ))}
            </ul>
          </div>
        </motion.section>
      </div>

      {/* charts row 2 */}
      <div className="mt-4 grid gap-4 pb-2 xl:grid-cols-12">
        <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}
          className="rounded-xl border border-ink-800 bg-ink-900/80 p-5 xl:col-span-7">
          <SectionTitle title="Revenue vs profit · margin trend" right={<span className="num rounded-md bg-ink-850 px-2 py-1 text-[11px] text-leaf-400">avg margin {((trend.reduce((a, d) => a + d.margin, 0) / 7)).toFixed(1)}%</span>} />
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#35c56c" stopOpacity={0.35} /><stop offset="100%" stopColor="#35c56c" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gProfit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#53c6de" stopOpacity={0.35} /><stop offset="100%" stopColor="#53c6de" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#202a24" strokeDasharray="3 6" vertical={false} />
                <XAxis dataKey="day" tick={{ fill: "#6b7d72", fontSize: 10, fontFamily: "IBM Plex Mono" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#6b7d72", fontSize: 10, fontFamily: "IBM Plex Mono" }} axisLine={false} tickLine={false} tickFormatter={(v) => "$" + v} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: unknown, name: unknown) => [money(Number(v)), name === "revenue" ? "Revenue" : "Profit"]} />
                <Area type="monotone" dataKey="revenue" stroke="#35c56c" strokeWidth={2.5} fill="url(#gRev)" />
                <Area type="monotone" dataKey="profit" stroke="#53c6de" strokeWidth={2.5} fill="url(#gProfit)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.section>

        <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.26 }}
          className="flex flex-col rounded-xl border border-ink-800 bg-ink-900/80 p-5 xl:col-span-5">
          <SectionTitle title="Tender mix · today" right={<button onClick={() => setShiftOpen(true)} className="focus-ring flex items-center gap-1.5 rounded-lg border border-gold-600/50 bg-gold-950 px-3 py-1.5 text-[12px] font-bold text-gold-300 transition hover:border-gold-500 active:scale-95"><ClipboardCheck size={13} /> Z-Read</button>} />
          <ul className="mt-1 flex-1 space-y-3">
            {payMix.map((p) => (
              <li key={p.method}>
                <div className="mb-1 flex items-center justify-between text-[12px]">
                  <span className="flex items-center gap-2 font-semibold text-ink-300"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: p.color }} />{p.label}</span>
                  <span className="num font-bold text-ink-100">{money(p.amount)} <span className="text-[10px] font-medium text-ink-500">{payTotal ? Math.round((p.amount / payTotal) * 100) : 0}%</span></span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-ink-800">
                  <motion.div className="h-full rounded-full" style={{ background: p.color }}
                    initial={{ width: 0 }} animate={{ width: `${payTotal ? (p.amount / payTotal) * 100 : 0}%` }}
                    transition={{ type: "spring", stiffness: 120, damping: 24, delay: 0.3 }} />
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex items-center justify-between rounded-lg border border-ink-750 bg-ink-850 px-4 py-3">
            <span className="flex items-center gap-2 text-[12.5px] font-semibold text-ink-300"><Receipt size={15} className="text-ink-500" /> Collected today</span>
            <span className="num text-xl font-bold text-leaf-400">{money(payTotal)}</span>
          </div>
        </motion.section>
      </div>

      <ShiftModal open={shiftOpen} onClose={() => setShiftOpen(false)} />
    </div>
  );
}

// ---------- Shift close / Z-read ----------
function ShiftModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { sales, pushToast } = useStore();
  const [counted, setCounted] = useState("");
  const [shiftStart, setShiftStart] = useState<number>(Date.now());
  const [lastZ, setLastZ] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    void getMeta<number>("shiftStart", new Date(new Date().setHours(8, 0, 0, 0)).getTime()).then(setShiftStart);
    void getMeta<string>("lastZ", "never").then(setLastZ);
  }, [open]);

  const shiftSales = useMemo(() => sales.filter((s) => s.ts >= shiftStart), [sales, shiftStart]);
  const sums: Record<Method, number> = { cash: 0, card: 0, qr: 0, store_credit: 0, on_credit: 0 };
  shiftSales.forEach((s) => s.payments.forEach((p) => { sums[p.method] = round3(sums[p.method] + p.amount); }));
  const expectedCash = sums.cash;
  const countedNum = parseFloat(counted) || 0;
  const variance = round3(countedNum - expectedCash);

  const closeShift = async () => {
    const stamp = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    await setMeta("shiftStart", Date.now());
    await setMeta("lastZ", `Z-read ${new Date().toLocaleDateString()} ${stamp} · variance ${money(variance)}`);
    setLastZ(`Z-read ${new Date().toLocaleDateString()} ${stamp} · variance ${money(variance)}`);
    setShiftStart(Date.now());
    pushToast("success", "Shift closed — drawer reconciled and Z-report filed");
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} width="max-w-lg" label="Shift close report">
      <ModalHeader title="Drawer close · Z-Read" sub={`Shift open since ${new Date(shiftStart).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })} · last close: ${lastZ ?? "—"}`} onClose={onClose} />
      <div className="space-y-4 p-6">
        <div className="grid grid-cols-2 gap-2.5">
          {(Object.keys(sums) as Method[]).map((m) => (
            <div key={m} className="flex items-center justify-between rounded-lg border border-ink-750 bg-ink-850 px-3.5 py-2.5">
              <span className="flex items-center gap-2 text-[12.5px] font-semibold text-ink-300">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: methodMeta[m].color }} />{methodMeta[m].label}
              </span>
              <span className="num text-[14px] font-bold text-ink-100">{money(sums[m])}</span>
            </div>
          ))}
          <div className="flex items-center justify-between rounded-lg border border-ink-750 bg-ink-850 px-3.5 py-2.5">
            <span className="text-[12.5px] font-semibold text-ink-300">Receipts</span>
            <span className="num text-[14px] font-bold text-ink-100">{shiftSales.length}</span>
          </div>
        </div>

        <div className="rounded-xl border border-leaf-700/40 bg-leaf-950/40 p-4">
          <div className="flex items-baseline justify-between">
            <span className="text-[12px] font-bold uppercase tracking-wider text-leaf-300">Expected cash in drawer</span>
            <span className="num text-2xl font-bold text-leaf-300">{money(expectedCash)}</span>
          </div>
          <div className="mt-3">
            <Field label="Counted cash (blind count)">
              <input autoFocus type="number" step="0.01" value={counted} onChange={(e) => setCounted(e.target.value)} className={`${inputCls} num text-lg font-bold`} placeholder="0.00" />
            </Field>
          </div>
          {counted !== "" && (
            <div className={`mt-3 flex items-center justify-between rounded-lg px-3.5 py-2.5 text-[13px] font-bold ${
              Math.abs(variance) < 0.005 ? "bg-leaf-500/15 text-leaf-300" : variance < 0 ? "bg-flare-500/15 text-flare-300" : "bg-gold-500/15 text-gold-300"}`}>
              <span>{Math.abs(variance) < 0.005 ? "Drawer balanced" : variance < 0 ? "Shortage detected" : "Overage detected"}</span>
              <span className="num">{variance >= 0 ? "+" : ""}{money(variance)}</span>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2.5">
          <GhostBtn onClick={() => pushToast("info", "Z-report sent to back-office printer")}><Printer size={15} /> Print report</GhostBtn>
          <PrimaryBtn onClick={() => void closeShift()}>Close shift & file Z</PrimaryBtn>
        </div>
      </div>
    </Modal>
  );
}
