// Finance store backed by Supabase. Ogni utente autenticato ha i propri
// transactions / subscriptions / goals persistiti nel database, con RLS.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";

export type TxKind = "expense" | "income";

export type Transaction = {
  id: string;
  kind: TxKind;
  amount: number;
  merchant: string;
  category: string;
  note?: string;
  date: string;
  source?: "manual" | "voice" | "photo" | "sync";
};

export type BillingCycle = "monthly" | "yearly" | "weekly" | "quarterly";

export const CYCLES: { value: BillingCycle; label: string }[] = [
  { value: "weekly", label: "Settimanale" },
  { value: "monthly", label: "Mensile" },
  { value: "quarterly", label: "Trimestrale" },
  { value: "yearly", label: "Annuale" },
];

export type Subscription = {
  id: string;
  name: string;
  amount: number;
  cycle: BillingCycle;
  nextRenewal: string;
  category: string;
  color?: string;
  active: boolean;
  note?: string;
};

export type Goal = {
  id: string;
  title: string;
  targetAmount: number;
  savedAmount: number;
  deadline: string;
  imageUrl?: string;
  note?: string;
  createdAt: string;
};

type State = {
  transactions: Transaction[];
  subscriptions: Subscription[];
  goals: Goal[];
};

type Ctx = State & {
  loading: boolean;
  addTransaction: (tx: Omit<Transaction, "id">) => Promise<void>;
  updateTransaction: (id: string, patch: Partial<Omit<Transaction, "id">>) => Promise<void>;
  removeTransaction: (id: string) => Promise<void>;
  addSubscription: (sub: Omit<Subscription, "id">) => Promise<void>;
  updateSubscription: (id: string, patch: Partial<Subscription>) => Promise<void>;
  removeSubscription: (id: string) => Promise<void>;
  addGoal: (
    goal: Omit<Goal, "id" | "createdAt" | "savedAmount"> & { savedAmount?: number },
  ) => Promise<void>;
  updateGoal: (id: string, patch: Partial<Goal>) => Promise<void>;
  removeGoal: (id: string) => Promise<void>;
};

const emptyState: State = { transactions: [], subscriptions: [], goals: [] };

const FinanceContext = createContext<Ctx | null>(null);

// ---------- Mappers ----------
type TxRow = {
  id: string;
  kind: string;
  amount: number | string;
  merchant: string;
  category: string;
  note: string | null;
  date: string;
  source: string | null;
};
function mapTx(r: TxRow): Transaction {
  return {
    id: r.id,
    kind: r.kind === "income" ? "income" : "expense",
    amount: Number(r.amount),
    merchant: r.merchant,
    category: r.category,
    note: r.note ?? undefined,
    date: r.date,
    source: (r.source as Transaction["source"]) ?? undefined,
  };
}

type SubRow = {
  id: string;
  name: string;
  amount: number | string;
  cycle: string;
  next_renewal: string;
  category: string;
  color: string | null;
  active: boolean;
  note: string | null;
};
function mapSub(r: SubRow): Subscription {
  return {
    id: r.id,
    name: r.name,
    amount: Number(r.amount),
    cycle: r.cycle as BillingCycle,
    nextRenewal: r.next_renewal,
    category: r.category,
    color: r.color ?? undefined,
    active: r.active,
    note: r.note ?? undefined,
  };
}

type GoalRow = {
  id: string;
  title: string;
  target_amount: number | string;
  saved_amount: number | string;
  deadline: string;
  image_url: string | null;
  note: string | null;
  created_at: string;
};
function mapGoal(r: GoalRow): Goal {
  return {
    id: r.id,
    title: r.title,
    targetAmount: Number(r.target_amount),
    savedAmount: Number(r.saved_amount),
    deadline: r.deadline,
    imageUrl: r.image_url ?? undefined,
    note: r.note ?? undefined,
    createdAt: r.created_at,
  };
}

export function FinanceProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(emptyState);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Track current user
  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (mounted) setUserId(data.user?.id ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Load data when user changes
  useEffect(() => {
    if (!userId) {
      setState(emptyState);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const [txRes, subRes, goalRes] = await Promise.all([
        supabase.from("transactions").select("*").order("date", { ascending: false }),
        supabase.from("subscriptions").select("*").order("next_renewal", { ascending: true }),
        supabase.from("goals").select("*").order("created_at", { ascending: false }),
      ]);
      if (cancelled) return;
      setState({
        transactions: (txRes.data ?? []).map((r) => mapTx(r as TxRow)),
        subscriptions: (subRes.data ?? []).map((r) => mapSub(r as SubRow)),
        goals: (goalRes.data ?? []).map((r) => mapGoal(r as GoalRow)),
      });
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const addTransaction = useCallback(
    async (tx: Omit<Transaction, "id">) => {
      if (!userId) return;
      const { data, error } = await supabase
        .from("transactions")
        .insert({
          user_id: userId,
          kind: tx.kind,
          amount: tx.amount,
          merchant: tx.merchant,
          category: tx.category,
          note: tx.note ?? null,
          date: tx.date,
          source: tx.source ?? null,
        })
        .select()
        .single();
      if (error || !data) return;
      setState((s) => ({ ...s, transactions: [mapTx(data as TxRow), ...s.transactions] }));
    },
    [userId],
  );

  const removeTransaction = useCallback(async (id: string) => {
    const { error } = await supabase.from("transactions").delete().eq("id", id);
    if (error) return;
    setState((s) => ({ ...s, transactions: s.transactions.filter((t) => t.id !== id) }));
  }, []);

  const updateTransaction = useCallback(
    async (id: string, patch: Partial<Omit<Transaction, "id">>) => {
      const dbPatch: Partial<{
        kind: string;
        amount: number;
        merchant: string;
        category: string;
        note: string | null;
        date: string;
        source: string | null;
      }> = {};
      if (patch.kind !== undefined) dbPatch.kind = patch.kind;
      if (patch.amount !== undefined) dbPatch.amount = patch.amount;
      if (patch.merchant !== undefined) dbPatch.merchant = patch.merchant;
      if (patch.category !== undefined) dbPatch.category = patch.category;
      if (patch.note !== undefined) dbPatch.note = patch.note ?? null;
      if (patch.date !== undefined) dbPatch.date = patch.date;
      if (patch.source !== undefined) dbPatch.source = patch.source ?? null;
      const { data, error } = await supabase
        .from("transactions")
        .update(dbPatch)
        .eq("id", id)
        .select()
        .single();
      if (error || !data) return;
      const mapped = mapTx(data as TxRow);
      setState((s) => ({
        ...s,
        transactions: s.transactions.map((t) => (t.id === id ? mapped : t)),
      }));
    },
    [],
  );

  const addSubscription = useCallback(
    async (sub: Omit<Subscription, "id">) => {
      if (!userId) return;
      const { data, error } = await supabase
        .from("subscriptions")
        .insert({
          user_id: userId,
          name: sub.name,
          amount: sub.amount,
          cycle: sub.cycle,
          next_renewal: sub.nextRenewal,
          category: sub.category,
          color: sub.color ?? null,
          active: sub.active,
          note: sub.note ?? null,
        })
        .select()
        .single();
      if (error || !data) return;
      setState((s) => ({ ...s, subscriptions: [mapSub(data as SubRow), ...s.subscriptions] }));
    },
    [userId],
  );

  const updateSubscription = useCallback(
    async (id: string, patch: Partial<Subscription>) => {
      const dbPatch: Partial<{
        name: string;
        amount: number;
        cycle: BillingCycle;
        next_renewal: string;
        category: string;
        color: string | null;
        active: boolean;
        note: string | null;
      }> = {};
      if (patch.name !== undefined) dbPatch.name = patch.name;
      if (patch.amount !== undefined) dbPatch.amount = patch.amount;
      if (patch.cycle !== undefined) dbPatch.cycle = patch.cycle;
      if (patch.nextRenewal !== undefined) dbPatch.next_renewal = patch.nextRenewal;
      if (patch.category !== undefined) dbPatch.category = patch.category;
      if (patch.color !== undefined) dbPatch.color = patch.color;
      if (patch.active !== undefined) dbPatch.active = patch.active;
      if (patch.note !== undefined) dbPatch.note = patch.note;
      const { data, error } = await supabase
        .from("subscriptions")
        .update(dbPatch)
        .eq("id", id)
        .select()
        .single();
      if (error || !data) return;
      const mapped = mapSub(data as SubRow);
      setState((s) => ({
        ...s,
        subscriptions: s.subscriptions.map((sub) => (sub.id === id ? mapped : sub)),
      }));
    },
    [],
  );

  const removeSubscription = useCallback(async (id: string) => {
    const { error } = await supabase.from("subscriptions").delete().eq("id", id);
    if (error) return;
    setState((s) => ({ ...s, subscriptions: s.subscriptions.filter((x) => x.id !== id) }));
  }, []);

  const addGoal = useCallback(
    async (
      goal: Omit<Goal, "id" | "createdAt" | "savedAmount"> & { savedAmount?: number },
    ) => {
      if (!userId) return;
      const { data, error } = await supabase
        .from("goals")
        .insert({
          user_id: userId,
          title: goal.title,
          target_amount: goal.targetAmount,
          saved_amount: goal.savedAmount ?? 0,
          deadline: goal.deadline,
          image_url: goal.imageUrl ?? null,
          note: goal.note ?? null,
        })
        .select()
        .single();
      if (error || !data) return;
      setState((s) => ({ ...s, goals: [mapGoal(data as GoalRow), ...s.goals] }));
    },
    [userId],
  );

  const updateGoal = useCallback(async (id: string, patch: Partial<Goal>) => {
    const dbPatch: Partial<{
      title: string;
      target_amount: number;
      saved_amount: number;
      deadline: string;
      image_url: string | null;
      note: string | null;
    }> = {};
    if (patch.title !== undefined) dbPatch.title = patch.title;
    if (patch.targetAmount !== undefined) dbPatch.target_amount = patch.targetAmount;
    if (patch.savedAmount !== undefined) dbPatch.saved_amount = patch.savedAmount;
    if (patch.deadline !== undefined) dbPatch.deadline = patch.deadline;
    if (patch.imageUrl !== undefined) dbPatch.image_url = patch.imageUrl;
    if (patch.note !== undefined) dbPatch.note = patch.note;
    const { data, error } = await supabase
      .from("goals")
      .update(dbPatch)
      .eq("id", id)
      .select()
      .single();
    if (error || !data) return;
    const mapped = mapGoal(data as GoalRow);
    setState((s) => ({ ...s, goals: s.goals.map((g) => (g.id === id ? mapped : g)) }));
  }, []);

  const removeGoal = useCallback(async (id: string) => {
    const { error } = await supabase.from("goals").delete().eq("id", id);
    if (error) return;
    setState((s) => ({ ...s, goals: s.goals.filter((g) => g.id !== id) }));
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      ...state,
      loading,
      addTransaction,
      updateTransaction,
      removeTransaction,
      addSubscription,
      updateSubscription,
      removeSubscription,
      addGoal,
      updateGoal,
      removeGoal,
    }),
    [
      state,
      loading,
      addTransaction,
      updateTransaction,
      removeTransaction,
      addSubscription,
      updateSubscription,
      removeSubscription,
      addGoal,
      updateGoal,
      removeGoal,
    ],
  );

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}

export function useFinance() {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error("useFinance must be used within FinanceProvider");
  return ctx;
}

// ---------- Helpers ----------

export function formatEUR(n: number) {
  const negative = n < 0;
  const abs = Math.abs(n);
  const [intPart, decPart = "00"] = abs.toFixed(2).split(".");
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${negative ? "-" : ""}€${grouped},${decPart}`;
}

export function monthlyEquivalent(sub: Subscription) {
  switch (sub.cycle) {
    case "monthly":
      return sub.amount;
    case "yearly":
      return sub.amount / 12;
    case "weekly":
      return (sub.amount * 52) / 12;
    case "quarterly":
      return sub.amount / 3;
  }
}

export function daysUntil(iso: string) {
  const diff = new Date(iso).getTime() - Date.now();
  return Math.ceil(diff / 86400000);
}

export function nextRenewalDate(fromISO: string, cycle: BillingCycle) {
  const d = new Date(fromISO);
  switch (cycle) {
    case "weekly":
      d.setDate(d.getDate() + 7);
      break;
    case "monthly":
      d.setMonth(d.getMonth() + 1);
      break;
    case "quarterly":
      d.setMonth(d.getMonth() + 3);
      break;
    case "yearly":
      d.setFullYear(d.getFullYear() + 1);
      break;
  }
  return d.toISOString();
}

export const EXPENSE_CATEGORIES = [
  "Abbonamenti",
  "Alimentari",
  "Benzina",
  "Bollette",
  "Carta di credito",
  "Casa",
  "Debito",
  "Fondo emergenza",
  "Intrattenimento",
  "Ristorazione",
  "Risparmio",
  "Salute",
  "Scuola",
  "Shopping",
  "Spese annuali",
  "Sport",
  "Trasporti",
  "Vestiti",
  "Veterinario",
  "Viaggi",
  "Altro",
];

export const INCOME_CATEGORIES = [
  "Stipendio",
  "Freelance",
  "Investimenti",
  "Rimborsi",
  "Regali",
  "Altro",
];

export const SUB_CATEGORIES = [
  "AI",
  "Auto",
  "Cellulari",
  "Cloud",
  "Fitness",
  "Gaming",
  "Internet",
  "Musica",
  "News",
  "Shopping",
  "Sicurezza",
  "Software",
  "Sport",
  "Streaming",
  "Utenze",
  "Altro",
];

export const SUBSCRIPTION_NAMES = [
  "Amazon",
  "Apple Music",
  "Assicurazione",
  "Blink",
  "Bollo",
  "Cellulare",
  "ChatGPT",
  "Claude",
  "Crunchyroll",
  "DAZN",
  "Gemini",
  "Google+",
  "Higgsfield",
  "Icloud",
  "Internet",
  "Netflix",
  "Nintendo Online",
  "Palestra",
  "Playstation Network",
  "Prime Video",
  "SKY",
  "Spotify",
  "Tagliando",
  "Xbox Game Pass",
  "Youtube Premium",
  "Altro",
];

export const SUBSCRIPTION_NAME_CATEGORY: Record<string, string> = {
  "Amazon": "Shopping",
  "Apple Music": "Musica",
  "Assicurazione": "Auto",
  "Blink": "Sicurezza",
  "Bollo": "Auto",
  "Cellulare": "Cellulari",
  "ChatGPT": "AI",
  "Claude": "AI",
  "Crunchyroll": "Streaming",
  "DAZN": "Streaming",
  "Gemini": "AI",
  "Google+": "Cloud",
  "Higgsfield": "AI",
  "Icloud": "Cloud",
  "Internet": "Internet",
  "Netflix": "Streaming",
  "Nintendo Online": "Gaming",
  "Palestra": "Sport",
  "Playstation Network": "Gaming",
  "Prime Video": "Streaming",
  "SKY": "Streaming",
  "Spotify": "Musica",
  "Tagliando": "Auto",
  "Xbox Game Pass": "Gaming",
  "Youtube Premium": "Streaming",
};
