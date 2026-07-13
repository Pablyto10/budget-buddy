import { useEffect, useState } from "react";
import { Bell, Check, PieChart, Receipt } from "lucide-react";
import { isToday, isYesterday, format } from "date-fns";
import { it } from "date-fns/locale";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useProfile } from "@/lib/profile-store";
import { latestReleaseNotes, type ReleaseNoteIcon } from "@/lib/release-notes";

const SNOOZE_KEY = "budget-buddy:welcome-seen-until";
const DISABLED_KEY = "budget-buddy:welcome-disabled";

const NOTE_ICONS: Record<ReleaseNoteIcon, typeof Bell> = {
  bell: Bell,
  receipt: Receipt,
  "pie-chart": PieChart,
};

const NOTE_TONE_CLASSES: Record<"new" | "improved", string> = {
  new: "bg-mint/10 text-mint",
  improved: "bg-sky-soft/10 text-sky-soft",
};

const NOTE_BADGE_LABEL: Record<"new" | "improved", string> = {
  new: "Novità",
  improved: "Migliorata",
};

function greetingPhrase() {
  const hour = new Date().getHours();
  if (hour < 12) return "Un caffè, un piano, e si parte: oggi il tuo budget lavora per te.";
  if (hour < 18) return "Un altro giorno, un altro passo avanti verso i tuoi obiettivi.";
  return "Chiudiamo la giornata con i conti in ordine: continuiamo da dove avevi lasciato.";
}

function batchDateLabel(dateISO: string) {
  const d = new Date(`${dateISO}T00:00:00`);
  if (isToday(d)) return "Oggi";
  if (isYesterday(d)) return "Ieri";
  return format(d, "d MMM", { locale: it });
}

export function WelcomeDialog() {
  const { profile } = useProfile();
  const { date: batchDate, notes } = latestReleaseNotes(3);
  const [open, setOpen] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    if (!batchDate || typeof window === "undefined") return;
    if (window.localStorage.getItem(DISABLED_KEY) === "1") return;
    const lastSeen = window.localStorage.getItem(SNOOZE_KEY);
    if (lastSeen && lastSeen >= batchDate) return;
    setOpen(true);
  }, [batchDate]);

  function close() {
    if (batchDate) window.localStorage.setItem(SNOOZE_KEY, batchDate);
    if (dontShowAgain) window.localStorage.setItem(DISABLED_KEY, "1");
    setOpen(false);
  }

  if (!batchDate || notes.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-md border-white/10 bg-card-elevated p-0 overflow-hidden gap-0">
        <div className="relative p-7 pb-6 space-y-5">
          <div
            className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-mint/20 blur-[70px]"
            aria-hidden
          />
          <DialogHeader className="relative space-y-4 text-left">
            <div className="size-11 rounded-2xl bg-mint grid place-items-center shadow-[0_10px_24px_-10px_rgba(34,197,94,0.55)]">
              <Check className="size-5 text-mint-foreground" strokeWidth={2.5} />
            </div>
            <div className="space-y-1.5">
              <DialogTitle className="font-display text-2xl">
                Bentornato{profile?.username ? `, ${profile.username}` : ""}
              </DialogTitle>
              <DialogDescription className="max-w-[38ch] leading-relaxed">
                {greetingPhrase()}
              </DialogDescription>
            </div>
          </DialogHeader>

          <div className="relative space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Queste sono le ultime novità
              </span>
              <span className="h-px flex-1 bg-white/10" />
              <span className="rounded-full border border-mint/20 bg-mint/10 px-2.5 py-0.5 text-[11px] font-semibold text-mint">
                {batchDateLabel(batchDate)}
              </span>
            </div>

            <ul className="space-y-2.5">
              {notes.map((note) => {
                const Icon = NOTE_ICONS[note.icon];
                return (
                  <li
                    key={note.title}
                    className="flex items-start gap-3 rounded-2xl border border-white/5 bg-white/[0.02] p-3.5"
                  >
                    <div
                      className={`size-8 shrink-0 rounded-xl grid place-items-center ${NOTE_TONE_CLASSES[note.tone]}`}
                    >
                      <Icon className="size-4" />
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold">{note.title}</p>
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${NOTE_TONE_CLASSES[note.tone]}`}
                        >
                          {NOTE_BADGE_LABEL[note.tone]}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {note.description}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        <div className="border-t border-white/5 bg-black/10 p-5 space-y-3.5">
          <label className="flex items-center gap-2.5 text-xs text-muted-foreground cursor-pointer">
            <Checkbox
              checked={dontShowAgain}
              onCheckedChange={(v) => setDontShowAgain(Boolean(v))}
            />
            Non mostrare più le novità
          </label>
          <div className="flex gap-2.5">
            <button
              onClick={close}
              className="btn-secondary-premium flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold"
            >
              Più tardi
            </button>
            <button
              onClick={close}
              className="btn-primary-premium flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold"
            >
              Ho capito, grazie
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
