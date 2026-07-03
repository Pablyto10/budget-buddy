import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, ArrowDownLeft, ArrowUpRight, Pencil, Search, Trash2 } from "lucide-react";
import { format, isToday, isYesterday } from "date-fns";
import { it } from "date-fns/locale";
import { toast } from "sonner";

import { formatEUR, useFinance, type Transaction } from "@/lib/finance-store";
import { AddTransactionDialog } from "@/components/AddTransactionDialog";

export const Route = createFileRoute("/_authenticated/transactions")({
  head: () => ({
    meta: [
      { title: "Tutti i movimenti — Money Coach AI" },
      {
        name: "description",
        content: "Storico completo di entrate e spese con filtro per categoria e ricerca.",
      },
    ],
  }),
  component: TransactionsPage,
});

function relativeDate(iso: string) {
  const d = new Date(iso);
  if (isToday(d)) return `Oggi, ${format(d, "HH:mm")}`;
  if (isYesterday(d)) return "Ieri";
  return format(d, "d MMM yyyy", { locale: it });
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
      return "Sync";
    default:
      return "";
  }
}

type Filter = "all" | "expense" | "income";

function TransactionsPage() {
  const { transactions, removeTransaction } = useFinance();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");

  const categories = useMemo(() => {
    const set = new Set<string>();
    transactions.forEach((t) => set.add(t.category));
    return Array.from(set).sort();
  }, [transactions]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return transactions.filter((t) => {
      if (filter !== "all" && t.kind !== filter) return false;
      if (category !== "all" && t.category !== category) return false;
      if (q && !`${t.merchant} ${t.category} ${t.note ?? ""}`.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [transactions, filter, category, query]);

  const totals = useMemo(() => {
    const income = filtered
      .filter((t) => t.kind === "income")
      .reduce((s, t) => s + t.amount, 0);
    const expenses = filtered
      .filter((t) => t.kind === "expense")
      .reduce((s, t) => s + t.amount, 0);
    return { income, expenses, net: income - expenses };
  }, [filtered]);

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
        <span className="font-display text-lg tracking-tight">Movimenti</span>
        <div className="flex items-center gap-2">
          <AddTransactionDialog
            defaultKind="expense"
            trigger={
              <button className="inline-flex items-center gap-1.5 rounded-full bg-mint px-3 py-1.5 text-xs font-semibold text-mint-foreground hover:scale-[1.02] transition-transform">
                Nuovo
              </button>
            }
          />
        </div>
      </nav>

      <main className="mx-auto max-w-4xl px-6 py-8 space-y-6 pb-24">
        {/* Totali */}
        <div className="grid grid-cols-3 gap-3">
          <SummaryPill label="Entrate" value={formatEUR(totals.income)} tone="mint" />
          <SummaryPill
            label="Uscite"
            value={formatEUR(totals.expenses)}
            tone="neutral"
          />
          <SummaryPill
            label="Netto"
            value={formatEUR(totals.net)}
            tone={totals.net >= 0 ? "mint" : "amber"}
          />
        </div>

        {/* Filtri */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-full border border-white/10 bg-white/5 p-1">
            {(["all", "expense", "income"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                  filter === f
                    ? "bg-mint text-mint-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {f === "all" ? "Tutti" : f === "expense" ? "Spese" : "Entrate"}
              </button>
            ))}
          </div>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-mint"
          >
            <option value="all">Tutte le categorie</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <div className="ml-auto flex-1 min-w-[180px] max-w-xs relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cerca…"
              className="w-full rounded-full border border-white/10 bg-white/5 pl-9 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-mint"
            />
          </div>
        </div>

        {/* Lista */}
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 p-12 text-center text-sm text-muted-foreground">
            Nessun movimento con questi filtri.
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((t) => (
              <div
                key={t.id}
                className="group flex items-center justify-between rounded-xl border border-border bg-card p-4 transition-colors hover:border-mint/20"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div
                    className={`size-10 rounded-full grid place-items-center italic font-display ${
                      t.kind === "income"
                        ? "bg-mint/10 text-mint border border-mint/20"
                        : "bg-white/5 text-muted-foreground border border-white/5"
                    }`}
                  >
                    {t.kind === "income" ? (
                      <ArrowUpRight className="size-4" />
                    ) : (
                      <ArrowDownLeft className="size-4" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{t.merchant}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {t.category} · {relativeDate(t.date)}
                      {t.source ? ` · ${sourceLabel(t.source)}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <p
                    className={`font-display ${
                      t.kind === "income" ? "text-mint" : ""
                    }`}
                  >
                    {t.kind === "income" ? "+" : "-"}
                    {formatEUR(t.amount)}
                  </p>
                  <AddTransactionDialog
                    transaction={t}
                    trigger={
                      <button
                        aria-label="Modifica"
                        className="p-2 rounded-lg text-muted-foreground hover:text-mint hover:bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Pencil className="size-4" />
                      </button>
                    }
                  />
                  <button
                    onClick={() => {
                      removeTransaction(t.id);
                      toast.success("Movimento eliminato");
                    }}
                    aria-label="Elimina"
                    className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function SummaryPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "mint" | "amber" | "neutral";
}) {
  const toneClass =
    tone === "mint"
      ? "text-mint"
      : tone === "amber"
        ? "text-amber-soft"
        : "text-foreground";
  return (
    <div className="rounded-2xl border border-white/5 bg-card p-4">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className={`font-display text-xl mt-1 ${toneClass}`}>{value}</p>
    </div>
  );
}
