import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Loader2,
  Plus,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { format, differenceInMonths } from "date-fns";
import { it } from "date-fns/locale";

import {
  formatEUR,
  monthlyEquivalent,
  useFinance,
  type Goal,
} from "@/lib/finance-store";
import { GoalDialog } from "@/components/GoalDialog";
import { getGoalPlan } from "@/lib/ai-insights.functions";

export const Route = createFileRoute("/_authenticated/goals")({
  head: () => ({
    meta: [
      { title: "Obiettivi — Where's My Budget" },
      {
        name: "description",
        content:
          "Imposta obiettivi finanziari e lascia che il coach AI calcoli quanto risparmiare ogni mese per raggiungerli.",
      },
    ],
  }),
  component: GoalsPage,
});

function GoalsPage() {
  const { goals, transactions, subscriptions, removeGoal, updateGoal, addTransaction } =
    useFinance();

  // Aggregati economici (mese corrente)
  const finance = useMemo(() => {
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
    const subsMonthly = subscriptions
      .filter((s) => s.active)
      .reduce((sum, s) => sum + monthlyEquivalent(s), 0);
    // Top 3 categorie per spesa
    const byCat = new Map<string, number>();
    inMonth
      .filter((t) => t.kind === "expense")
      .forEach((t) => byCat.set(t.category, (byCat.get(t.category) ?? 0) + t.amount));
    const topCategories = Array.from(byCat.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 3);
    return { income, expenses, subsMonthly, topCategories };
  }, [transactions, subscriptions]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="sticky top-0 z-40 flex items-center justify-between px-6 py-4 border-b border-white/5 bg-background/80 backdrop-blur-xl">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Home
        </Link>
        <div className="flex items-center gap-2.5">
          <Target className="size-5 text-mint" />
          <span className="font-display text-lg tracking-tight">Obiettivi</span>
        </div>
        <GoalDialog
          trigger={
            <button className="inline-flex items-center gap-1.5 rounded-full bg-mint px-3 py-1.5 text-xs font-semibold text-mint-foreground hover:scale-[1.02] transition-transform">
              <Plus className="size-3.5" strokeWidth={2.5} />
              Nuovo
            </button>
          }
        />
      </nav>

      <main className="mx-auto max-w-4xl px-6 py-8 space-y-8 pb-24">
        {goals.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {goals.map((g) => (
              <GoalCard
                key={g.id}
                goal={g}
                finance={finance}
                onDelete={() => {
                  removeGoal(g.id);
                  toast.success("Obiettivo eliminato");
                }}
                onUpdate={updateGoal}
                onSetAside={(amount) => {
                  void addTransaction({
                    kind: "expense",
                    amount,
                    merchant: `Accantonamento: ${g.title}`,
                    category: "Risparmio",
                    date: new Date().toISOString(),
                    source: "manual",
                  });
                }}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-3xl border border-dashed border-white/10 p-12 text-center space-y-4">
      <div className="mx-auto size-14 rounded-full bg-mint/10 grid place-items-center">
        <Target className="size-7 text-mint" />
      </div>
      <h2 className="font-display text-2xl">Nessun obiettivo ancora</h2>
      <p className="max-w-md mx-auto text-sm text-muted-foreground">
        Crea il primo obiettivo: viaggio, casa, fondo di emergenza. Il coach
        calcolerà il piano mensile in base alle tue spese.
      </p>
      <GoalDialog
        trigger={
          <button className="inline-flex items-center gap-2 rounded-xl bg-mint px-5 py-2.5 text-sm font-semibold text-mint-foreground hover:scale-[1.02] transition-transform">
            <Plus className="size-4" strokeWidth={2.5} />
            Crea obiettivo
          </button>
        }
      />
    </div>
  );
}

type FinanceCtx = {
  income: number;
  expenses: number;
  subsMonthly: number;
  topCategories: { category: string; amount: number }[];
};

type Plan = Awaited<ReturnType<typeof getGoalPlan>>;

function GoalCard({
  goal,
  finance,
  onDelete,
  onUpdate,
  onSetAside,
}: {
  goal: Goal;
  finance: FinanceCtx;
  onDelete: () => void;
  onUpdate: (id: string, patch: Partial<Goal>) => void;
  onSetAside: (amount: number) => void;
}) {
  const planFn = useServerFn(getGoalPlan);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(false);

  const monthsLeft = Math.max(
    1,
    differenceInMonths(new Date(goal.deadline), new Date()) + 1,
  );
  const remaining = Math.max(0, goal.targetAmount - goal.savedAmount);
  const monthlyRequired = remaining / monthsLeft;
  const progress = Math.min(100, (goal.savedAmount / goal.targetAmount) * 100);

  async function askPlan() {
    setLoading(true);
    try {
      const p = await planFn({
        data: {
          goal: {
            title: goal.title,
            targetAmount: goal.targetAmount,
            savedAmount: goal.savedAmount,
            deadline: goal.deadline,
          },
          monthlyIncome: finance.income,
          monthlyExpenses: finance.expenses,
          monthlySubscriptions: finance.subsMonthly,
          topCategories: finance.topCategories,
        },
      });
      setPlan(p);
    } catch (err) {
      console.error(err);
      toast.error("Non sono riuscito a generare il piano.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-3xl border border-white/5 bg-card overflow-hidden">
      {goal.imageUrl ? (
        <div className="relative h-40 w-full overflow-hidden">
          <img
            src={goal.imageUrl}
            alt={goal.title}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-card via-card/40 to-transparent" />
        </div>
      ) : (
        <div className="h-24 bg-gradient-to-br from-mint/20 via-accent/40 to-transparent" />
      )}
      <div className="p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-xl">{goal.title}</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Entro il {format(new Date(goal.deadline), "d MMM yyyy", { locale: it })}
              {" · "}
              {monthsLeft} {monthsLeft === 1 ? "mese" : "mesi"}
            </p>
          </div>
          <button
            onClick={onDelete}
            aria-label="Elimina obiettivo"
            className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-white/5"
          >
            <Trash2 className="size-4" />
          </button>
        </div>

        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <span className="font-display text-2xl">
              {formatEUR(goal.savedAmount)}
              <span className="text-sm text-muted-foreground font-sans">
                {" "}
                / {formatEUR(goal.targetAmount)}
              </span>
            </span>
            <span className="text-xs text-mint font-medium">
              {progress.toFixed(0)}%
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
            <div
              className="h-full bg-mint transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="rounded-xl bg-white/5 border border-white/5 p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
            Target mensile
          </p>
          <p className="font-display text-xl text-mint">
            {formatEUR(monthlyRequired)}
            <span className="text-sm text-muted-foreground font-sans"> /mese</span>
          </p>
        </div>

        {plan ? (
          <div className="space-y-3 rounded-xl border border-mint/20 bg-mint/5 p-4">
            <div className="flex items-center gap-2 text-mint">
              <Sparkles className="size-4" />
              <span className="text-xs font-medium uppercase tracking-wider">
                Piano del coach
              </span>
            </div>
            <p className="font-display text-base leading-snug">{plan.headline}</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {plan.body}
            </p>
            {plan.cuts.length > 0 && (
              <ul className="space-y-2 pt-1">
                {plan.cuts.map((c, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2 text-sm text-foreground"
                  >
                    <TrendingUp className="size-4 text-mint mt-0.5 shrink-0" />
                    <span>
                      <strong>{c.area}</strong> — risparmi {formatEUR(c.amount)}/mese.
                      <span className="text-muted-foreground"> {c.rationale}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}

        <div className="flex gap-2">
          <button
            onClick={askPlan}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl bg-mint px-4 py-2 text-sm font-semibold text-mint-foreground hover:scale-[1.02] transition-transform disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Calcolo…
              </>
            ) : (
              <>
                <Sparkles className="size-4" />
                {plan ? "Ricalcola piano" : "Chiedi al coach"}
              </>
            )}
          </button>
          <button
            onClick={() => {
              const val = prompt("Aggiungi al risparmio (€):", "");
              if (!val) return;
              const n = parseFloat(val.replace(",", "."));
              if (!isFinite(n) || n <= 0) return;
              onUpdate(goal.id, { savedAmount: goal.savedAmount + n });
              onSetAside(n);
              toast.success(`+${formatEUR(n)} accantonati`);
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-foreground hover:bg-white/10 transition-colors"
          >
            <Plus className="size-4" />
            Accantona
          </button>
        </div>
      </div>
    </div>
  );
}
