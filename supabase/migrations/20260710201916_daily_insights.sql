-- Analisi giornaliera del coach ("Il tuo coach, oggi"): una riga per utente per
-- giorno, generata la prima volta che l'utente apre la dashboard quel giorno e
-- poi riletta dalla cache per il resto della giornata (nessuna nuova chiamata AI).
CREATE TABLE IF NOT EXISTS public.daily_insights (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  insight_date DATE NOT NULL,
  headline TEXT NOT NULL,
  body TEXT NOT NULL,
  saving_estimate NUMERIC(12,2),
  linked_goal TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, insight_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_insights TO authenticated;
GRANT ALL ON public.daily_insights TO service_role;
ALTER TABLE public.daily_insights ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own daily insights" ON public.daily_insights;
CREATE POLICY "Users manage own daily insights" ON public.daily_insights
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS daily_insights_user_date_idx ON public.daily_insights(user_id, insight_date DESC);
