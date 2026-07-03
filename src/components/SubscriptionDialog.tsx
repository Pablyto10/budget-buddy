import { useEffect, useState, type ReactNode } from "react";
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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  useFinance,
  SUB_CATEGORIES,
  type BillingCycle,
  type Subscription,
} from "@/lib/finance-store";

type Props = {
  trigger: ReactNode;
  editing?: Subscription;
};

const CYCLES: { value: BillingCycle; label: string }[] = [
  { value: "weekly", label: "Settimanale" },
  { value: "monthly", label: "Mensile" },
  { value: "quarterly", label: "Trimestrale" },
  { value: "yearly", label: "Annuale" },
];

export function SubscriptionDialog({ trigger, editing }: Props) {
  const { addSubscription, updateSubscription } = useFinance();
  const [open, setOpen] = useState(false);

  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const [nextRenewal, setNextRenewal] = useState(
    () => new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
  );
  const [category, setCategory] = useState("Streaming");
  const [color, setColor] = useState("#A5F3E3");
  const [active, setActive] = useState(true);
  const [note, setNote] = useState("");

  // Precompila in modalità edit ogni volta che apri.
  useEffect(() => {
    if (open && editing) {
      setName(editing.name);
      setAmount(String(editing.amount));
      setCycle(editing.cycle);
      setNextRenewal(editing.nextRenewal.slice(0, 10));
      setCategory(editing.category);
      setColor(editing.color ?? "#A5F3E3");
      setActive(editing.active);
      setNote(editing.note ?? "");
    }
    if (open && !editing) {
      setName("");
      setAmount("");
      setCycle("monthly");
      setNextRenewal(new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10));
      setCategory("Streaming");
      setColor("#A5F3E3");
      setActive(true);
      setNote("");
    }
  }, [open, editing]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseFloat(amount.replace(",", "."));
    if (!name.trim()) return toast.error("Dai un nome all'abbonamento");
    if (!parsed || parsed <= 0) return toast.error("Importo non valido");

    const payload = {
      name: name.trim(),
      amount: parsed,
      cycle,
      nextRenewal: new Date(nextRenewal).toISOString(),
      category,
      color,
      active,
      note: note.trim() || undefined,
    };

    if (editing) {
      updateSubscription(editing.id, payload);
      toast.success("Abbonamento aggiornato");
    } else {
      addSubscription(payload);
      toast.success("Abbonamento aggiunto", {
        description: `${payload.name} · €${parsed.toFixed(2)}`,
      });
    }
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md bg-card border-white/10">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            {editing ? "Modifica abbonamento" : "Nuovo abbonamento"}
          </DialogTitle>
          <DialogDescription>
            Traccia importo, ciclo di rinnovo e prossima scadenza per non farti sorprendere.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
            <div className="space-y-2">
              <Label htmlFor="sub-name">Nome</Label>
              <Input
                id="sub-name"
                autoFocus
                placeholder="Netflix, Spotify…"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sub-color">Colore</Label>
              <input
                id="sub-color"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-10 w-12 rounded-md border border-white/10 bg-transparent cursor-pointer"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="sub-amount">Importo (€)</Label>
              <Input
                id="sub-amount"
                inputMode="decimal"
                placeholder="0,00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Ciclo</Label>
              <Select value={cycle} onValueChange={(v) => setCycle(v as BillingCycle)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CYCLES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="sub-renewal">Prossimo rinnovo</Label>
              <Input
                id="sub-renewal"
                type="date"
                value={nextRenewal}
                onChange={(e) => setNextRenewal(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUB_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-white/5 bg-background/50 p-3">
            <div>
              <p className="text-sm font-medium">Abbonamento attivo</p>
              <p className="text-xs text-muted-foreground">
                Disattivalo per tenerne traccia senza contarlo nel budget.
              </p>
            </div>
            <Switch checked={active} onCheckedChange={setActive} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sub-note">Nota</Label>
            <Textarea
              id="sub-note"
              rows={2}
              placeholder="Es. Piano famiglia, condiviso con…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <DialogFooter>
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center rounded-xl bg-mint px-5 py-3 text-sm font-semibold text-mint-foreground transition-transform hover:scale-[1.01]"
            >
              {editing ? "Salva modifiche" : "Aggiungi abbonamento"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
