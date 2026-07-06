import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Cancella dati applicativi (belt & suspenders: RLS + admin)
    await supabaseAdmin.from("transactions").delete().eq("user_id", context.userId);
    await supabaseAdmin.from("subscriptions").delete().eq("user_id", context.userId);
    await supabaseAdmin.from("goals").delete().eq("user_id", context.userId);
    await supabaseAdmin.from("profiles").delete().eq("id", context.userId);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(context.userId);
    if (error) {
      console.error("[account] deleteUser error", error);
      throw new Error("Impossibile eliminare l'account. Riprova.");
    }
    return { ok: true };
  });

export const wipeMyData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const r1 = await supabase.from("transactions").delete().eq("user_id", userId);
    const r2 = await supabase.from("subscriptions").delete().eq("user_id", userId);
    const r3 = await supabase.from("goals").delete().eq("user_id", userId);
    if (r1.error || r2.error || r3.error) {
      throw new Error("Impossibile cancellare i dati. Riprova.");
    }
    return { ok: true };
  });