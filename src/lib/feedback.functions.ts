import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ID del blocco "table" nella pagina Notion pubblica "Segnalazioni Test".
const NOTION_TABLE_BLOCK_ID = "3976bc44-9028-800f-810e-ed910c308a78";
const GATEWAY_URL = "https://connector-gateway.lovable.dev/notion";

const feedbackSchema = z.object({
  message: z.string().trim().min(3, "Scrivi almeno qualche parola").max(2000, "Massimo 2000 caratteri"),
});

export const submitFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => feedbackSchema.parse(data))
  .handler(async ({ data, context }) => {
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    const NOTION_API_KEY = process.env.NOTION_API_KEY;
    if (!LOVABLE_API_KEY || !NOTION_API_KEY) {
      throw new Error("Integrazione Notion non configurata.");
    }

    const email = (context.claims as { email?: string })?.email ?? "";
    const cellText = `[${email || "utente"}] ${data.message}`;

    const res = await fetch(`${GATEWAY_URL}/v1/blocks/${NOTION_TABLE_BLOCK_ID}/children`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": NOTION_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        children: [
          {
            type: "table_row",
            table_row: {
              cells: [
                [{ type: "text", text: { content: cellText.slice(0, 2000) } }],
                [],
              ],
            },
          },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`[feedback] Notion ${res.status}: ${body}`);
      throw new Error("Impossibile inviare la segnalazione. Riprova.");
    }

    return { ok: true };
  });