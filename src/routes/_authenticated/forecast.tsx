import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, TrendingUp, TrendingDown, Sparkles } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

import { useFinance, formatEUR, monthlyEquivalent } from "@/lib/finance-store";

export const Route = createFileRoute("/_authenticated/forecast")({
  head: () => ({
    meta: [
      { title: "Forecast — Where's My Budget" },
      {
        name: "description",
        content:
          "Proiezione della tua situazione economica nei prossimi 3, 6 o 12 mesi in base alle tue entrate ricorrenti, spese e abbonamenti.",
      },
      { property: "og:title", content: "Forecast — Where's My Budget" },
      {
        property: "og:description",
        content:
          "Guarda dove sarà il tuo bilancio tra qualche mese: proiezione basata su entrate, spese e abbonamenti.",
      },
    ],
  }),
  component: ForecastPage,
});

type Horizon = 3 | 6 | 12;
type ForecastView = "balance" | "Risparmio" | "Fondo emergenza";

const VIEW_LABELS: Record<
  ForecastView,
  {
    title: string;
    intro: string;
    current: string;
    projected: string;
    monthly: string;
    hintCurrent: string;
    hintProjectedPositive: string;
    hintProjectedNegative: string;
    hintMonthlyPositive: string;
    hintMonthlyNegative: string;
    breakdownTitle: string;
    breakdownSubtitle: string;
    row1: string;
    row2: string;
    row3: string;
    equation: string;
    empty: string;
  }
> = {
  balance: {
    title: "Dove sarà il tuo bilancio",
    intro:
      "Partiamo dal tuo bilancio di oggi e ogni mese aggiungiamo le entrate medie e togliamo uscite e abbonamenti. Così vedi dove finirai se continui con lo stesso ritmo.",
    current: "Bilancio oggi",
    projected: "Bilancio previsto",
    monthly: "Quanto risparmi (o perdi) ogni mese",
    hintCurrent: "Il saldo che hai in questo momento (entrate − uscite − abbonamenti)",
    hintProjectedPositive: "Quanto avresti da parte se continui così",
    hintProjectedNegative: "Saresti in rosso di questa cifra",
    hintMonthlyPositive: "Entrate − uscite − abbonamenti: ogni mese il bilancio cresce",
    hintMonthlyNegative: "Entrate − uscite − abbonamenti: ogni mese il bilancio cala",
    breakdownTitle: "Come calcoliamo il tuo mese tipo",
    breakdownSubtitle: "Media di entrate e uscite degli ultimi mesi + costo mensile degli abbonamenti attivi.",
    row1: "Entrate medie / mese",
    row2: "Uscite medie / mese",
    row3: "Abbonamenti / mese",
    equation: "= Quanto ti resta ogni mese",
    empty: "Non hai ancora registrato movimenti.",
  },
  Risparmio: {
    title: "Dove sarà il tuo risparmio",
    intro:
      "Partiamo da quanto hai già messo da parte e ogni mese aggiungiamo la media dei versamenti in categoria Risparmio. Così vedi quanto accumuli se continui così.",
    current: "Risparmio accumulato oggi",
    projected: "Risparmio previsto",
    monthly: "Quanto metti da parte ogni mese",
    hintCurrent: "Tutti i versamenti in categoria Risparmio registrati finora",
    hintProjectedPositive: "Quanto avresti da parte se continui a versare la stessa media",
    hintProjectedNegative: "Proiezione negativa: controlla i versamenti passati",
    hintMonthlyPositive: "Media dei versamenti Risparmio degli ultimi mesi",
    hintMonthlyNegative: "Media dei prelievi/versamenti negativi: il risparmio cala",
    breakdownTitle: "Come calcoliamo il tuo risparmio",
    breakdownSubtitle: "Media dei versamenti mensili in categoria Risparmio + totale già versato.",
    row1: "Versamenti medi / mese",
    row2: "Totale versato oggi",
    row3: "Proiezione",
    equation: "= Quanto metti da parte ogni mese",
    empty: "Non hai ancora registrato versamenti in categoria Risparmio.",
  },
  "Fondo emergenza": {
    title: "Dove sarà il tuo fondo emergenza",
    intro:
      "Partiamo da quanto hai già versato nel fondo emergenza e ogni mese aggiungiamo la media dei versamenti in quella categoria. Così vedi quanto avrai a disposizione in caso di emergenza.",
    current: "Fondo emergenza oggi",
    projected: "Fondo emergenza previsto",
    monthly: "Quanto versi ogni mese",
    hintCurrent: "Tutti i versamenti in categoria Fondo emergenza registrati finora",
    hintProjectedPositive: "Quanto avresti nel fondo se continui a versare la stessa media",
    hintProjectedNegative: "Proiezione negativa: controlla i versamenti passati",
    hintMonthlyPositive: "Media dei versamenti Fondo emergenza degli ultimi mesi",
    hintMonthlyNegative: "Media dei prelievi/versamenti negativi: il fondo cala",
    breakdownTitle: "Come calcoliamo il tuo fondo emergenza",
    breakdownSubtitle: "Media dei versamenti mensili in categoria Fondo emergenza + totale già versato.",
    row1: "Versamenti medi / mese",
    row2: "Totale versato oggi",
    row3: "Proiezione",
    equation: "= Quanto versi ogni mese",
    empty: "Non hai ancora registrato versamenti in categoria Fondo emergenza.",
  },
};

function ForecastPage() {
  const { transactions, subscriptions } = useFinance();
  const [horizon, setHorizon] = useState<Horizon>(6);
  const [view, setView] = useState<ForecastView>("balance");
  const labels = VIEW_LABELS[view];

  const subsMonthly = useMemo(
    () =>
      subscriptions
        .filter((s) => s.active)
        .reduce((sum, s) => sum + monthlyEquivalent(s), 0),
    [subscriptions],
  );

  // Bilancio attuale = entrate - uscite - abbonamenti mensili
  const currentBalance = useMemo(() => {
    const tx = transactions.reduce(
      (s, t) => s + (t.kind === "income" ? t.amount : -t.amount),
      0,
    );
    return tx - subsMonthly;
  }, [transactions, subsMonthly]);

  // Stima entrate e uscite mensili sulla media degli ultimi 3 mesi.
  // Le uscite escludono la categoria "Abbonamenti" per evitare doppio conteggio
  // (gli abbonamenti sono già contati come subsMonthly).
  const { avgIncome, avgExpense, monthsUsed } = useMemo(() => {
    const now = new Date();
    const buckets = new Map<string, { income: number; expense: number }>();
    for (let i = 0; i < 3; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.set(`${d.getFullYear()}-${d.getMonth()}`, { income: 0, expense: 0 });
    }
    for (const t of transactions) {
      const d = new Date(t.date);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const b = buckets.get(key);
      if (!b) continue;
      if (t.kind === "income") b.income += t.amount;
      else if (t.category !== "Abbonamenti") b.expense += t.amount;
    }
    const list = Array.from(buckets.values());
    // Media sui soli mesi che hanno effettivamente entrate/uscite,
    // così un singolo stipendio inserito viene contato come mensile
    // invece di essere diluito su 3 mesi.
    const incomeMonths = list.filter((b) => b.income > 0);
    const expenseMonths = list.filter((b) => b.expense > 0);
    const income =
      incomeMonths.length > 0
        ? incomeMonths.reduce((s, b) => s + b.income, 0) / incomeMonths.length
        : 0;
    const expense =
      expenseMonths.length > 0
        ? expenseMonths.reduce((s, b) => s + b.expense, 0) / expenseMonths.length
        : 0;
    const monthsUsed = Math.max(incomeMonths.length, expenseMonths.length, 1);
    return { avgIncome: income, avgExpense: expense, monthsUsed };
  }, [transactions]);

  const monthlyNet = avgIncome - avgExpense - subsMonthly;

  const chartData = useMemo(() => {
    const now = new Date();
    const fmt = new Intl.DateTimeFormat("it-IT", { month: "short", year: "2-digit" });
    const rows: {
      label: string;
      bilancio: number;
      month: number;
    }[] = [
      { label: "Oggi", bilancio: Math.round(currentBalance), month: 0 },
    ];
    let running = currentBalance;
    for (let i = 1; i <= horizon; i++) {
      running += monthlyNet;
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      rows.push({ label: fmt.format(d), bilancio: Math.round(running), month: i });
    }
    return rows;
  }, [currentBalance, monthlyNet, horizon]);

  const projected = chartData[chartData.length - 1].bilancio;
  const delta = projected - currentBalance;
  const positive = delta >= 0;

  // Mese in cui il bilancio (se in calo) diventerebbe negativo
  const breakEvenMonth = useMemo(() => {
    if (monthlyNet >= 0 || currentBalance < 0) return null;
    const months = Math.ceil(currentBalance / -monthlyNet);
    return months;
  }, [currentBalance, monthlyNet]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="sticky top-0 z-40 flex items-center justify-between px-6 py-4 border-b border-white/5 bg-background/80 backdrop-blur-xl">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          Torna alla dashboard
        </Link>
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-mint/10 border border-mint/20">
          <Sparkles className="size-3.5 text-mint" />
          <span className="text-mint text-xs font-medium">Forecast</span>
        </div>
      </nav>

      <main className="mx-auto max-w-4xl px-6 py-8 space-y-8 pb-24">
        <header className="space-y-3">
          <p className="text-xs uppercase tracking-[0.18em] text-mint">
            Proiezione economica
          </p>
          <h1 className="font-display text-3xl md:text-4xl leading-[1.1]">
            Dove sarà il tuo bilancio tra {horizon} mesi?
          </h1>
          <p className="text-muted-foreground max-w-2xl">
            Partiamo dal tuo bilancio di oggi e ogni mese aggiungiamo le entrate
            medie e togliamo uscite e abbonamenti. Così vedi dove finirai se
            continui con lo stesso ritmo degli ultimi {monthsUsed} mesi.
          </p>
        </header>

        {/* Horizon selector */}
        <div className="inline-flex rounded-full border border-white/10 bg-white/5 p-1">
          {([3, 6, 12] as Horizon[]).map((h) => (
            <button
              key={h}
              onClick={() => setHorizon(h)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                horizon === h
                  ? "bg-mint text-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {h} mesi
            </button>
          ))}
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <KpiCard
            label="Bilancio oggi"
            value={formatEUR(currentBalance)}
            hint="Il saldo che hai in questo momento (entrate − uscite − abbonamenti)"
          />
          <KpiCard
            label={`Bilancio previsto tra ${horizon} mesi`}
            value={formatEUR(projected)}
            hint={
              projected >= 0
                ? `Quanto avresti da parte tra ${horizon} mesi se continui così`
                : `Tra ${horizon} mesi saresti in rosso di questa cifra`
            }
            accentPositive={projected >= 0}
          />
          <KpiCard
            label="Quanto risparmi (o perdi) ogni mese"
            value={`${monthlyNet >= 0 ? "+" : ""}${formatEUR(monthlyNet)}`}
            hint={
              monthlyNet >= 0
                ? `Entrate − uscite − abbonamenti: ogni mese il bilancio cresce di ${formatEUR(monthlyNet)}`
                : `Entrate − uscite − abbonamenti: ogni mese il bilancio cala di ${formatEUR(Math.abs(monthlyNet))}`
            }
            accentPositive={monthlyNet >= 0}
            icon={
              monthlyNet >= 0 ? (
                <TrendingUp className="size-4 text-mint" />
              ) : (
                <TrendingDown className="size-4 text-rose-soft" />
              )
            }
          />
        </div>

        {/* Chart */}
        <div className="rounded-2xl border border-white/[0.06] bg-card p-4 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg">Proiezione bilancio</h2>
            <span className={`text-xs font-medium ${positive ? "text-mint" : "text-rose-soft"}`}>
              {positive ? "+" : ""}
              {formatEUR(delta)} in {horizon} mesi
            </span>
          </div>
          <div className="h-64 md:h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="forecast-line" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#22C55E" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#22C55E" stopOpacity={1} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
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
                  tickFormatter={(v) => `€${Math.round(v / 1000)}k`}
                />
                <Tooltip
                  contentStyle={{
                    background: "rgba(20,20,24,0.95)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  formatter={(v: number) => [formatEUR(v), "Bilancio"]}
                />
                <ReferenceLine y={0} stroke="rgba(244,63,94,0.4)" strokeDasharray="4 4" />
                <Line
                  type="monotone"
                  dataKey="bilancio"
                  stroke="url(#forecast-line)"
                  strokeWidth={2.5}
                  dot={{ fill: "#22C55E", r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Breakdown */}
        <div className="rounded-2xl border border-white/[0.06] bg-card p-6 space-y-4">
          <div>
            <h2 className="font-display text-lg">Come calcoliamo il tuo mese tipo</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Media di entrate e uscite degli ultimi {monthsUsed} mesi + costo
              mensile degli abbonamenti attivi.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <Row
              label="Entrate medie / mese"
              value={`+ ${formatEUR(avgIncome)}`}
              tone="mint"
            />
            <Row
              label="Uscite medie / mese"
              value={`- ${formatEUR(avgExpense)}`}
              tone="rose"
            />
            <Row
              label="Abbonamenti / mese"
              value={`- ${formatEUR(subsMonthly)}`}
              tone="rose"
            />
          </div>
          <div className="border-t border-white/5 pt-4 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              = Quanto ti resta ogni mese
            </span>
            <span className={`font-display text-xl ${monthlyNet >= 0 ? "text-mint" : "text-rose-soft"}`}>
              {monthlyNet >= 0 ? "+" : ""}
              {formatEUR(monthlyNet)}
            </span>
          </div>
        </div>

        {/* Detail table */}
        <div className="rounded-2xl border border-white/[0.06] bg-card overflow-hidden">
          <div className="px-6 py-4 border-b border-white/5">
            <h2 className="font-display text-lg">Mese per mese</h2>
          </div>
          <div className="divide-y divide-white/5">
            {chartData.slice(1).map((row) => (
              <div key={row.month} className="flex items-center justify-between px-6 py-3 text-sm">
                <span className="capitalize text-muted-foreground">{row.label}</span>
                <span className={row.bilancio >= 0 ? "text-foreground font-medium" : "text-rose-soft font-medium"}>
                  {formatEUR(row.bilancio)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {breakEvenMonth !== null && breakEvenMonth <= horizon ? (
          <div className="rounded-2xl border border-rose-soft/30 bg-rose-soft/5 p-5 text-sm">
            <p className="text-rose-soft font-medium mb-1">Attenzione</p>
            <p className="text-muted-foreground">
              Con questo ritmo, il tuo bilancio diventerebbe negativo tra circa{" "}
              <span className="text-foreground font-medium">{breakEvenMonth} mesi</span>.
              Rivedi abbonamenti o riduci le spese ricorrenti per invertire la rotta.
            </p>
          </div>
        ) : null}

        <p className="text-xs text-muted-foreground text-center">
          Stima indicativa basata sui tuoi dati. Non costituisce consulenza finanziaria.
        </p>
      </main>
    </div>
  );
}

function KpiCard({
  label,
  value,
  hint,
  icon,
  accentPositive,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: React.ReactNode;
  accentPositive?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-card p-5 space-y-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        {icon}
      </div>
      <div
        className={`font-display text-2xl font-extrabold ${
          accentPositive === undefined
            ? "text-foreground"
            : accentPositive
              ? "text-mint"
              : "text-rose-soft"
        }`}
      >
        {value}
      </div>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "mint" | "rose";
}) {
  return (
    <div className="rounded-xl bg-white/[0.02] border border-white/5 p-4">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={`font-display text-lg ${tone === "mint" ? "text-mint" : "text-foreground"}`}>
        {value}
      </p>
    </div>
  );
}