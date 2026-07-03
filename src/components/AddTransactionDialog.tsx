import { useState, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import {
  useFinance,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  type TxKind,
} from "@/lib/finance-store";

type Props = {
  trigger: ReactNode;
  defaultKind?: TxKind;
  transaction?: import("@/lib/finance-store").Transaction;
};

export function AddTransactionDialog({ trigger, defaultKind = "expense", transaction }: Props) {
  const { addTransaction, updateTransaction } = useFinance();
  const isEdit = Boolean(transaction);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<TxKind>(transaction?.kind ?? defaultKind);
  const [amount, setAmount] = useState(transaction ? String(transaction.amount) : "");
  const [merchant, setMerchant] = useState(transaction?.merchant ?? "");
  const [category, setCategory] = useState<string>(transaction?.category ?? "");
  const [note, setNote] = useState(transaction?.note ?? "");
  const [date, setDate] = useState(
    transaction ? transaction.date.slice(0, 10) : new Date().toISOString().slice(0, 10),
  );

  const categories = kind === "expense" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  function reset() {
    if (transaction) {
      setKind(transaction.kind);
      setAmount(String(transaction.amount));
      setMerchant(transaction.merchant);
      setCategory(transaction.category);
      setNote(transaction.note ?? "");
      setDate(transaction.date.slice(0, 10));
    } else {
      setAmount("");
      setMerchant("");
      setCategory("");
      setNote("");
      setDate(new Date().toISOString().slice(0, 10));
      setKind(defaultKind);
    }
  }

  function handleSubmit(e: React.FormEvent) {
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
    const payload = {
      kind,
      amount: parsed,
      merchant: merchant.trim(),
      category: category || "Altro",
      note: note.trim() || undefined,
      date: new Date(date).toISOString(),
    };
    if (isEdit && transaction) {
      updateTransaction(transaction.id, payload);
      toast.success("Movimento aggiornato", {
        description: `${payload.merchant} · €${parsed.toFixed(2)}`,
      });
    } else {
      addTransaction({ ...payload, source: "manual" });
      toast.success(
        kind === "expense" ? "Spesa registrata" : "Entrata registrata",
        { description: `${payload.merchant} · €${parsed.toFixed(2)}` },
      );
    }
    reset();
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md bg-card border-white/10">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            {isEdit ? "Modifica" : "Nuova"} {kind === "expense" ? "spesa" : "entrata"}
          </DialogTitle>
          <DialogDescription>
            Registra un movimento manuale. Puoi cambiare tipo, categoria e data.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Kind toggle */}
          <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-background border border-white/5">
            <button
              type="button"
              onClick={() => setKind("expense")}
              className={`flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-colors ${
                kind === "expense"
                  ? "bg-white/10 text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <ArrowDownLeft className="size-4" />
              Spesa
            </button>
            <button
              type="button"
              onClick={() => setKind("income")}
              className={`flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-colors ${
                kind === "income"
                  ? "bg-mint/20 text-mint"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <ArrowUpRight className="size-4" />
              Entrata
            </button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Importo (€)</Label>
            <Input
              id="amount"
              type="text"
              inputMode="decimal"
              autoFocus
              placeholder="0,00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="text-2xl font-display h-14"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="merchant">Descrizione</Label>
            <Input
              id="merchant"
              placeholder={kind === "expense" ? "Es. Supermercato" : "Es. Stipendio"}
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Scegli…" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="date">Data</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="note">Nota (facoltativa)</Label>
            <Textarea
              id="note"
              rows={2}
              placeholder="Aggiungi un contesto…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <DialogFooter>
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-mint px-5 py-3 text-sm font-semibold text-mint-foreground transition-transform hover:scale-[1.01]"
            >
              {isEdit ? "Aggiorna" : "Salva"} {kind === "expense" ? "spesa" : "entrata"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
