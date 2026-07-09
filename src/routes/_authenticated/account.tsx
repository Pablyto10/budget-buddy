import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { User, ShieldCheck, Settings2, AlertTriangle, LogOut, Loader2, Info, MessageSquarePlus, ExternalLink, ChevronRight } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/lib/profile-store";
import { deleteMyAccount, wipeMyData } from "@/lib/account.functions";
import { FeedbackDialog } from "@/components/FeedbackButton";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({
    meta: [
      { title: "Account — Where's My Budget" },
      {
        name: "description",
        content:
          "Gestisci profilo, sicurezza e preferenze del tuo account Where's My Budget.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AccountPage,
});

const PREF_KEY = "wmb.preferences.v1";
type Prefs = { emailReminders: boolean; subscriptionAlerts: boolean };
const DEFAULT_PREFS: Prefs = { emailReminders: true, subscriptionAlerts: true };

function AccountPage() {
  const { profile, refresh } = useProfile();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [email, setEmail] = useState<string>("");
  const [username, setUsername] = useState(profile?.username ?? "");
  const [savingUsername, setSavingUsername] = useState(false);

  const [pw, setPw] = useState({ next: "", confirm: "" });
  const [savingPw, setSavingPw] = useState(false);

  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);

  const [wiping, setWiping] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const wipe = useServerFn(wipeMyData);
  const del = useServerFn(deleteMyAccount);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(PREF_KEY) : null;
      if (raw) setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(raw) });
    } catch {}
  }, []);

  useEffect(() => {
    if (profile?.username) setUsername(profile.username);
  }, [profile?.username]);

  function updatePrefs(patch: Partial<Prefs>) {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    try {
      localStorage.setItem(PREF_KEY, JSON.stringify(next));
    } catch {}
    toast.success("Preferenza aggiornata");
  }

  async function saveUsername() {
    if (!profile) return;
    const value = username.trim();
    if (!value) {
      toast.error("Lo username non può essere vuoto");
      return;
    }
    if (value === profile.username) return;
    setSavingUsername(true);
    const { error } = await supabase
      .from("profiles")
      .update({ username: value })
      .eq("id", profile.id);
    setSavingUsername(false);
    if (error) {
      if (error.code === "23505") toast.error("Username già in uso");
      else toast.error("Impossibile aggiornare lo username");
      return;
    }
    await refresh();
    toast.success("Username aggiornato");
  }

  async function changePassword() {
    if (pw.next.length < 8) {
      toast.error("La password deve avere almeno 8 caratteri");
      return;
    }
    if (pw.next !== pw.confirm) {
      toast.error("Le password non coincidono");
      return;
    }
    setSavingPw(true);
    const { error } = await supabase.auth.updateUser({ password: pw.next });
    setSavingPw(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setPw({ next: "", confirm: "" });
    toast.success("Password aggiornata");
  }

  async function signOutEverywhere() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut({ scope: "global" });
    navigate({ to: "/auth", replace: true });
  }

  async function handleWipe() {
    setWiping(true);
    try {
      await wipe();
      toast.success("Dati cancellati");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore");
    } finally {
      setWiping(false);
    }
  }

  async function handleDelete() {
    if (confirmText.trim() !== (profile?.username ?? "")) {
      toast.error("Digita il tuo username per confermare");
      return;
    }
    setDeleting(true);
    try {
      await del();
      await queryClient.cancelQueries();
      queryClient.clear();
      await supabase.auth.signOut();
      toast.success("Account eliminato");
      navigate({ to: "/auth", replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-white/5 bg-background/80 backdrop-blur-xl sticky top-0 z-30">
        <div className="mx-auto max-w-3xl px-6 py-5 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-mint">Il tuo account</p>
            <h1 className="font-display text-2xl mt-1">Account</h1>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate({ to: "/" })}>
            Torna alla home
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-8 space-y-8 pb-24">
        {/* Profilo */}
        <Section icon={<User className="size-4" />} title="Profilo" description="Come ti chiamiamo dentro l'app.">
          <div className="space-y-4">
            <Field label="Username">
              <div className="flex gap-2">
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="il-tuo-username"
                  maxLength={40}
                />
                <Button
                  onClick={saveUsername}
                  disabled={savingUsername || username.trim() === (profile?.username ?? "")}
                >
                  {savingUsername ? <Loader2 className="size-4 animate-spin" /> : "Salva"}
                </Button>
              </div>
            </Field>
            <Field label="Email">
              <Input value={email} disabled readOnly />
              <p className="text-xs text-muted-foreground mt-1">
                L'email è collegata al tuo login e non può essere modificata qui.
              </p>
            </Field>
            {profile?.createdAt ? (
              <Field label="Membro dal">
                <Input value={new Date(profile.createdAt).toLocaleDateString("it-IT")} disabled readOnly />
              </Field>
            ) : null}
          </div>
        </Section>

        {/* Sicurezza */}
        <Section icon={<ShieldCheck className="size-4" />} title="Sicurezza" description="Aggiorna la password e gestisci le sessioni.">
          <div className="space-y-4">
            <Field label="Nuova password">
              <Input
                type="password"
                value={pw.next}
                onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))}
                placeholder="Almeno 8 caratteri"
              />
            </Field>
            <Field label="Conferma password">
              <Input
                type="password"
                value={pw.confirm}
                onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))}
              />
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button onClick={changePassword} disabled={savingPw || !pw.next}>
                {savingPw ? <Loader2 className="size-4 animate-spin" /> : "Aggiorna password"}
              </Button>
              <Button variant="outline" onClick={signOutEverywhere}>
                <LogOut className="size-4" />
                Esci da tutti i dispositivi
              </Button>
            </div>
          </div>
        </Section>

        {/* Preferenze app */}
        <Section icon={<Settings2 className="size-4" />} title="Preferenze app" description="Personalizza notifiche e promemoria.">
          <div className="space-y-4">
            <ToggleRow
              label="Promemoria email"
              hint="Ricevi un riepilogo settimanale via email."
              checked={prefs.emailReminders}
              onChange={(v) => updatePrefs({ emailReminders: v })}
            />
            <ToggleRow
              label="Avvisi rinnovi spese ricorrenti"
              hint="Notifiche quando un abbonamento sta per rinnovarsi."
              checked={prefs.subscriptionAlerts}
              onChange={(v) => updatePrefs({ subscriptionAlerts: v })}
            />
          </div>
        </Section>

        {/* Info & Release */}
        <Section icon={<Info className="size-4" />} title="Info & Release" description="Invia segnalazioni e scopri le ultime novità.">
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setFeedbackOpen(true)}
              className="w-full flex items-center justify-between gap-4 rounded-xl border border-white/5 bg-background/40 p-4 text-left hover:bg-background/60 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="size-8 rounded-lg bg-mint/10 text-mint flex items-center justify-center shrink-0">
                  <MessageSquarePlus className="size-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium">Segnalazioni</p>
                  <p className="text-xs text-muted-foreground">Segnala un bug o proponi un miglioramento.</p>
                </div>
              </div>
              <ChevronRight className="size-4 text-muted-foreground shrink-0" />
            </button>

            <a
              href="https://wheresmybudget.notion.site/Implementazioni-3976bc449028802080c4d9fd4a64281f?source=copy_link"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-between gap-4 rounded-xl border border-white/5 bg-background/40 p-4 hover:bg-background/60 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="size-8 rounded-lg bg-mint/10 text-mint flex items-center justify-center shrink-0">
                  <Info className="size-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium">Info Release</p>
                  <p className="text-xs text-muted-foreground">Scopri le ultime implementazioni e novità.</p>
                </div>
              </div>
              <ExternalLink className="size-4 text-muted-foreground shrink-0" />
            </a>
          </div>
        </Section>

        <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />

        {/* Area pericolosa */}
        <section className="rounded-2xl border border-rose-soft/30 bg-rose-soft/[0.03] p-6">
          <div className="flex items-start gap-3 mb-4">
            <div className="size-8 rounded-lg bg-rose-soft/10 text-rose-soft flex items-center justify-center shrink-0">
              <AlertTriangle className="size-4" />
            </div>
            <div>
              <h2 className="font-display text-lg text-rose-soft">Area pericolosa</h2>
              <p className="text-sm text-muted-foreground">
                Queste azioni sono definitive e non possono essere annullate.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <DangerRow
              title="Cancella tutti i dati"
              description="Elimina transazioni, spese ricorrenti e obiettivi. L'account resta attivo."
              action={
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" className="border-rose-soft/40 text-rose-soft hover:bg-rose-soft/10 hover:text-rose-soft">
                      Cancella dati
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Cancellare tutti i dati?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Verranno rimosse in modo permanente tutte le tue transazioni, spese ricorrenti e obiettivi.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annulla</AlertDialogCancel>
                      <AlertDialogAction onClick={handleWipe} disabled={wiping}>
                        {wiping ? <Loader2 className="size-4 animate-spin" /> : "Sì, cancella"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              }
            />

            <DangerRow
              title="Elimina account"
              description="Rimuove l'account e tutti i dati associati. Non potrai più accedere."
              action={
                <AlertDialog onOpenChange={(open) => !open && setConfirmText("")}>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive">Elimina account</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Eliminare l'account?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Questa azione è irreversibile. Per confermare, digita il tuo username
                        <span className="font-mono text-foreground"> {profile?.username ?? ""}</span>.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <Input
                      value={confirmText}
                      onChange={(e) => setConfirmText(e.target.value)}
                      placeholder={profile?.username ?? "username"}
                      className="mt-2"
                    />
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annulla</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDelete}
                        disabled={deleting || confirmText.trim() !== (profile?.username ?? "")}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {deleting ? <Loader2 className="size-4 animate-spin" /> : "Elimina definitivamente"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              }
            />
          </div>
        </section>
      </main>
    </div>
  );
}

function Section({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/[0.06] bg-card p-6">
      <div className="flex items-start gap-3 mb-5">
        <div className="size-8 rounded-lg bg-mint/10 text-mint flex items-center justify-center shrink-0">
          {icon}
        </div>
        <div>
          <h2 className="font-display text-lg">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-white/5 bg-background/40 p-4">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function DangerRow({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-white/5 bg-background/40 p-4">
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  );
}