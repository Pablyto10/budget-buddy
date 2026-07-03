// Server functions per la capture multimodale:
// - transcribeAudio: audio (base64) → testo via Lovable AI (gpt-4o-mini-transcribe)
// - parseReceipt:    immagine (base64) → { amount, merchant, category, date } via Gemini Vision
// - parseText:       testo libero → transazione strutturata (fallback per la voce)
//
// Chiamate lato client tramite `useServerFn` — la LOVABLE_API_KEY resta server-side.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GATEWAY = "https://ai.gateway.lovable.dev/v1";

const EXPENSE_CATS = [
  "Alimentari",
  "Ristorazione",
  "Trasporti",
  "Casa",
  "Salute",
  "Shopping",
  "Intrattenimento",
  "Abbonamenti",
  "Viaggi",
  "Altro",
] as const;

const ParsedSchema = z.object({
  kind: z.enum(["expense", "income"]).default("expense"),
  amount: z.number().positive(),
  merchant: z.string().min(1),
  category: z.string().min(1),
  date: z.string().optional(),
  note: z.string().optional(),
});

export type ParsedTransaction = z.infer<typeof ParsedSchema>;

function apiKey() {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY non configurata");
  return key;
}

async function chatJSON(messages: unknown[]): Promise<ParsedTransaction> {
  const res = await fetch(`${GATEWAY}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages,
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Gateway ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(content);
  if (typeof parsed.amount === "string") {
    parsed.amount = parseFloat(parsed.amount.replace(",", "."));
  }
  return ParsedSchema.parse(parsed);
}

const SYSTEM_PROMPT = `Sei un assistente che estrae dati di transazioni finanziarie e restituisce SOLO JSON valido.
Schema: { "kind": "expense" | "income", "amount": number (positivo, in EUR), "merchant": string, "category": string, "date": string ISO opzionale, "note": string opzionale }.
Categorie valide per spese: ${EXPENSE_CATS.join(", ")}.
Se non riesci a determinare un campo, usa un default sensato (category="Altro"). Rispondi in italiano.`;

// ---------- Trascrizione audio ----------

export const transcribeAudio = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        audioBase64: z.string().min(20),
        mimeType: z.string().default("audio/webm"),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const bytes = Uint8Array.from(atob(data.audioBase64), (c) => c.charCodeAt(0));
    const extMap: Record<string, string> = {
      "audio/webm": "webm",
      "audio/mp4": "mp4",
      "audio/mpeg": "mp3",
      "audio/wav": "wav",
      "audio/ogg": "ogg",
    };
    const baseType = data.mimeType.split(";")[0];
    const ext = extMap[baseType] ?? "webm";
    const form = new FormData();
    form.append("model", "openai/gpt-4o-mini-transcribe");
    form.append("file", new Blob([bytes], { type: baseType }), `recording.${ext}`);
    const res = await fetch(`${GATEWAY}/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey()}` },
      body: form,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Trascrizione fallita (${res.status}): ${text.slice(0, 200)}`);
    }
    const json = (await res.json()) as { text?: string };
    const transcript = json.text?.trim() ?? "";
    if (!transcript) throw new Error("Trascrizione vuota");
    const parsed = await chatJSON([
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Estrai la transazione da questa frase parlata: "${transcript}"`,
      },
    ]);
    return { transcript, transaction: parsed };
  });

// ---------- OCR scontrino ----------

export const parseReceipt = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        imageDataUrl: z
          .string()
          .refine((s) => s.startsWith("data:image/"), "Deve essere un data URL immagine"),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const parsed = await chatJSON([
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          {
            type: "text",
            text:
              "Analizza questo scontrino/ricevuta. Estrai il totale pagato (amount), il nome del negozio (merchant), la categoria di spesa e la data (ISO). Rispondi solo con JSON.",
          },
          { type: "image_url", image_url: { url: data.imageDataUrl } },
        ],
      },
    ]);
    return { transaction: parsed };
  });

// ---------- Parse testo libero (fallback quick-add) ----------

export const parseText = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ text: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    const parsed = await chatJSON([
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `Estrai la transazione da: "${data.text}"` },
    ]);
    return { transaction: parsed };
  });
