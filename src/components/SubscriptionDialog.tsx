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
  SUBSCRIPTION_NAMES,
  SUBSCRIPTION_NAME_CATEGORY,
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

const CUSTOM_OPTION = "Altro";

export function SubscriptionDialog({ trigger, editing }: Props) {
  const { addSubscription, updateSubscription } = useFinance();
  const [open, setOpen] = useState(false);

  const [nameOption, setNameOption] = useState(CUSTOM_OPTION);
  const [customName, setCustomName] = useState("");
  const [amount, setAmount] = useState("");
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const [nextRenewal, setNextRenewal] = useState(
    () => new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
  );
  const [categoryOption, setCategoryOption] = useState("Streaming");
  const [customCategory, setCustomCategory] = useState("");
  const [color, setColor] = useState("#A5F3E3");
  const [active, setActive] = useState(true);
  const [note, setNote] = useState("");

  const isCustomName = nameOption === CUSTOM_OPTION;
  const autoCategory = !isCustomName ? SUBSCRIPTION_NAME_CATEGORY[nameOption] : undefined;
  const isCustomCategory = isCustomName && categoryOption === CUSTOM_OPTION;

  // Precompila in modalità edit ogni volta che apri.
  useEffect(() => {
    if (open && editing) {
      const knownName = SUBSCRIPTION_NAMES.includes(editing.name) && editing.name !== CUSTOM_OPTION;
      setNameOption(knownName ? editing.name : CUSTOM_OPTION);
      setCustomName(knownName ? "" : editing.name);
      setAmount(String(editing.amount));
      setCycle(editing.cycle);
      setNextRenewal(editing.nextRenewal.slice(0, 10));
      const knownCategory = SUB_CATEGORIES.includes(editing.category) && editing.category !== CUSTOM_OPTION;
      setCategoryOption(knownCategory ? editing.category : CUSTOM_OPTION);
      setCustomCategory(knownCategory ? "" : editing.category);
      setColor(editing.color ?? "#A5F3E3");
      setActive(editing.active);
      setNote(editing.note ?? "");
    }
    if (open && !editing) {
      setNameOption(CUSTOM_OPTION);
      setCustomName("");
      setAmount("");
      setCycle("monthly");
      setNextRenewal(new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10));
      setCategoryOption("Streaming");
      setCustomCategory("");
      setColor("#A5F3E3");
      setActive(true);
      setNote("");
    }
  }, [open, editing]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseFloat(amount.replace(",", "."));
    const finalName = (isCustomName ? customName : nameOption).trim();
    const finalCategory = (autoCategory ?? (isCustomCategory ? customCategory : categoryOption)).trim();
    if (!finalName) return toast.error("Dai un nome alla spesa ricorrente");
    if (!finalCategory) return toast.error("Scegli una categoria");
    if (!parsed || parsed <= 0) return toast.error("Importo non valido");

    const payload = {
      name: finalName,
      amount: parsed,
      cycle,
      nextRenewal: new Date(nextRenewal).toISOString(),
      category: finalCategory,
      color,
      active,
      note: note.trim() || undefined,
    };

    if (editing) {
      updateSubscription(editing.id, payload);
      toast.success("Spesa ricorrente aggiornata");
    } else {
      addSubscription(payload);
      toast.success("Spesa ricorrente aggiunta", {
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
            {editing ? "Modifica spesa ricorrente" : "Nuova spesa ricorrente"}
          </DialogTitle>
          <DialogDescription>
            Traccia importo, ciclo di rinnovo e prossima scadenza per non farti sorprendere.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Select value={nameOption} onValueChange={setNameOption}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUBSCRIPTION_NAMES.map((n) => (
                    <SelectItem key={n} value={n}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

          {isCustomName && (
            <div className="space-y-2">
              <Label htmlFor="sub-name-custom">Nome personalizzato</Label>
              <Input
                id="sub-name-custom"
                autoFocus
                placeholder="Es. Manutenzione caldaia"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
              />
            </div>
          )}

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
              {autoCategory ? (
                <Input value={autoCategory} disabled readOnly />
              ) : (
                <Select value={categoryOption} onValueChange={setCategoryOption}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUB_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          {isCustomCategory && (
            <div className="space-y-2">
              <Label htmlFor="sub-category-custom">Categoria personalizzata</Label>
              <Input
                id="sub-category-custom"
                placeholder="Es. Manutenzione casa"
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
              />
            </div>
          )}

          <div className="flex items-center justify-between rounded-xl border border-white/5 bg-background/50 p-3">
            <div>
              <p className="text-sm font-medium">Spesa ricorrente attiva</p>
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
              {editing ? "Salva modifiche" : "Aggiungi spesa ricorrente"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
