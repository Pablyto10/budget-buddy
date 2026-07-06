import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, CreditCard, Trash2, Plus } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { toast } from "sonner";

import { formatEUR, useFinance } from "@/lib/finance-store";

export const Route = createFileRoute("/_authenticated/credit-card")({
  head: () => ({
    meta: [
      { title: "Carta di credito — Where's My Budget" },
      {
        name: "description",
        content:
          "Registra le spese pagate con carta di credito. Vengono addebitate nel bilancio del mese successivo.",
      },
    ],
  }),
  component: CreditCardPage,
});

const CC_CATEGORY = "Carta di credito";

function firstOfNextMonth(from: Date): Date {
  return new Date(from.getFullYear(), from.getMonth() + 1, 1, 12, 0, 0);
}

function CreditCardPage() {
  const { transactions, addTransaction, removeTransaction } = useFinance();

  const [amount, setAmount] = useState("");
  const [merchant, setMerchant] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [note, setNote] = useState("");

  const ccTx = useMemo(
    () =>
      transactions
        .filter((t) => t.category === CC_CATEGORY && t.kind === "expense")
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [transactions],
  );

  // Raggruppa per mese di addebito (t.date)
  const grouped = useMemo(() => {
    const map = new Map<string, typeof ccTx>();
    for (const t of ccTx) {
      const d = new Date(t.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const arr = map.get(key) ?? [];
      arr.push(t);
      map.set(key, arr);
    }
    return Array.from(map.entries()).map(([key, items]) => {
      const [y, m] = key.split("-").map(Number);
      const date = new Date(y, m - 1, 1);
      const total = items.reduce((s, t) => s + t.amount, 0);
      return { key, date, items, total };
    });
  }, [ccTx]);

  const now = new Date();
  const pendingTotal = useMemo(
    () =>
      ccTx
        .filter((t) => new Date(t.date) > new Date(now.getFullYear(), now.getMonth() + 1, 0))
        .reduce((s, t) => s + t.amount, 0),
    [ccTx, now],
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseFloat(amount.replace(",", "."));
    if (!parsed || parsed <= 0) {
      toast.error("Inserisci un importo valido");
      return;
    }
    if (!merchant.trim()) {
      toast.error("Inserisci una descrizione");
      return;
    }
    const purchase = new Date(purchaseDate);
    const chargeDate = firstOfNextMonth(purchase);
    await addTransaction({
      kind: "expense",
      amount: parsed,
      merchant: merchant.trim(),
      category: CC_CATEGORY,
      note:
        `Acquisto del ${format(purchase, "d MMM yyyy", { locale: it })}` +
        (note.trim() ? ` — ${note.trim()}` : ""),
      date: chargeDate.toISOString(),
      source: "manual",
    });
    toast.success("Spesa registrata", {
      description: `Verrà addebitata a ${format(chargeDate, "MMMM yyyy", { locale: it })}`,
    });
    setAmount("");
    setMerchant("");
    setNote("");
    setPurchaseDate(new Date().toISOString().slice(0, 10));
  }

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
        <span className="font-display text-lg tracking-tight flex items-center gap-2">
          <CreditCard className="size-4 text-mint" />
          Carta di credito
        </span>
        <span className="w-14" />
      </nav>

      <main className="mx-auto max-w-3xl px-6 py-8 space-y-8 pb-24">
        <section className="rounded-2xl border border-white/10 bg-card p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-mint mb-2">
            Come funziona
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Le spese registrate qui non toccano il bilancio del mese in corso.
            Vengono addebitate automaticamente il <strong>1° del mese
            successivo</strong> alla data dell'acquisto, come farebbe l'estratto
            conto della tua carta.
          </p>
          {pendingTotal > 0 ? (
            <p className="mt-3 text-sm">
              In attesa di addebito: <span className="font-display text-mint">{formatEUR(pendingTotal)}</span>
            </p>
          ) : null}
        </section>

        <section className="rounded-2xl border border-white/10 bg-card p-5">
          <h2 className="font-display text-lg mb-4">Nuova spesa</h2>
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs text-muted-foreground">Importo (€)</label>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-background px-4 py-3 text-2xl font-display focus:outline-none focus:ring-1 focus:ring-mint"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Descrizione</label>
              <input
                type="text"
                placeholder="Es. Amazon"
                value={merchant}
                onChange={(e) => setMerchant(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-mint"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Data acquisto</label>
              <input
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-mint"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs text-muted-foreground">Nota (facoltativa)</label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-mint"
              />
            </div>
            <div className="sm:col-span-2">
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-xl bg-mint px-5 py-3 text-sm font-semibold text-mint-foreground hover:scale-[1.01] transition-transform"
              >
                <Plus className="size-4" />
                Aggiungi spesa
              </button>
            </div>
          </form>
        </section>

        <section className="space-y-4">
          <h2 className="font-display text-lg">Spese registrate</h2>
          {grouped.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 p-12 text-center text-sm text-muted-foreground">
              Nessuna spesa con carta di credito.
            </div>
          ) : (
            grouped.map((g) => {
              const isFuture = g.date > new Date(now.getFullYear(), now.getMonth(), 1);
              return (
                <div key={g.key} className="rounded-2xl border border-white/10 bg-card overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
                    <div>
                      <p className="text-xs uppercase tracking-wider text-muted-foreground">
                        Addebito
                      </p>
                      <p className="font-display text-base capitalize">
                        {format(g.date, "MMMM yyyy", { locale: it })}
                        {isFuture ? (
                          <span className="ml-2 text-xs font-normal rounded-full bg-mint/15 text-mint px-2 py-0.5">
                            in arrivo
                          </span>
                        ) : null}
                      </p>
                    </div>
                    <p className="font-display text-lg">{formatEUR(g.total)}</p>
                  </div>
                  <ul className="divide-y divide-white/5">
                    {g.items.map((t) => (
                      <li key={t.id} className="flex items-center justify-between px-5 py-3">
                        <div className="min-w-0">
                          <p className="font-medium truncate">{t.merchant}</p>
                          {t.note ? (
                            <p className="text-xs text-muted-foreground truncate">{t.note}</p>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-display">{formatEUR(t.amount)}</span>
                          <button
                            onClick={() => {
                              removeTransaction(t.id);
                              toast.success("Spesa eliminata");
                            }}
                            aria-label="Elimina"
                            className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-white/5 transition-colors"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })
          )}
        </section>
      </main>
    </div>
  );
}
