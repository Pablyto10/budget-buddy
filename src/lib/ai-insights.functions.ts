// Server functions per la sezione "Consigli finanziari":
// - getPersonalizedInsight: consiglio personalizzato basato su spese + obiettivi
// - getMotivationalQuote:  citazione motivazionale/finanziaria da personaggio famoso
// - getGoalPlan:           piano di risparmio per un obiettivo (mensile + eventuali tagli)
//
// Tutte le chiamate passano via Lovable AI Gateway usando LOVABLE_API_KEY server-side.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GATEWAY = "https://ai.gateway.lovable.dev/v1";
const MODEL = "google/gemini-2.5-flash";

function apiKey() {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY non configurata");
  return key;
}

// La chiave manca finché l'utente non abilita "Lovable AI" sul progetto: è una
// condizione attesa, non un bug. La segnaliamo come esito normale (available:
// false) invece di lanciare, perché un throw dentro l'handler di un server
// function può risalire per un percorso di serializzazione dell'errore
// inconsistente tra dev e produzione e mandare in schermo bianco il client.
function hasApiKey(): boolean {
  return Boolean(process.env.LOVABLE_API_KEY);
}

async function chatJSON<T>(messages: unknown[]): Promise<T> {
  const res = await fetch(`${GATEWAY}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
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
  return JSON.parse(content) as T;
}

// ---------- Schemi ----------

const TxLite = z.object({
  kind: z.enum(["expense", "income"]),
  amount: z.number(),
  merchant: z.string(),
  category: z.string(),
  date: z.string(),
});

const GoalLite = z.object({
  title: z.string(),
  targetAmount: z.number(),
  savedAmount: z.number(),
  deadline: z.string(),
});

const InsightSchema = z.object({
  headline: z.string(), // frase breve, tono coach ("Ogni sabato spendi 3× di più...")
  body: z.string(), // spiegazione + azione concreta con numeri
  savingEstimate: z.number().nullish().transform((v) => v ?? undefined),
  linkedGoal: z.string().nullish().transform((v) => v ?? undefined),
});

const QuoteSchema = z.object({
  quote: z.string(),
  author: z.string(),
  reflection: z.string(), // 1 frase che collega la citazione alla finanza personale
});

const GoalPlanSchema = z.object({
  monthlyRequired: z.number(),
  feasible: z.boolean(),
  headline: z.string(),
  body: z.string(),
  cuts: z
    .array(
      z.object({
        area: z.string(),
        amount: z.number(),
        rationale: z.string(),
      }),
    )
    .default([]),
});

// ---------- Endpoints ----------

export const getPersonalizedInsight = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        transactions: z.array(TxLite),
        goals: z.array(GoalLite).default([]),
        monthlySubscriptions: z.number().default(0),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    if (!hasApiKey()) return { available: false as const };
    const system = `Sei un coach finanziario italiano, diretto e concreto.
Analizza le spese e restituisci UN SOLO consiglio azionabile, con numeri realistici in euro.
Se ci sono obiettivi, collega il consiglio a uno di essi ("...ti avviciniresti di €X al tuo obiettivo Y").
Rispondi in italiano, tono caldo ma preciso. Rispondi SOLO JSON con schema:
{ "headline": string (max 90 caratteri, tra virgolette non serve), "body": string (max 220 caratteri, azione concreta), "savingEstimate": number opzionale (€/mese), "linkedGoal": string opzionale (titolo obiettivo) }`;
    const payload = {
      transactions: data.transactions.slice(0, 80),
      goals: data.goals,
      monthlySubscriptions: data.monthlySubscriptions,
    };
    const parsed = await chatJSON<unknown>([
      { role: "system", content: system },
      { role: "user", content: JSON.stringify(payload) },
    ]);
    return { available: true as const, ...InsightSchema.parse(parsed) };
  });

export const getMotivationalQuote = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ seed: z.string().optional() }).parse(data))
  .handler(async ({ data }) => {
    if (!hasApiKey()) return { available: false as const };
    const system = `Sei un curatore di citazioni. Scegli UNA citazione autentica su denaro,
risparmio, investimento, disciplina finanziaria o mentalità imprenditoriale, di un personaggio
famoso reale (es. Warren Buffett, Charlie Munger, Benjamin Franklin, Seneca, Naval Ravikant,
Ray Dalio, Robert Kiyosaki, Morgan Housel, ecc.). Alterna gli autori, evita banalità.
Rispondi SOLO JSON in italiano: { "quote": "...", "author": "Nome Cognome", "reflection": "una frase (max 160 caratteri) che collega la citazione alla vita finanziaria quotidiana" }.
Traduci la citazione in italiano se necessario, restando fedele al senso.`;
    const parsed = await chatJSON<unknown>([
      { role: "system", content: system },
      {
        role: "user",
        content: `Genera una nuova citazione. Seme casuale: ${data.seed ?? Math.random().toString(36).slice(2)}`,
      },
    ]);
    return { available: true as const, ...QuoteSchema.parse(parsed) };
  });

export const getGoalPlan = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        goal: GoalLite,
        monthlyIncome: z.number(),
        monthlyExpenses: z.number(),
        monthlySubscriptions: z.number(),
        topCategories: z
          .array(z.object({ category: z.string(), amount: z.number() }))
          .default([]),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { goal } = data;
    const monthsLeft = Math.max(
      1,
      Math.ceil((new Date(goal.deadline).getTime() - Date.now()) / (30 * 86400000)),
    );
    const remaining = Math.max(0, goal.targetAmount - goal.savedAmount);
    const monthlyRequired = remaining / monthsLeft;
    const surplus = data.monthlyIncome - data.monthlyExpenses;

    if (!hasApiKey()) return { available: false as const };

    const system = `Sei un coach finanziario italiano. In base ai dati fornisci un piano per raggiungere l'obiettivo.
Se il surplus mensile è sufficiente, conferma la fattibilità e dai UN suggerimento per accelerare.
Se NON è sufficiente, proponi 1-3 tagli concreti (categoria + € risparmiabili/mese + motivazione breve).
Rispondi SOLO JSON: {
  "monthlyRequired": number,
  "feasible": boolean,
  "headline": string (max 90 caratteri),
  "body": string (max 240 caratteri),
  "cuts": [{ "area": string, "amount": number, "rationale": string }]
}. In italiano.`;
    const payload = {
      goal,
      monthsLeft,
      remaining,
      monthlyRequired,
      monthlyIncome: data.monthlyIncome,
      monthlyExpenses: data.monthlyExpenses,
      monthlySubscriptions: data.monthlySubscriptions,
      surplus,
      topCategories: data.topCategories,
    };
    const parsed = await chatJSON<Record<string, unknown>>([
      { role: "system", content: system },
      { role: "user", content: JSON.stringify(payload) },
    ]);
    // Forza monthlyRequired coerente (calcolato server-side per evitare drift del modello)
    parsed.monthlyRequired = Number(monthlyRequired.toFixed(2));
    return { available: true as const, ...GoalPlanSchema.parse(parsed) };
  });
