import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { MessageSquarePlus, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { submitFeedback } from "@/lib/feedback.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function FeedbackDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const send = useServerFn(submitFeedback);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
  }, []);

  async function handleSubmit() {
    const trimmed = message.trim();
    if (trimmed.length < 3) {
      toast.error("Scrivi almeno qualche parola");
      return;
    }
    setSending(true);
    try {
      await send({ data: { message: trimmed } });
      toast.success("Segnalazione inviata, grazie!");
      setMessage("");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore nell'invio");
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invia una segnalazione</DialogTitle>
          <DialogDescription>
            Raccontaci un bug, un'idea o qualcosa da migliorare. Finisce direttamente nel nostro board.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="feedback-email" className="text-xs uppercase tracking-wider text-muted-foreground">
              Mail
            </Label>
            <Input id="feedback-email" value={email} readOnly disabled />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="feedback-message" className="text-xs uppercase tracking-wider text-muted-foreground">
              Segnalazione
            </Label>
            <Textarea
              id="feedback-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Descrivi la tua segnalazione…"
              rows={5}
              maxLength={2000}
              autoFocus
            />
            <p className="text-xs text-muted-foreground text-right">{message.length}/2000</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Annulla
          </Button>
          <Button onClick={handleSubmit} disabled={sending || message.trim().length < 3}>
            {sending ? <Loader2 className="size-4 animate-spin" /> : "Invia"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function FeedbackButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        size="sm"
        onClick={() => setOpen(true)}
        className="fixed bottom-24 right-6 z-50 shadow-lg gap-2 rounded-full h-11 px-4 sm:bottom-6 btn-feedback-premium"
        aria-label="Invia segnalazione"
      >
        <MessageSquarePlus className="size-4" />
        <span className="hidden sm:inline">Segnalazione</span>
      </Button>
      <FeedbackDialog open={open} onOpenChange={setOpen} />
    </>
  );
}