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
import { toast } from "sonner";
import { Target } from "lucide-react";
import { useFinance, type Goal } from "@/lib/finance-store";

type Props = {
  trigger: ReactNode;
  goal?: Goal;
};

export function GoalDialog({ trigger, goal }: Props) {
  const { addGoal, updateGoal } = useFinance();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(goal?.title ?? "");
  const [amount, setAmount] = useState(goal ? String(goal.targetAmount) : "");
  const [saved, setSaved] = useState(goal ? String(goal.savedAmount) : "0");
  const [deadline, setDeadline] = useState(
    goal?.deadline?.slice(0, 10) ??
      new Date(Date.now() + 180 * 86400000).toISOString().slice(0, 10),
  );
  const [imageUrl, setImageUrl] = useState(goal?.imageUrl ?? "");
  const [note, setNote] = useState(goal?.note ?? "");

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImageUrl(String(reader.result));
    reader.readAsDataURL(file);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const target = parseFloat(amount.replace(",", "."));
    const already = parseFloat((saved || "0").replace(",", "."));
    if (!title.trim() || !isFinite(target) || target <= 0 || !deadline) {
      toast.error("Compila titolo, importo e data.");
      return;
    }
    const payload = {
      title: title.trim(),
      targetAmount: target,
      savedAmount: isFinite(already) ? already : 0,
      deadline: new Date(deadline).toISOString(),
      imageUrl: imageUrl || undefined,
      note: note.trim() || undefined,
    };
    if (goal) {
      updateGoal(goal.id, payload);
      toast.success("Obiettivo aggiornato");
    } else {
      addGoal(payload);
      toast.success("Obiettivo creato");
    }
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="size-5 text-mint" />
            {goal ? "Modifica obiettivo" : "Nuovo obiettivo"}
          </DialogTitle>
          <DialogDescription>
            Definisci cosa vuoi raggiungere e quando. Il coach calcolerà quanto
            risparmiare al mese.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="goal-title">Obiettivo</Label>
            <Input
              id="goal-title"
              placeholder="Es. Viaggio in Giappone"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="goal-amount">Importo (€)</Label>
              <Input
                id="goal-amount"
                type="number"
                step="0.01"
                inputMode="decimal"
                placeholder="3500"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="goal-saved">Già accantonato</Label>
              <Input
                id="goal-saved"
                type="number"
                step="0.01"
                inputMode="decimal"
                value={saved}
                onChange={(e) => setSaved(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="goal-deadline">Entro il</Label>
            <Input
              id="goal-deadline"
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="goal-image">Immagine (opzionale)</Label>
            <Input
              id="goal-image"
              type="file"
              accept="image/*"
              onChange={handleFile}
              className="cursor-pointer"
            />
            {imageUrl ? (
              <img
                src={imageUrl}
                alt="Anteprima obiettivo"
                className="mt-2 h-32 w-full rounded-lg object-cover border border-white/10"
              />
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="goal-note">Note (opzionale)</Label>
            <Textarea
              id="goal-note"
              rows={2}
              placeholder="Perché è importante per te?"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <DialogFooter>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-xl bg-mint px-5 py-2.5 text-sm font-semibold text-mint-foreground hover:scale-[1.02] transition-transform"
            >
              {goal ? "Salva" : "Crea obiettivo"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
