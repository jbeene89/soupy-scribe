
CREATE TABLE public.hcc_sweeps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  patient_ref TEXT NOT NULL,
  payer TEXT,
  plan_year INTEGER,
  baseline_raf NUMERIC NOT NULL DEFAULT 0,
  current_raf NUMERIC NOT NULL DEFAULT 0,
  raf_delta NUMERIC NOT NULL DEFAULT 0,
  estimated_revenue_impact NUMERIC NOT NULL DEFAULT 0,
  benchmark_per_raf NUMERIC NOT NULL DEFAULT 10000,
  historical_problem_list JSONB NOT NULL DEFAULT '[]'::jsonb,
  current_encounter_text TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.hcc_suspects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sweep_id UUID NOT NULL REFERENCES public.hcc_sweeps(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  hcc_code TEXT,
  hcc_label TEXT NOT NULL,
  icd_code TEXT,
  raf_weight NUMERIC NOT NULL DEFAULT 0,
  estimated_dollar_impact NUMERIC NOT NULL DEFAULT 0,
  last_documented_date DATE,
  status TEXT NOT NULL DEFAULT 'dropped',
  confidence TEXT NOT NULL DEFAULT 'medium',
  evidence_snippet TEXT,
  recapture_recommendation TEXT,
  resolved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.hcc_sweeps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hcc_suspects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners read sweeps" ON public.hcc_sweeps FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Owners insert sweeps" ON public.hcc_sweeps FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owners update sweeps" ON public.hcc_sweeps FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Owners delete sweeps" ON public.hcc_sweeps FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Owners read suspects" ON public.hcc_suspects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Owners insert suspects" ON public.hcc_suspects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owners update suspects" ON public.hcc_suspects FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Owners delete suspects" ON public.hcc_suspects FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_hcc_sweeps_updated
BEFORE UPDATE ON public.hcc_sweeps
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_hcc_sweeps_user ON public.hcc_sweeps(user_id, created_at DESC);
CREATE INDEX idx_hcc_suspects_sweep ON public.hcc_suspects(sweep_id);


CREATE TABLE public.policy_timeline_checks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  case_id UUID,
  payer TEXT,
  policy_id TEXT NOT NULL,
  policy_type TEXT NOT NULL DEFAULT 'commercial',
  cited_policy_version TEXT,
  cited_policy_date DATE,
  date_of_service DATE NOT NULL,
  active_policy_version TEXT,
  active_policy_date DATE,
  mismatch BOOLEAN NOT NULL DEFAULT false,
  severity TEXT NOT NULL DEFAULT 'medium',
  cited_policy_excerpt TEXT,
  active_policy_excerpt TEXT,
  diff_summary TEXT,
  recommendation TEXT,
  citations JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.policy_timeline_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners read policy checks" ON public.policy_timeline_checks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Owners insert policy checks" ON public.policy_timeline_checks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owners update policy checks" ON public.policy_timeline_checks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Owners delete policy checks" ON public.policy_timeline_checks FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_policy_checks_user ON public.policy_timeline_checks(user_id, created_at DESC);
