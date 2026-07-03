import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Plus,
  ArrowLeft,
  AlertCircle,
  CalendarClock,
  Pause,
  Play,
  Trash2,
  Pencil,
  Sparkles,
} from "lucide-react";
import { useMemo } from "react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { toast } from "sonner";

import {
  useFinance,
  formatEUR,
  monthlyEquivalent,
  daysUntil,
  type Subscription,
} from "@/lib/finance-store";
import { SubscriptionDialog } from "@/components/SubscriptionDialog";

export const Route = createFileRoute("/_authenticated/subscriptions")({
  head: () => ({
    meta: [
      { title: "Abbonamenti — Money Coach AI" },
      {
        name: "description",
        content:
          "Monitora e gestisci tutti i tuoi abbonamenti: importi, date di rinnovo, costo mensile equivalente e suggerimenti AI per risparmiare.",
      },
      { property: "og:title", content: "Abbonamenti — Money Coach AI" },
      {
        property: "og:description",
        content:
          "Un solo posto per vedere quanto ti costano davvero i tuoi abbonamenti — e cosa cancellare.",
      },
    ],
  }),
  component: SubscriptionsPage,
});

function SubscriptionsPage() {
  const { subscriptions } = useFinance();

  const sorted = useMemo(
    () =>
      [...subscriptions].sort(
        (a, b) =>
          new Date(a.nextRenewal).getTime() - new Date(b.nextRenewal).getTime(),
      ),
    [subscriptions],
  );

  const active = sorted.filter((s) => s.active);
  const paused = sorted.filter((s) => !s.active);

  const monthlyTotal = active.reduce((sum, s) => sum + monthlyEquivalent(s), 0);
  const yearlyTotal = monthlyTotal * 12;
  const upcoming = active.filter((s) => daysUntil(s.nextRenewal) <= 7);
  const wasted = paused.reduce((sum, s) => sum + monthlyEquivalent(s), 0);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="sticky top-0 z-40 flex items-center justify-between px-6 py-4 border-b border-white/5 bg-background/80 backdrop-blur-xl">
        <Link
          to="/"
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          Home
        </Link>
        <span className="font-display text-lg">Abbonamenti</span>
        <SubscriptionDialog
          trigger={
            <button
              aria-label="Aggiungi abbonamento"
              className="inline-flex items-center gap-1.5 rounded-full bg-mint px-3 py-1.5 text-xs font-semibold text-mint-foreground hover:scale-[1.03] transition-transform"
            >
              <Plus className="size-3.5" strokeWidth={2.5} />
              Nuovo
            </button>
          }
        />
      </nav>

      <main className="mx-auto max-w-4xl px-6 py-8 space-y-8 pb-24">
        {/* Summary */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <SummaryCard
            label="Costo mensile"
            value={formatEUR(monthlyTotal)}
            sub={`${active.length} attivi`}
            accent
          />
          <SummaryCard
            label="Costo annuale"
            value={formatEUR(yearlyTotal)}
            sub="stimato"
          />
          <SummaryCard
            label="In scadenza"
            value={String(upcoming.length)}
            sub="entro 7 giorni"
          />
          <SummaryCard
            label="Silenti"
            value={formatEUR(wasted)}
            sub={`${paused.length} in pausa`}
            warning={paused.length > 0}
          />
        </section>

        {/* AI insight */}
        {paused.length > 0 && (
          <section className="flex items-start gap-4 rounded-3xl border border-amber-soft/20 bg-amber-soft/5 p-5">
            <div className="size-10 shrink-0 rounded-full bg-amber-soft/10 grid place-items-center text-amber-soft">
              <Sparkles className="size-5" />
            </div>
            <div className="space-y-1">
              <h3 className="font-display italic text-lg leading-tight">
                "Hai {paused.length} abbonament{paused.length === 1 ? "o" : "i"} in pausa che ti costa{paused.length === 1 ? "" : "no"} {formatEUR(wasted)}/mese."
              </h3>
              <p className="text-sm text-muted-foreground">
                Cancellandoli risparmieresti {formatEUR(wasted * 12)} in un anno.
              </p>
            </div>
          </section>
        )}

        {/* Active list */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg">Attivi</h2>
            <span className="text-xs text-muted-foreground">
              {active.length} abbonament{active.length === 1 ? "o" : "i"}
            </span>
          </div>

          {active.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="space-y-2">
              {active.map((s) => (
                <SubscriptionRow key={s.id} sub={s} />
              ))}
            </div>
          )}
        </section>

        {/* Paused */}
        {paused.length > 0 && (
          <section className="space-y-3">
            <h2 className="font-display text-lg text-muted-foreground">In pausa</h2>
            <div className="space-y-2">
              {paused.map((s) => (
                <SubscriptionRow key={s.id} sub={s} />
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  sub,
  accent,
  warning,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
  warning?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 space-y-1 ${
        accent
          ? "border-mint/20 bg-mint/5"
          : warning
            ? "border-amber-soft/20 bg-amber-soft/5"
            : "border-border bg-card"
      }`}
    >
      <p className="text-xs text-muted-foreground uppercase tracking-wider">
        {label}
      </p>
      <p className={`font-display text-xl ${accent ? "text-mint" : ""}`}>{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function SubscriptionRow({ sub }: { sub: Subscription }) {
  const { updateSubscription, removeSubscription } = useFinance();
  const days = daysUntil(sub.nextRenewal);
  const soon = sub.active && days <= 7;
  const monthly = monthlyEquivalent(sub);

  const cycleLabel =
    sub.cycle === "monthly"
      ? "/mese"
      : sub.cycle === "yearly"
        ? "/anno"
        : sub.cycle === "weekly"
          ? "/sett"
          : "/trim";

  return (
    <div
      className={`group flex items-center gap-4 rounded-2xl border p-4 transition-colors ${
        sub.active
          ? "border-border bg-card hover:border-mint/20"
          : "border-white/5 bg-card/40 opacity-70 hover:opacity-100"
      }`}
    >
      <div
        className="size-11 shrink-0 rounded-xl grid place-items-center font-display text-lg font-semibold"
        style={{
          backgroundColor: `${sub.color ?? "#A5F3E3"}22`,
          color: sub.color ?? "#A5F3E3",
        }}
        aria-hidden
      >
        {sub.name.charAt(0).toUpperCase()}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="font-medium truncate">{sub.name}</p>
          {soon && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-soft/10 px-2 py-0.5 text-[10px] font-medium text-amber-soft">
              <AlertCircle className="size-3" />
              {days <= 0 ? "Oggi" : `${days}g`}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate flex items-center gap-1.5 mt-0.5">
          <CalendarClock className="size-3" />
          Rinnovo {format(new Date(sub.nextRenewal), "d MMM yyyy", { locale: it })}
          <span className="text-muted-foreground/40">·</span>
          {sub.category}
        </p>
      </div>

      <div className="text-right shrink-0">
        <p className="font-display">
          {formatEUR(sub.amount)}
          <span className="text-xs text-muted-foreground ml-0.5">{cycleLabel}</span>
        </p>
        {sub.cycle !== "monthly" && (
          <p className="text-[10px] text-muted-foreground/70">
            ≈ {formatEUR(monthly)}/mese
          </p>
        )}
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
        <button
          onClick={() => {
            updateSubscription(sub.id, { active: !sub.active });
            toast.success(sub.active ? "Messo in pausa" : "Riattivato");
          }}
          className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-white/5"
          aria-label={sub.active ? "Metti in pausa" : "Riattiva"}
        >
          {sub.active ? <Pause className="size-4" /> : <Play className="size-4" />}
        </button>
        <SubscriptionDialog
          editing={sub}
          trigger={
            <button
              className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-white/5"
              aria-label="Modifica"
            >
              <Pencil className="size-4" />
            </button>
          }
        />
        <button
          onClick={() => {
            removeSubscription(sub.id);
            toast.success("Abbonamento eliminato");
          }}
          className="p-2 text-muted-foreground hover:text-destructive rounded-lg hover:bg-white/5"
          aria-label="Elimina"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-3xl border border-dashed border-white/10 p-10 text-center">
      <p className="font-display text-lg mb-1">Nessun abbonamento attivo</p>
      <p className="text-sm text-muted-foreground mb-4">
        Aggiungi il primo per iniziare a monitorare le spese ricorrenti.
      </p>
      <SubscriptionDialog
        trigger={
          <button className="inline-flex items-center gap-2 rounded-xl bg-mint px-4 py-2 text-sm font-semibold text-mint-foreground hover:scale-[1.02] transition-transform">
            <Plus className="size-4" strokeWidth={2.5} />
            Aggiungi abbonamento
          </button>
        }
      />
    </div>
  );
}
