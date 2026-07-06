import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import logoAsset from "@/assets/wheres-my-budget-logo.png.asset.json";
import { passwordSchema, humanizeAuthError } from "@/routes/auth";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reimposta password — Where's My Budget" },
      {
        name: "description",
        content: "Scegli una nuova password sicura per proteggere i tuoi dati finanziari.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsRecovery(true);
      }
    });

    if (
      typeof window !== "undefined" &&
      window.location.hash.includes("type=recovery")
    ) {
      setIsRecovery(true);
    }

    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("Le password non coincidono.");
      return;
    }
    const parsed = passwordSchema.safeParse(password);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast.error(humanizeAuthError(error.message));
      return;
    }
    toast.success("Password aggiornata con successo!");
    navigate({ to: "/", replace: true });
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
      <div className="mb-8 flex flex-col items-center text-center">
        <div className="flex items-center gap-3">
          <img
            src={logoAsset.url}
            alt="Logo Where's My Budget"
            className="h-14 w-14 rounded-2xl bg-card p-2 shadow-sm"
          />
          <span className="font-display text-2xl font-semibold tracking-tight text-foreground">
            Where's My Budget
          </span>
        </div>
        <h1 className="mt-5 font-display text-3xl font-bold text-foreground">
          Reimposta la password
        </h1>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
          Scegli una nuova password sicura per proteggere i tuoi dati finanziari.
        </p>
      </div>

      <Card className="w-full max-w-md p-6 sm:p-8">
        {isRecovery ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="password">Nuova password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                Almeno 10 caratteri, 1 numero e 1 simbolo.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm">Conferma password</Label>
              <Input
                id="confirm"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Attendi…" : "Salva password"}
            </Button>
          </form>
        ) : (
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              Il link di recupero non è valido o è scaduto.
            </p>
            <Link
              to="/auth"
              className="mt-4 inline-block text-sm font-medium text-primary hover:underline"
            >
              Torna all'accesso
            </Link>
          </div>
        )}
      </Card>
    </div>
  );
}
