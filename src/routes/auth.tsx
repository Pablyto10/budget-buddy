import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { signInWithUsername } from "@/lib/auth.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import logoAsset from "@/assets/wheres-my-budget-logo.png.asset.json";
import loginBgAsset from "@/assets/login-background.png.asset.json";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Accedi — Where's My Budget" },
      {
        name: "description",
        content:
          "Entra nel tuo coach finanziario personale e prendi il controllo di entrate, uscite e obiettivi.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

export const passwordSchema = z
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

export function humanizeAuthError(msg: string): string {
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

type AuthMode = "login" | "signup" | "forgot";

function AuthPage() {
  const navigate = useNavigate();
  const usernameLoginFn = useServerFn(signInWithUsername);
  const [mode, setMode] = useState<AuthMode>("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [forgotEmail, setForgotEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
      if (msg.includes("username_taken") || msg.includes("database error")) {
        toast.error("Questo username è già in uso.");
        return;
      }
      toast.error(humanizeAuthError(error.message));
      return;
    }

    if (data.user && !data.session) {
      toast.success(
        `Account creato! Controlla la tua email (${parsed.data.email}) per confermare.`,
      );
      return;
    }

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

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    const parsed = z.string().trim().email("Email non valida").safeParse(forgotEmail);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      console.error("[auth] resetPassword error", error);
      toast.error(humanizeAuthError(error.message));
      return;
    }
    toast.success("Ti abbiamo inviato un'email per reimpostare la password.");
    setMode("login");
    setForgotEmail("");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") await handleSignup();
      else await handleLogin();
    } catch (err) {
      console.error("[auth] unexpected error", err);
      toast.error(
        err instanceof Error
          ? humanizeAuthError(err.message)
          : "Errore imprevisto. Riprova.",
      );
    } finally {
      setLoading(false);
    }
  }

  const heading =
    mode === "login"
      ? "Bentornato"
      : mode === "signup"
        ? "Inizia da qui"
        : "Recupera l'accesso";

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-12">
      <img
        src={loginBgAsset.url}
        alt=""
        className="absolute inset-0 h-full w-full object-cover object-[70%_center]"
      />
      <div className="absolute inset-0 bg-background/40" />
      <div className="relative z-10 flex w-full flex-col items-center">
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
          {heading}
        </h1>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
          Il tuo coach finanziario personale, potenziato dall'AI: traccia entrate, uscite e obiettivi e scopri quanto puoi risparmiare ogni mese.
        </p>
      </div>

      <Card className="w-full max-w-md p-6 sm:p-8">
        {mode !== "forgot" && (
          <div className="mb-6 flex rounded-xl bg-muted p-1">
            <button
              type="button"
              onClick={() => setMode("login")}
              className={cn(
                "flex-1 rounded-lg py-2 text-sm font-medium transition-all",
                mode === "login"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Accedi
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={cn(
                "flex-1 rounded-lg py-2 text-sm font-medium transition-all",
                mode === "signup"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Registrati
            </button>
          </div>
        )}

        {mode === "forgot" ? (
          <form onSubmit={handleForgot} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="forgot-email">Email</Label>
              <Input
                id="forgot-email"
                type="email"
                autoComplete="email"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Attendi…" : "Invia link di recupero"}
            </Button>
            <div className="text-center">
              <button
                type="button"
                className="text-sm text-muted-foreground hover:text-foreground"
                onClick={() => setMode("login")}
              >
                ← Torna all'accesso
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="username">
                {mode === "login" ? "USER" : "Username"}
              </Label>
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
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                {mode === "login" && (
                  <button
                    type="button"
                    className="text-sm font-medium text-primary hover:underline"
                    onClick={() => setMode("forgot")}
                  >
                    Password dimenticata?
                  </button>
                )}
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={
                    mode === "signup" ? "new-password" : "current-password"
                  }
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? "Nascondi password" : "Mostra password"}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {mode === "signup" && (
                <p className="text-xs text-muted-foreground">
                  Almeno 10 caratteri, 1 numero e 1 simbolo.
                </p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading
                ? "Attendi…"
                : mode === "login"
                  ? "Accedi"
                  : "Crea account"}
            </Button>

            <div className="text-center text-sm text-muted-foreground">
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
          </form>
        )}
      </Card>
      </div>
    </div>
  );
}
