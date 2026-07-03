import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { Database } from "@/integrations/supabase/types";

const usernamePasswordSchema = z.object({
  username: z.string().trim().min(1, "Inserisci lo username"),
  password: z.string().min(1, "Inserisci la password"),
});

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request
        ? input.headers
        : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    if (
      isNewSupabaseApiKey(supabaseKey) &&
      headers.get("Authorization") === `Bearer ${supabaseKey}`
    ) {
      headers.delete("Authorization");
    }

    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

function createAuthClient() {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new Error("Configurazione Supabase mancante");
  }

  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: { fetch: createSupabaseFetch(SUPABASE_PUBLISHABLE_KEY) },
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}

export const signInWithUsername = createServerFn({ method: "POST" })
  .inputValidator((data) => usernamePasswordSchema.parse(data))
  .handler(async ({ data }) => {
    const username = data.username.trim();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .ilike("username", escapeLikePattern(username))
      .maybeSingle();

    if (profileError) {
      console.error("[auth] username lookup error", profileError);
      throw new Error("USER o password non corretti.");
    }

    if (!profile) {
      throw new Error("USER o password non corretti.");
    }

    const { data: authUser, error: userError } =
      await supabaseAdmin.auth.admin.getUserById(profile.id);

    const email = authUser.user?.email;
    if (userError || !email) {
      console.error("[auth] user lookup error", userError);
      throw new Error("USER o password non corretti.");
    }

    const authClient = createAuthClient();
    const { data: sessionData, error: signInError } =
      await authClient.auth.signInWithPassword({
        email,
        password: data.password,
      });

    if (signInError) {
      const message = signInError.message.toLowerCase();
      if (message.includes("email not confirmed")) {
        throw new Error("Conferma prima l'account dalla mail ricevuta.");
      }
      throw new Error("USER o password non corretti.");
    }

    if (!sessionData.session) {
      throw new Error("Accesso non completato. Riprova.");
    }

    return {
      accessToken: sessionData.session.access_token,
      refreshToken: sessionData.session.refresh_token,
    };
  });