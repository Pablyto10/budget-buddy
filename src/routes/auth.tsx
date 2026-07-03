import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { signInWithUsername } from "@/lib/auth.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

const passwordSchema = z
  .string()
  .min(10, "Minimo 10 caratteri")
  .regex(/\d/, "Deve contenere almeno 1 numero")
  .regex(/[^A-Za-z0-9]/, "Deve contenere almeno 1 simbolo");

const usernameSchema = z
  .string()
  .trim()
  .min(3, "Lo username deve avere almeno 3 caratteri")
  .max(30, "Massimo 30 caratteri")
  .regex(/^[a-zA-Z0-9_.-]+$/, "Solo lettere, numeri, . _ -");

const signupSchema = z.object({
  username: usernameSchema,
  email: z.string().trim().email("Email non valida").max(255),
  password: passwordSchema,
});

const loginSchema = z.object({
  username: z.string().trim().min(1, "Inserisci lo username"),
  password: z.string().min(1, "Inserisci la password"),
});

function humanizeAuthError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("already registered") || m.includes("user already"))
    return "Questa email è già registrata.";
  if (m.includes("invalid login") || m.includes("invalid credentials"))
    return "USER o password non corretti.";
  if (m.includes("password")) return msg;
  if (m.includes("network") || m.includes("fetch"))
    return "Errore di connessione. Riprova.";
  return msg;
}

function AuthPage() {
  const navigate = useNavigate();
  const usernameLoginFn = useServerFn(signInWithUsername);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/" });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) navigate({ to: "/" });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  async function handleSignup() {
    const parsed = signupSchema.safeParse({ username, email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }

    // Crea l'utente. Il trigger handle_new_user verifica lo username
    // e inserisce il profilo nella stessa transazione: se lo username è
    // già preso, l'utente auth NON viene creato (rollback).
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { username: parsed.data.username },
      },
    });

    if (error) {
      console.error("[auth] signUp error", error);
      const msg = error.message.toLowerCase();
      // Il trigger solleva "USERNAME_TAKEN" quando lo username è duplicato;
      // Supabase lo restituisce come generica "database error saving new user".
      if (msg.includes("username_taken") || msg.includes("database error")) {
        toast.error("Questo username è già in uso.");
        return;
      }
      toast.error(humanizeAuthError(error.message));
      return;
    }

    // Se la conferma email è attiva, non c'è sessione: mostra messaggio
    // e non provare a leggere il profilo (RLS lo bloccherebbe).
    if (data.user && !data.session) {
      toast.success(
        `Account creato! Controlla la tua email (${parsed.data.email}) per confermare.`,
      );
      return;
    }

    // 3) Verifica che il profilo esista davvero (solo se già autenticato)
    if (data.user) {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", data.user.id)
        .maybeSingle();
      if (profileError) {
        console.error("[auth] profile fetch error", profileError);
      }
      if (!profile) {
        console.error("[auth] profile not created for", data.user.id);
        toast.error(
          "Registrazione parziale: contatta il supporto o riprova.",
        );
        return;
      }
    }

    toast.success(`Benvenuto ${parsed.data.username}!`);
  }

  async function handleLogin() {
    const parsed = loginSchema.safeParse({ username, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }

    const session = await usernameLoginFn({
      data: {
        username: parsed.data.username,
        password: parsed.data.password,
      },
    });

    const { error } = await supabase.auth.setSession({
      access_token: session.accessToken,
      refresh_token: session.refreshToken,
    });

    if (error) {
      console.error("[auth] signIn error", error);
      toast.error(humanizeAuthError(error.message));
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") await handleSignup();
      else await handleLogin();
    } catch (err) {
      console.error("[auth] unexpected error", err);
      toast.error("Errore imprevisto. Riprova.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-md p-8">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-foreground">
            {mode === "login" ? "Accedi" : "Crea il tuo account"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === "login"
              ? "Entra nel tuo Money Coach AI"
              : "Il tuo coach finanziario personale"}
          </p>
        </div>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="username">{mode === "login" ? "USER" : "Username"}</Label>
            <Input
              id="username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              maxLength={30}
            />
            {mode === "signup" && (
              <p className="text-xs text-muted-foreground">
                3–30 caratteri, univoco. Lettere, numeri, . _ -
              </p>
            )}
          </div>
          {mode === "signup" && (
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {mode === "signup" && (
              <p className="text-xs text-muted-foreground">
                Almeno 10 caratteri, 1 numero e 1 simbolo.
              </p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Attendi…" : mode === "login" ? "Accedi" : "Crea account"}
          </Button>
        </form>

        <div className="mt-6 text-center text-sm text-muted-foreground">
          {mode === "login" ? (
            <>
              Non hai un account?{" "}
              <button
                type="button"
                className="font-medium text-foreground underline"
                onClick={() => setMode("signup")}
              >
                Registrati
              </button>
            </>
          ) : (
            <>
              Hai già un account?{" "}
              <button
                type="button"
                className="font-medium text-foreground underline"
                onClick={() => setMode("login")}
              >
                Accedi
              </button>
            </>
          )}
        </div>

        <div className="mt-4 text-center">
          <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">
            ← Torna alla home
          </Link>
        </div>
      </Card>
    </div>
  );
}
