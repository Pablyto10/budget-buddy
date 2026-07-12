import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatEUR, useFinance } from "@/lib/finance-store";

// Categorical palette validated for CVD-distinguishability on the app's dark
// card surface (#12181F). Kept clear of green so no category is ever
// mistaken for the app's mint brand/success accent.
const PALETTE = ["#9085e9", "#e66767", "#3987e5", "#d95926", "#d55181", "#c98500"];
const OTHER_COLOR = "#6B7688";
const OTHER_LABEL = "Altro";
const MONTHS_WINDOW = 6;
const EXCLUDED_CATEGORIES = new Set(["Risparmio", "Fondo emergenza"]);

type Period = 1 | 3 | 6;

function monthBucketKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}`;
}

export function ForecastCategoryBreakdown() {
  const { transactions } = useFinance();
  const [period, setPeriod] = useState<Period>(3);
  const [selected, setSelected] = useState<string | null>(null);
  const [showTable, setShowTable] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { months, categories, colorFor } = useMemo(() => {
    const now = new Date();
    const fmt = new Intl.DateTimeFormat("it-IT", { month: "short" });
    const monthDefs = Array.from({ length: MONTHS_WINDOW }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (MONTHS_WINDOW - 1 - i), 1);
      return { key: monthBucketKey(d), label: fmt.format(d) };
    });

    const perMonth = new Map<string, Map<string, number>>();
    monthDefs.forEach((m) => perMonth.set(m.key, new Map()));
    const totalsByCategory = new Map<string, number>();

    for (const t of transactions) {
      if (t.kind !== "expense" || EXCLUDED_CATEGORIES.has(t.category)) continue;
      const key = monthBucketKey(new Date(t.date));
      const bucket = perMonth.get(key);
      if (!bucket) continue;
      bucket.set(t.category, (bucket.get(t.category) ?? 0) + t.amount);
      totalsByCategory.set(t.category, (totalsByCategory.get(t.category) ?? 0) + t.amount);
    }

    const ranked = Array.from(totalsByCategory.entries()).sort((a, b) => b[1] - a[1]);
    const top = ranked.slice(0, PALETTE.length).map(([name]) => name);
    // If a real category is literally named "Altro" (the app's default/fallback
    // category) and it ranks in the top N, don't add a second synthetic "Altro"
    // bucket for the overflow — fold the overflow into the existing one instead.
    const hasOther = ranked.length > PALETTE.length && !top.includes(OTHER_LABEL);
    const categories = top.concat(hasOther ? [OTHER_LABEL] : []);

    const colorMap = new Map<string, string>();
    top.forEach((name, i) => colorMap.set(name, PALETTE[i]));
    if (hasOther) colorMap.set(OTHER_LABEL, OTHER_COLOR);

    const months = monthDefs.map((m) => {
      const bucket = perMonth.get(m.key)!;
      const row: Record<string, number | string> = { label: m.label };
      categories.forEach((c) => {
        row[c] = 0;
      });
      bucket.forEach((amount, cat) => {
        const bucketKey = top.includes(cat) ? cat : OTHER_LABEL;
        row[bucketKey] = (Number(row[bucketKey]) || 0) + amount;
      });
      return row;
    });

    return { months, categories, colorFor: (name: string) => colorMap.get(name) ?? OTHER_COLOR };
  }, [transactions]);

  const periodTotals = useMemo(() => {
    const slice = months.slice(MONTHS_WINDOW - period);
    const totals = new Map<string, number>();
    categories.forEach((c) => totals.set(c, 0));
    slice.forEach((m) => {
      categories.forEach((c) => totals.set(c, (totals.get(c) ?? 0) + Number(m[c] || 0)));
    });
    return totals;
  }, [months, categories, period]);

  const periodSum = useMemo(
    () => Array.from(periodTotals.values()).reduce((s, v) => s + v, 0),
    [periodTotals],
  );

  const donutData = useMemo(
    () =>
      categories
        .map((name) => ({ name, value: periodTotals.get(name) ?? 0 }))
        .filter((d) => d.value > 0)
        .sort((a, b) => b.value - a.value),
    [categories, periodTotals],
  );

  const selectedMax = useMemo(() => {
    if (!selected) return 0;
    return Math.max(...months.map((m) => Number(m[selected] || 0)));
  }, [months, selected]);

  useEffect(() => {
    function onDocClick(ev: MouseEvent) {
      if (!selected) return;
      if (containerRef.current?.contains(ev.target as Node)) return;
      setSelected(null);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [selected]);

  function toggleSelect(name: string) {
    setSelected((cur) => (cur === name ? null : name));
  }

  if (categories.length === 0) {
    return (
      <div className="rounded-2xl border border-white/[0.06] bg-card p-6 text-sm text-muted-foreground">
        Non hai ancora registrato spese negli ultimi {MONTHS_WINDOW} mesi.
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="rounded-2xl border border-white/[0.06] bg-card p-4 md:p-6 space-y-5"
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-display text-lg">Spesa per categoria</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Dove vanno i tuoi soldi ogni mese, voce per voce.
          </p>
          <p className="text-xs text-muted-foreground/70 mt-1 max-w-sm">
            Su desktop passa il mouse per i dettagli. Su mobile tocca una fetta, una barra o una
            voce della legenda per isolare quella categoria.
          </p>
        </div>
        <div className="inline-flex rounded-full border border-white/10 bg-white/5 p-1 shrink-0">
          {([1, 3, 6] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                period === p
                  ? "bg-mint text-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {p === 1 ? "Questo mese" : `Ultimi ${p} mesi`}
            </button>
          ))}
        </div>
      </div>

      {selected ? (
        <div
          className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] pl-3.5 pr-2 py-2.5"
          style={{ borderLeftWidth: 3, borderLeftColor: colorFor(selected) }}
        >
          <span
            className="size-2.5 rounded-sm shrink-0"
            style={{ background: colorFor(selected) }}
          />
          <span className="text-sm font-semibold">{selected}</span>
          <span className="flex-1 text-right text-xs text-muted-foreground">
            <span className="text-foreground font-semibold">
              {formatEUR(periodTotals.get(selected) ?? 0)}
            </span>{" "}
            ·{" "}
            {periodSum > 0 ? Math.round(((periodTotals.get(selected) ?? 0) / periodSum) * 100) : 0}%
            del periodo
          </span>
          <button
            onClick={() => setSelected(null)}
            aria-label="Rimuovi filtro categoria"
            className="size-6 rounded-lg bg-white/5 hover:bg-white/10 grid place-items-center text-xs shrink-0"
          >
            ✕
          </button>
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,240px)_minmax(0,1fr)] gap-6">
        <div className="flex flex-col items-center">
          <div className="relative w-full max-w-[220px] aspect-square">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={donutData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="62%"
                  outerRadius="98%"
                  paddingAngle={2}
                  stroke="none"
                  onClick={(entry) => toggleSelect(String(entry.name))}
                >
                  {donutData.map((d) => (
                    <Cell
                      key={d.name}
                      fill={colorFor(d.name)}
                      className="cursor-pointer transition-opacity"
                      opacity={selected && selected !== d.name ? 0.35 : 1}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "rgba(20,20,24,0.95)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  formatter={(v: number, _n, entry) => [
                    `${formatEUR(v)} · ${periodSum > 0 ? Math.round((v / periodSum) * 100) : 0}%`,
                    entry?.payload?.name,
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="font-display text-xl font-extrabold tabular-nums">
                {formatEUR(periodSum)}
              </span>
              <span className="text-[10px] text-muted-foreground mt-0.5">
                {period === 1 ? "questo mese" : `ultimi ${period} mesi`}
              </span>
            </div>
          </div>

          <div className="w-full mt-4 space-y-0.5">
            {donutData.map((d) => (
              <button
                key={d.name}
                onClick={() => toggleSelect(d.name)}
                className={`w-full flex items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors ${
                  selected === d.name ? "bg-white/[0.06]" : "hover:bg-white/[0.04]"
                }`}
                style={{ opacity: selected && selected !== d.name ? 0.45 : 1 }}
              >
                <span
                  className="size-2.5 rounded-sm shrink-0"
                  style={{ background: colorFor(d.name) }}
                />
                <span className="flex-1 text-sm truncate">{d.name}</span>
                <span className="text-sm font-semibold tabular-nums">{formatEUR(d.value)}</span>
                <span className="text-xs text-muted-foreground tabular-nums w-9 text-right">
                  {periodSum > 0 ? Math.round((d.value / periodSum) * 100) : 0}%
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="min-w-0 h-56 md:h-64">
          <ResponsiveContainer width="100%" height="100%">
            {selected ? (
              <BarChart
                data={months.map((m) => ({ label: m.label, value: Number(m[selected] || 0) }))}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.06)"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  stroke="rgba(255,255,255,0.4)"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="rgba(255,255,255,0.4)"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  domain={[0, selectedMax * 1.25 || 1]}
                  tickFormatter={(v) => `€${Math.round(v)}`}
                />
                <Tooltip
                  contentStyle={{
                    background: "rgba(20,20,24,0.95)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  formatter={(v: number) => [formatEUR(v), selected]}
                />
                <Bar
                  dataKey="value"
                  fill={colorFor(selected)}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={40}
                >
                  <LabelList
                    dataKey="value"
                    position="top"
                    formatter={(v: number) => formatEUR(v)}
                    style={{ fill: "#F8FAFC", fontSize: 11, fontWeight: 600 }}
                  />
                </Bar>
              </BarChart>
            ) : (
              <BarChart data={months}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.06)"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  stroke="rgba(255,255,255,0.4)"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="rgba(255,255,255,0.4)"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `€${Math.round(v)}`}
                />
                <Tooltip
                  contentStyle={{
                    background: "rgba(20,20,24,0.95)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  formatter={(v: number, name) => [formatEUR(v), name]}
                />
                {categories.map((c, i) => (
                  <Bar
                    key={c}
                    dataKey={c}
                    stackId="spend"
                    fill={colorFor(c)}
                    radius={i === categories.length - 1 ? [4, 4, 0, 0] : undefined}
                    onClick={() => toggleSelect(c)}
                    className="cursor-pointer"
                    opacity={selected && selected !== c ? 0.35 : 1}
                    maxBarSize={40}
                  />
                ))}
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        <button
          onClick={() => setShowTable((v) => !v)}
          className="text-xs font-semibold text-mint hover:underline"
        >
          {showTable ? "Nascondi tabella" : "Vedi come tabella"}
        </button>
        {showTable ? (
          <div className="overflow-x-auto mt-3">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="text-muted-foreground">
                  <th className="text-left font-medium py-1.5 pr-3">Categoria</th>
                  {months.map((m) => (
                    <th
                      key={String(m.label)}
                      className="text-right font-medium py-1.5 px-2 tabular-nums"
                    >
                      {m.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {categories.map((c) => (
                  <tr key={c} className="border-t border-white/5">
                    <th className="text-left font-medium py-1.5 pr-3">{c}</th>
                    {months.map((m, i) => (
                      <td key={i} className="text-right py-1.5 px-2 tabular-nums">
                        {formatEUR(Number(m[c] || 0))}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
}
