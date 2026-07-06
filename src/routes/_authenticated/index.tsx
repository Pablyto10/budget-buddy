import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import {
  Camera,
  Mic,
  Sparkles,
  TrendingUp,
  Target,
  Quote,
  LineChart as LineChartIcon,
  RefreshCw,
  ArrowUpRight,
  ArrowDownLeft,
  MoreHorizontal,
  Plus,
  CreditCard,
  Trash2,
  Loader2,
  Square,
  LogOut,
  Pencil,
  PiggyBank,
  ShieldAlert,
  UserCog,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useMemo, useRef, useState } from "react";
import { format, isToday, isYesterday } from "date-fns";
import { it } from "date-fns/locale";
import { toast } from "sonner";

import {
  parseReceipt,
  parseText,
  transcribeAudio,
  type ParsedTransaction,
} from "@/lib/ai-capture.functions";
import {
  getMotivationalQuote,
  getPersonalizedInsight,
} from "@/lib/ai-insights.functions";

import {
  useFinance,
  formatEUR,
  monthlyEquivalent,
  type Transaction,
} from "@/lib/finance-store";
import { AddTransactionDialog } from "@/components/AddTransactionDialog";
import logoAsset from "@/assets/wheres-my-budget-logo.png.asset.json";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Where's My Budget — Coach finanziario personale con AI" },
      {
        name: "description",
        content:
          "Where's My Budget è l'assistente finanziario intelligente che elimina il lavoro manuale. Fotografa uno scontrino, dì una frase: il tuo coach fa il resto.",
      },
      { property: "og:title", content: "Where's My Budget" },
      {
        property: "og:description",
        content:
          "Il tuo consulente finanziario personale, ogni giorno. Voce, foto, chat — zero moduli.",
      },
    ],
  }),
  component: Home,
});

// ---------- Component ----------

function Home() {
  const { transactions, subscriptions, goals } = useFinance();

  const subsMonthly = useMemo(
    () =>
      subscriptions
        .filter((s) => s.active)
        .reduce((sum, s) => sum + monthlyEquivalent(s), 0),
    [subscriptions],
  );

  // Bilancio attuale = entrate - uscite - spese ricorrenti (equivalente mensile)
  const totalBalance = useMemo(() => {
    const tx = transactions.reduce(
      (s, t) => s + (t.kind === "income" ? t.amount : -t.amount),
      0,
    );
    return tx - subsMonthly;
  }, [transactions, subsMonthly]);

  // Somme automatiche per Risparmio e Fondo Emergenza
  const savings = useMemo(() => {
    let risparmio = 0;
    let emergenza = 0;
    for (const t of transactions) {
      const sign = t.kind === "expense" ? 1 : -1;
      if (t.category === "Risparmio") risparmio += sign * t.amount;
      if (t.category === "Fondo emergenza") emergenza += sign * t.amount;
    }
    return { risparmio: Math.max(0, risparmio), emergenza: Math.max(0, emergenza) };
  }, [transactions]);

  // Aggregati del mese corrente
  const monthStats = useMemo(() => {
    const now = new Date();
    const inMonth = transactions.filter((t) => {
      const d = new Date(t.date);
      return (
        d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
      );
    });
    const income = inMonth
      .filter((t) => t.kind === "income")
      .reduce((s, t) => s + t.amount, 0);
    const expenses = inMonth
      .filter((t) => t.kind === "expense")
      .reduce((s, t) => s + t.amount, 0);
    const days = now.getDate();
    const burnRate = days > 0 ? expenses / days : 0;
    const net = income - expenses;
    return { income, expenses, net, burnRate };
  }, [transactions]);

  const featuredGoal = goals[0];

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-mint/30">
      <TopNav />

      <main className="mx-auto max-w-4xl px-6 py-8 space-y-8 pb-40">
        <CoachCard net={totalBalance} subsMonthly={subsMonthly} />
        <StatsGrid
          balance={totalBalance}
          income={monthStats.income}
          expenses={monthStats.expenses}
          burnRate={monthStats.burnRate}
          subsMonthly={subsMonthly}
          savings={savings.risparmio}
          emergency={savings.emergenza}
        />
        {featuredGoal ? <GoalPreview goal={featuredGoal} /> : null}
        <RecentActivity />
        <InsightGrid />
      </main>

      <CaptureBar />
    </div>
  );
}

function GoalPreview({ goal }: { goal: NonNullable<ReturnType<typeof useFinance>["goals"][number]> }) {
  const remaining = Math.max(0, goal.targetAmount - goal.savedAmount);
  const progress = goal.targetAmount > 0
    ? Math.min(100, Math.round((goal.savedAmount / goal.targetAmount) * 100))
    : 0;

  return (
    <Link
      to="/goals"
      className="block group rounded-2xl border border-border bg-card overflow-hidden transition-colors hover:border-mint/30"
    >
      {goal.imageUrl ? (
        <div className="relative">
          <img
            src={goal.imageUrl}
            alt={goal.title}
            className="w-full h-48 object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-5 flex items-end justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.18em] text-mint mb-1">
                Il tuo obiettivo
              </p>
              <h3 className="font-display text-xl truncate">{goal.title}</h3>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Sei al
              </p>
              <p className="font-display text-2xl text-mint">{progress}%</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-5 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.18em] text-mint mb-1">
              Il tuo obiettivo
            </p>
            <h3 className="font-display text-xl truncate">{goal.title}</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Ti manca {formatEUR(remaining)} per raggiungerlo.
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Sei al
            </p>
            <p className="font-display text-3xl text-mint">{progress}%</p>
          </div>
        </div>
      )}
    </Link>
  );
}


function TopNav() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }
  return (
    <nav className="sticky top-0 z-40 flex items-center justify-between px-6 py-4 border-b border-white/5 bg-background/80 backdrop-blur-xl">
      <div className="flex items-center gap-2.5">
        <img
          src={logoAsset.url}
          alt="Where's My Budget"
          className="size-8 rounded-lg object-cover"
        />
        <span className="font-display text-lg tracking-tight">Where's My Budget</span>
      </div>
      <div className="flex items-center gap-2">
        <Link
          to="/goals"
          className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-white/10 transition-colors"
        >
          <Target className="size-3.5" />
          <span className="hidden sm:inline">Obiettivi</span>
        </Link>
        <Link
          to="/subscriptions"
          className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-white/10 transition-colors"
        >
          <CreditCard className="size-3.5" />
          <span className="hidden sm:inline">Spese ricorrenti</span>
        </Link>
        <Link
          to="/credit-card"
          className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-white/10 transition-colors"
        >
          <CreditCard className="size-3.5" />
          <span className="hidden sm:inline">Carta di credito</span>
        </Link>
        <Link
          to="/forecast"
          className="inline-flex items-center gap-1.5 rounded-full border border-mint/30 bg-mint/10 px-3 py-1.5 text-xs font-medium text-mint hover:bg-mint/20 transition-colors"
        >
          <LineChartIcon className="size-3.5" />
          <span className="hidden sm:inline">Forecast</span>
        </Link>
        <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-mint/10 border border-mint/20">
          <span className="size-1.5 rounded-full bg-mint animate-pulse" />
          <span className="text-mint text-xs font-medium">AI online</span>
        </div>
        <Link
          to="/account"
          className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-white/10 transition-colors"
          aria-label="Account"
        >
          <UserCog className="size-3.5" />
          <span className="hidden sm:inline">Account</span>
        </Link>
        <button
          onClick={handleSignOut}
          className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-white/10 transition-colors"
          aria-label="Esci"
        >
          <LogOut className="size-3.5" />
          <span className="hidden sm:inline">Esci</span>
        </button>
      </div>
    </nav>
  );
}

function CoachCard({
  net,
  subsMonthly,
}: {
  net: number;
  subsMonthly: number;
}) {
  const positive = net >= 0;
  const headline = positive
    ? `Il tuo bilancio attuale è di ${formatEUR(net)}.`
    : `Sei in negativo di ${formatEUR(Math.abs(net))}.`;
  const highlight = formatEUR(Math.abs(net));

  return (
    <section className="relative overflow-hidden rounded-3xl border border-white/[0.06] hero-gradient p-8 animate-fade-up shadow-[0_30px_80px_-40px_rgba(0,0,0,0.9)]">
      {/* Abstract growing line */}
      <svg
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full opacity-70"
        viewBox="0 0 800 300"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="hero-line" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#22C55E" stopOpacity="0" />
            <stop offset="50%" stopColor="#22C55E" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#10B981" stopOpacity="0.9" />
          </linearGradient>
        </defs>
        <path
          d="M0,220 C160,210 260,180 380,150 C520,115 620,80 800,40"
          fill="none"
          stroke="url(#hero-line)"
          strokeWidth="1.5"
          strokeDasharray="400"
          style={{ animation: "hero-line 2.4s cubic-bezier(0.16,1,0.3,1) both" }}
        />
      </svg>
      {/* Twinkles */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        {[
          { top: "18%", left: "72%", d: "0s" },
          { top: "40%", left: "88%", d: "0.6s" },
          { top: "68%", left: "62%", d: "1.2s" },
          { top: "28%", left: "45%", d: "1.8s" },
        ].map((p, i) => (
          <span
            key={i}
            className="absolute size-[3px] rounded-full bg-mint"
            style={{
              top: p.top,
              left: p.left,
              animation: `twinkle 3.2s ease-in-out ${p.d} infinite`,
              boxShadow: "0 0 12px rgba(34,197,94,0.7)",
            }}
          />
        ))}
      </div>
      <div className="relative z-10 flex flex-col gap-5">
        <div className="flex items-center gap-2.5 text-mint">
          <span className="size-2 rounded-full bg-mint animate-pulse" />
          <span className="text-xs font-medium uppercase tracking-[0.18em]">
            Il tuo coach, oggi
          </span>
        </div>
        <h1 className="font-display text-3xl leading-[1.15] md:text-4xl md:leading-[1.1] max-w-2xl">
          "{headline.split(highlight)[0]}
          <span className={positive ? "text-mint glow-mint" : "text-rose-soft"}>
            {highlight}
          </span>
          {headline.split(highlight)[1] ?? ""}"
        </h1>
        <p className="max-w-xl text-lg text-muted-foreground leading-relaxed">
          Le tue spese ricorrenti attive pesano {formatEUR(subsMonthly)}/mese
          ({formatEUR(subsMonthly * 12)} l'anno). Rivedile per liberare
          spazio di risparmio.
        </p>
        <div className="flex flex-wrap gap-3 mt-2">
          <AddTransactionDialog
            trigger={
              <button className="btn-primary-premium inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold">
                <Plus className="size-4" strokeWidth={2.5} />
                Aggiungi movimento
              </button>
            }
          />
          <Link
            to="/subscriptions"
            className="btn-secondary-premium inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold"
          >
            Gestisci spese ricorrenti
            <ArrowUpRight className="size-4" strokeWidth={2.5} />
          </Link>
        </div>
      </div>
      <div
        className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-mint/25 blur-[110px]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -left-24 bottom-[-30%] size-72 rounded-full bg-sky-soft/10 blur-[120px]"
        aria-hidden
      />
    </section>
  );
}

function StatsGrid({
  balance,
  income,
  expenses,
  burnRate,
  subsMonthly,
  savings,
  emergency,
}: {
  balance: number;
  income: number;
  expenses: number;
  burnRate: number;
  subsMonthly: number;
  savings: number;
  emergency: number;
}) {
  const stats = [
    {
      label: "Bilancio attuale",
      value: formatEUR(balance),
      delta: balance >= 0 ? "in positivo" : "in negativo",
      positive: balance >= 0,
      micro: "ring" as const,
      icon: null as null | React.ReactNode,
      to: "/transactions" as const,
      search: {} as Record<string, string>,
      accent: "" as string,
    },
    {
      label: "Risparmio",
      value: formatEUR(savings),
      delta: "accantonato",
      positive: true,
      micro: "bar" as const,
      icon: <PiggyBank className="size-4 text-info" /> as React.ReactNode,
      to: "/transactions" as const,
      search: { category: "Risparmio" },
      accent: "cat-subscription",
    },
    {
      label: "Fondo emergenza",
      value: formatEUR(emergency),
      delta: "riserva",
      positive: true,
      micro: "bar" as const,
      icon: <ShieldAlert className="size-4 text-info" /> as React.ReactNode,
      to: "/transactions" as const,
      search: { category: "Fondo emergenza" },
      accent: "cat-subscription",
    },
    {
      label: "Entrate del mese",
      value: formatEUR(income),
      delta: "questo mese",
      positive: true,
      micro: "bar" as const,
      icon: null,
      to: "/transactions" as const,
      search: { kind: "income", month: "current" },
      accent: "cat-income",
    },
    {
      label: "Uscite del mese",
      value: formatEUR(expenses),
      delta: `${formatEUR(burnRate)}/giorno`,
      positive: false,
      micro: "spark" as const,
      icon: null,
      to: "/transactions" as const,
      search: { kind: "expense", month: "current" },
      accent: "cat-expense",
    },
    {
      label: "Spese ricorrenti",
      value: formatEUR(subsMonthly),
      delta: "al mese",
      positive: true,
      micro: "ring" as const,
      icon: null,
      to: "/subscriptions" as const,
      search: {} as Record<string, string>,
      accent: "cat-savings",
    },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">

      {stats.map((s) => (
        <Link
          key={s.label}
          to={s.to}
          search={s.search as never}
          className={`premium-card premium-card-hover ${s.accent} block rounded-2xl p-5 sm:p-6 space-y-3 focus:outline-none focus:ring-1 focus:ring-mint min-w-0`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1.5 min-w-0 truncate">
              {s.icon}
              <span className="truncate">{s.label}</span>
            </span>
            <MoreHorizontal className="size-4 text-muted-foreground/60 shrink-0" />
          </div>
          <div className="flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-2 min-w-0">
            <span className={`font-display text-xl sm:text-2xl font-extrabold truncate ${s.positive && s.label !== "Uscite del mese" ? "text-foreground" : ""}`}>{s.value}</span>
            <span
              className={
                (s.positive ? "text-xs text-mint" : "text-xs text-muted-foreground") + " truncate"
              }
            >
              {s.delta}
            </span>
          </div>
          <StatMicroViz kind={s.micro} />
        </Link>
      ))}
    </div>
  );
}

function StatMicroViz({ kind }: { kind: "bar" | "spark" | "ring" }) {
  if (kind === "bar") {
    return (
      <div className="w-full h-1 rounded-full bg-white/5 overflow-hidden">
        <div className="h-full w-3/4 bg-mint" />
      </div>
    );
  }
  if (kind === "spark") {
    return (
      <div className="flex gap-1 pt-1">
        {[10, 20, 40, 100, 60].map((h, i) => (
          <div
            key={i}
            className={`h-4 flex-1 rounded-sm ${
              h >= 100 ? "bg-mint" : h >= 60 ? "bg-mint/40" : "bg-white/5"
            }`}
          />
        ))}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3">
      <div className="relative size-8">
        <svg className="size-8 -rotate-90" viewBox="0 0 36 36">
          <circle
            cx="18"
            cy="18"
            r="15"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            className="text-white/10"
          />
          <circle
            cx="18"
            cy="18"
            r="15"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeDasharray={`${(78 / 100) * 94.25} 94.25`}
            strokeLinecap="round"
            className="text-mint"
          />
        </svg>
      </div>
      <Target className="size-4 text-mint" />
    </div>
  );
}

function relativeDate(iso: string) {
  const d = new Date(iso);
  if (isToday(d)) return `Oggi, ${format(d, "HH:mm")}`;
  if (isYesterday(d)) return "Ieri";
  return format(d, "d MMM", { locale: it });
}

function sourceLabel(source: Transaction["source"]) {
  switch (source) {
    case "manual":
      return "Manuale";
    case "voice":
      return "Voce";
    case "photo":
      return "Foto";
    case "sync":
      return "Sync banca";
    default:
      return "";
  }
}

function RecentActivity() {
  const { transactions, removeTransaction } = useFinance();
  const recent = transactions.slice(0, 6);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg">Attività recente</h2>
        <div className="flex items-center gap-2">
          <AddTransactionDialog
            defaultKind="income"
            trigger={
              <button className="inline-flex items-center gap-1 rounded-full border border-mint/20 bg-mint/10 px-3 py-1 text-xs font-medium text-mint hover:bg-mint/20 transition-colors">
                <ArrowUpRight className="size-3" />
                Entrata
              </button>
            }
          />
          <AddTransactionDialog
            defaultKind="expense"
            trigger={
              <button className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-foreground hover:bg-white/10 transition-colors">
                <ArrowDownLeft className="size-3" />
                Spesa
              </button>
            }
          />
          <Link
            to="/transactions"
            className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-foreground hover:bg-white/10 transition-colors"
          >
            Vedi tutti
            <ArrowUpRight className="size-3" />
          </Link>
        </div>
      </div>

      {recent.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-muted-foreground">
          Nessun movimento. Aggiungi la tua prima entrata o spesa.
        </div>
      ) : (
        <div className="space-y-3">
          {recent.map((t) => (
            <div
              key={t.id}
              className="group flex items-center justify-between rounded-xl border border-border bg-card p-4 transition-colors hover:border-mint/20"
            >
              <div className="flex items-center gap-4 min-w-0">
                <div
                  className={`size-10 rounded-full grid place-items-center italic font-display transition-colors ${
                    t.kind === "income"
                      ? "bg-mint/10 text-mint border border-mint/20"
                      : "bg-white/5 text-muted-foreground border border-white/5 group-hover:text-mint"
                  }`}
                >
                  {t.merchant.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="font-medium truncate">{t.merchant}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {t.category} · {relativeDate(t.date)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right">
                  <p
                    className={`font-display ${
                      t.kind === "income" ? "text-mint" : ""
                    }`}
                  >
                    {t.kind === "income" ? "+" : "-"}
                    {formatEUR(t.amount)}
                  </p>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60">
                    {sourceLabel(t.source)}
                  </p>
                </div>
                <AddTransactionDialog
                  transaction={t}
                  trigger={
                    <button
                      aria-label="Modifica movimento"
                      className="p-2 rounded-lg text-muted-foreground hover:text-mint hover:bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Pencil className="size-4" />
                    </button>
                  }
                />
                <button
                  onClick={() => removeTransaction(t.id)}
                  aria-label="Elimina movimento"
                  className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ---------- Insight & Quote cards (AI-powered) ----------

type Insight = Awaited<ReturnType<typeof getPersonalizedInsight>>;
type MotivationalQuote = Awaited<ReturnType<typeof getMotivationalQuote>>;

function InsightGrid() {
  return (
    <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <PersonalInsightCard />
      <QuoteCard />
    </section>
  );
}

function PersonalInsightCard() {
  const { transactions, subscriptions, goals } = useFinance();
  const insightFn = useServerFn(getPersonalizedInsight);
  const [data, setData] = useState<Insight | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Prepara payload leggero e stabile (evita loop su ogni render)
  const payload = useMemo(() => {
    const subsMonthly = subscriptions
      .filter((s) => s.active)
      .reduce((sum, s) => sum + monthlyEquivalent(s), 0);
    return {
      transactions: transactions.slice(0, 60).map((t) => ({
        kind: t.kind,
        amount: t.amount,
        merchant: t.merchant,
        category: t.category,
        date: t.date,
      })),
      goals: goals.map((g) => ({
        title: g.title,
        targetAmount: g.targetAmount,
        savedAmount: g.savedAmount,
        deadline: g.deadline,
      })),
      monthlySubscriptions: subsMonthly,
    };
  }, [transactions, subscriptions, goals]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await insightFn({ data: payload });
      setData(res);
    } catch (err) {
      console.error(err);
      setError("Non sono riuscito a generare il consiglio. Riprova.");
    } finally {
      setLoading(false);
    }
  }

  // Carica quando ci sono almeno alcune transazioni
  useEffect(() => {
    if (payload.transactions.length === 0) {
      setLoading(false);
      return;
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload.transactions.length, payload.goals.length]);

  return (
    <div className="rounded-3xl border border-white/5 bg-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="size-10 rounded-full grid place-items-center bg-sky-soft/10 text-sky-soft">
          <TrendingUp className="size-5" strokeWidth={2} />
        </div>
        <button
          onClick={load}
          disabled={loading}
          aria-label="Ricarica consiglio"
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCw className="size-4" />
          )}
        </button>
      </div>

      {loading && !data ? (
        <div className="space-y-3">
          <div className="h-6 w-3/4 rounded bg-white/5 animate-pulse" />
          <div className="h-4 w-full rounded bg-white/5 animate-pulse" />
          <div className="h-4 w-5/6 rounded bg-white/5 animate-pulse" />
        </div>
      ) : error ? (
        <div className="space-y-2">
          <h3 className="font-display text-lg">Consiglio non disponibile</h3>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      ) : !data ? (
        <div className="space-y-2">
          <h3 className="font-display text-xl italic leading-tight">
            "Aggiungi qualche spesa per ricevere il primo consiglio."
          </h3>
          <p className="text-sm text-muted-foreground">
            Più dati ha il coach, più preciso sarà il suggerimento.
          </p>
        </div>
      ) : (
        <>
          <h3 className="font-display text-xl italic leading-tight">
            "{data.headline}"
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {data.body}
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {typeof data.savingEstimate === "number" && data.savingEstimate > 0 ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-mint/10 border border-mint/20 px-3 py-1 text-xs text-mint">
                <Sparkles className="size-3" />
                Risparmio stimato {formatEUR(data.savingEstimate)}/mese
              </span>
            ) : null}
            {data.linkedGoal ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/5 border border-white/10 px-3 py-1 text-xs text-foreground">
                <Target className="size-3" />
                Obiettivo: {data.linkedGoal}
              </span>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}

function QuoteCard() {
  const quoteFn = useServerFn(getMotivationalQuote);
  const [data, setData] = useState<MotivationalQuote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await quoteFn({ data: { seed: Date.now().toString() } });
      setData(res);
    } catch (err) {
      console.error(err);
      setError("Nessuna citazione al momento. Riprova.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="rounded-3xl border border-white/5 bg-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="size-10 rounded-full grid place-items-center bg-amber-soft/10 text-amber-soft">
          <Quote className="size-5" strokeWidth={2} />
        </div>
        <button
          onClick={load}
          disabled={loading}
          aria-label="Nuova citazione"
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCw className="size-4" />
          )}
        </button>
      </div>
      {loading && !data ? (
        <div className="space-y-3">
          <div className="h-6 w-4/5 rounded bg-white/5 animate-pulse" />
          <div className="h-4 w-2/3 rounded bg-white/5 animate-pulse" />
        </div>
      ) : error ? (
        <p className="text-sm text-muted-foreground">{error}</p>
      ) : data ? (
        <>
          <h3 className="font-display text-xl italic leading-tight">
            "{data.quote}"
          </h3>
          <p className="text-xs uppercase tracking-[0.18em] text-mint">
            — {data.author}
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {data.reflection}
          </p>
        </>
      ) : null}
    </div>
  );
}

function CaptureBar() {
  const { addTransaction } = useFinance();
  const parseTextFn = useServerFn(parseText);
  const parseReceiptFn = useServerFn(parseReceipt);
  const transcribeFn = useServerFn(transcribeAudio);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const [busy, setBusy] = useState<null | "photo" | "voice" | "text">(null);
  const [recording, setRecording] = useState(false);

  function commit(tx: ParsedTransaction, source: "photo" | "voice" | "manual") {
    addTransaction({
      kind: tx.kind,
      amount: tx.amount,
      merchant: tx.merchant,
      category: tx.category,
      note: tx.note,
      date: tx.date ?? new Date().toISOString(),
      source,
    });
    toast.success(
      `${tx.kind === "income" ? "Entrata" : "Spesa"} aggiunta: ${tx.merchant}`,
    );
  }

  async function handleQuickAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const input = form.elements.namedItem("quick") as HTMLInputElement;
    const value = input.value.trim();
    if (!value) return;
    setBusy("text");
    try {
      const { transaction } = await parseTextFn({ data: { text: value } });
      commit(transaction, "manual");
      input.value = "";
    } catch (err) {
      console.error(err);
      toast.error("Non sono riuscito a interpretare la frase.");
    } finally {
      setBusy(null);
    }
  }

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // consenti re-upload stesso file
    if (!file) return;
    setBusy("photo");
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      const { transaction } = await parseReceiptFn({
        data: { imageDataUrl: dataUrl },
      });
      commit(transaction, "photo");
    } catch (err) {
      console.error(err);
      toast.error("Non sono riuscito a leggere lo scontrino.");
    } finally {
      setBusy(null);
    }
  }

  async function startRecording() {
    // getUserMedia deve essere invocato in modo sincrono dal click handler.
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      // Scegli il MIME migliore per il browser corrente.
      const candidates = ["audio/webm", "audio/mp4", "audio/ogg"];
      const mime = candidates.find((m) =>
        typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m),
      );
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      audioChunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) audioChunksRef.current.push(ev.data);
      };
      recorder.onstop = async () => {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        const blob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        setRecording(false);
        if (blob.size < 2048) {
          toast.error("Registrazione troppo breve, riprova.");
          return;
        }
        setBusy("voice");
        try {
          const buf = new Uint8Array(await blob.arrayBuffer());
          let bin = "";
          for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
          const base64 = btoa(bin);
          const { transaction } = await transcribeFn({
            data: { audioBase64: base64, mimeType: blob.type },
          });
          commit(transaction, "voice");
        } catch (err) {
          console.error(err);
          toast.error("Trascrizione fallita. Riprova o usa il testo.");
        } finally {
          setBusy(null);
        }
      };
      mediaRecorderRef.current = recorder;
      recorder.start(); // segmento singolo, ferma su stop() per un file completo
      setRecording(true);
    } catch (err) {
      const name = (err as { name?: string })?.name;
      if (name === "NotAllowedError") {
        toast.error("Permesso microfono negato. Abilita il microfono nelle impostazioni.");
      } else if (name === "NotFoundError") {
        toast.error("Nessun microfono trovato.");
      } else {
        console.error(err);
        toast.error("Impossibile avviare la registrazione.");
      }
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
  }

  const submitting = busy === "text";

  return (
    <div className="fixed bottom-6 inset-x-4 md:inset-x-0 z-50 pointer-events-none">
      <div className="pointer-events-auto mx-auto max-w-2xl">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handlePhoto}
        />
        <form
          onSubmit={handleQuickAdd}
          className="flex items-center gap-2 rounded-2xl border border-white/10 bg-card-elevated/80 p-2 shadow-2xl shadow-black/50 backdrop-blur-xl"
        >
          <AddTransactionDialog
            trigger={
              <button
                type="button"
                aria-label="Aggiungi manualmente"
                className="p-3 text-muted-foreground transition-colors hover:text-foreground"
              >
                <Plus className="size-5" strokeWidth={2} />
              </button>
            }
          />
          <button
            type="button"
            aria-label="Fotografa scontrino"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy !== null || recording}
            className="p-3 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
          >
            {busy === "photo" ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <Camera className="size-5" strokeWidth={1.8} />
            )}
          </button>
          <input
            name="quick"
            type="text"
            placeholder={
              recording
                ? "🔴 Sto ascoltando… premi Stop quando hai finito"
                : "Dì o scrivi: 'ho speso 40 al ristorante'…"
            }
            disabled={recording || busy !== null}
            className="flex-1 min-w-0 bg-transparent border-none outline-none py-2 px-2 text-sm placeholder:text-muted-foreground/70 disabled:opacity-70"
          />
          <button
            type={recording ? "button" : "submit"}
            onClick={
              recording
                ? stopRecording
                : busy === null
                  ? (e) => {
                      // Se l'input testuale è vuoto, avvia la registrazione.
                      const form = (e.currentTarget as HTMLButtonElement).form;
                      const val =
                        (form?.elements.namedItem("quick") as HTMLInputElement)
                          ?.value ?? "";
                      if (!val.trim()) {
                        e.preventDefault();
                        void startRecording();
                      }
                    }
                  : undefined
            }
            disabled={busy !== null && !recording}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-transform hover:scale-[1.02] disabled:opacity-60 ${
              recording
                ? "bg-destructive text-destructive-foreground"
                : "bg-mint text-mint-foreground"
            }`}
          >
            {recording ? (
              <>
                <Square className="size-4" strokeWidth={2.5} />
                <span className="hidden sm:inline">Stop</span>
              </>
            ) : submitting || busy === "voice" ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                <span className="hidden sm:inline">Elaboro…</span>
              </>
            ) : (
              <>
                <Mic className="size-4" strokeWidth={2.5} />
                <span className="hidden sm:inline">Registra</span>
              </>
            )}
          </button>
        </form>
        <p className="mt-2 text-center text-[11px] text-muted-foreground/60">
          <Sparkles className="inline size-3 -mt-0.5 mr-1" />
          Tocca + per entrate/spese, foto per scontrini, mic per la voce
        </p>
      </div>
    </div>
  );
}
