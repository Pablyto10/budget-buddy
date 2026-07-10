import { useMemo, useState } from "react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { CalendarClock, Check } from "lucide-react";
import { toast } from "sonner";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { formatEUR, useFinance } from "@/lib/finance-store";
import { isProposalFeatureActive } from "@/lib/monthly-proposal";

const DISMISS_KEY_PREFIX = "budget-buddy:proposals-dismissed:";
const SALARY_CATEGORY = "Stipendio";
const CC_CATEGORY = "Carta di credito";

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function sameMonth(dateISO: string, ref: Date) {
  const d = new Date(dateISO);
  return d.getMonth() === ref.getMonth() && d.getFullYear() === ref.getFullYear();
}

export function MonthlyProposalBanner() {
  const { transactions, subscriptions, addTransaction } = useFinance();
  const now = useMemo(() => new Date(), []);
  const storageKey = DISMISS_KEY_PREFIX + monthKey(now);

  const [dismissed, setDismissed] = useState(
    () => typeof window !== "undefined" && window.localStorage.getItem(storageKey) === "1",
  );

  const pendingSubs = useMemo(
    () =>
      subscriptions.filter(
        (s) =>
          s.active &&
          s.cycle === "monthly" &&
          !transactions.some(
            (t) => t.kind === "expense" && t.merchant === s.name && sameMonth(t.date, now),
          ),
      ),
    [subscriptions, transactions, now],
  );

  const salaryLogged = transactions.some(
    (t) => t.kind === "income" && t.category === SALARY_CATEGORY && sameMonth(t.date, now),
  );
  const lastSalary = useMemo(
    () =>
      transactions
        .filter((t) => t.kind === "income" && t.category === SALARY_CATEGORY)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0],
    [transactions],
  );

  const ccThisMonth = useMemo(() => {
    const items = transactions.filter(
      (t) => t.kind === "expense" && t.category === CC_CATEGORY && sameMonth(t.date, now),
    );
    return { count: items.length, total: items.reduce((s, t) => s + t.amount, 0) };
  }, [transactions, now]);

  const [checkedSubs, setCheckedSubs] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(pendingSubs.map((s) => [s.id, true])),
  );
  const [subAmounts, setSubAmounts] = useState<Record<string, string>>(() =>
    Object.fromEntries(pendingSubs.map((s) => [s.id, String(s.amount)])),
  );
  const [salaryChecked, setSalaryChecked] = useState(true);
  const [salaryAmount, setSalaryAmount] = useState(lastSalary ? String(lastSalary.amount) : "");

  // La sezione carta di credito è solo informativa (l'addebito è già registrato
  // da solo): non tiene aperto il banner da sola, altrimenti resterebbe visibile
  // tutto il mese anche a proposte già gestite.
  const hasActionable = pendingSubs.length > 0 || !salaryLogged;
  if (dismissed || !hasActionable || !isProposalFeatureActive(now)) return null;

  function dismiss() {
    window.localStorage.setItem(storageKey, "1");
    setDismissed(true);
  }

  async function handleConfirm() {
    let added = 0;
    for (const s of pendingSubs) {
      if (!checkedSubs[s.id]) continue;
      const amt = parseFloat((subAmounts[s.id] ?? String(s.amount)).replace(",", "."));
      if (!amt || amt <= 0) continue;
      await addTransaction({
        kind: "expense",
        amount: amt,
        merchant: s.name,
        category: s.category,
        note: "Spesa ricorrente del mese",
        date: now.toISOString(),
        source: "manual",
      });
      added++;
    }
    if (!salaryLogged && salaryChecked) {
      const amt = parseFloat(salaryAmount.replace(",", "."));
      if (amt && amt > 0) {
        await addTransaction({
          kind: "income",
          amount: amt,
          merchant: lastSalary?.merchant ?? "Stipendio",
          category: SALARY_CATEGORY,
          date: now.toISOString(),
          source: "manual",
        });
        added++;
      }
    }
    if (added > 0) {
      toast.success("Movimenti aggiunti", {
        description: `${added} ${added === 1 ? "movimento registrato" : "movimenti registrati"} per ${format(now, "MMMM yyyy", { locale: it })}`,
      });
    }
  }

  return (
    <section className="rounded-2xl border border-mint/30 bg-mint/5 p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarClock className="size-4 text-mint" />
          <h2 className="font-display text-base capitalize">
            Inizio {format(now, "MMMM", { locale: it })}: cosa vuoi registrare?
          </h2>
        </div>
        <button
          onClick={dismiss}
          className="shrink-0 text-xs text-muted-foreground hover:text-foreground"
        >
          Ignora questo mese
        </button>
      </div>

      {pendingSubs.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Spese ricorrenti
          </p>
          {pendingSubs.map((s) => (
            <label
              key={s.id}
              className="flex items-center gap-3 rounded-xl border border-white/10 bg-card px-3 py-2"
            >
              <Checkbox
                checked={checkedSubs[s.id] ?? true}
                onCheckedChange={(v) =>
                  setCheckedSubs((c) => ({ ...c, [s.id]: Boolean(v) }))
                }
              />
              <span className="flex-1 text-sm truncate">{s.name}</span>
              <Input
                value={subAmounts[s.id] ?? String(s.amount)}
                onChange={(e) =>
                  setSubAmounts((a) => ({ ...a, [s.id]: e.target.value }))
                }
                inputMode="decimal"
                className="w-24 h-8 text-right"
              />
            </label>
          ))}
        </div>
      )}

      {!salaryLogged && (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Entrata</p>
          <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-card px-3 py-2">
            <Checkbox
              checked={salaryChecked}
              onCheckedChange={(v) => setSalaryChecked(Boolean(v))}
            />
            <span className="flex-1 text-sm">Stipendio</span>
            <Input
              value={salaryAmount}
              onChange={(e) => setSalaryAmount(e.target.value)}
              inputMode="decimal"
              placeholder="0,00"
              className="w-24 h-8 text-right"
            />
          </label>
        </div>
      )}

      {ccThisMonth.count > 0 && (
        <div className="rounded-xl border border-white/10 bg-card px-3 py-2 text-sm">
          <span className="text-muted-foreground">
            Carta di credito addebitata questo mese:{" "}
          </span>
          <span className="font-display">{formatEUR(ccThisMonth.total)}</span>
          <span className="text-xs text-muted-foreground">
            {" "}
            ({ccThisMonth.count} {ccThisMonth.count === 1 ? "spesa" : "spese"}, già registrata)
          </span>
        </div>
      )}

      {(pendingSubs.length > 0 || (!salaryLogged && salaryAmount.trim())) && (
        <button
          onClick={handleConfirm}
          className="inline-flex items-center gap-2 rounded-xl bg-mint px-4 py-2 text-sm font-semibold text-mint-foreground hover:scale-[1.01] transition-transform"
        >
          <Check className="size-4" />
          Aggiungi selezionate
        </button>
      )}
    </section>
  );
}
