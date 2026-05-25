
CREATE TABLE public.recovery_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  patient_ref TEXT,
  payer TEXT,
  date_of_service DATE,
  encounter_excerpt TEXT,
  lenses_run TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  total_dollars_at_risk NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_dollars_recoverable NUMERIC(14,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  error TEXT,
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.recovery_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own recovery runs" ON public.recovery_runs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own recovery runs" ON public.recovery_runs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own recovery runs" ON public.recovery_runs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own recovery runs" ON public.recovery_runs FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_recovery_runs_updated
BEFORE UPDATE ON public.recovery_runs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_recovery_runs_user ON public.recovery_runs(user_id, created_at DESC);

CREATE TABLE public.recovery_findings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES public.recovery_runs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  lens TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'pre-bill',
  title TEXT NOT NULL,
  description TEXT,
  evidence_snippet TEXT,
  code TEXT,
  confidence TEXT NOT NULL DEFAULT 'medium',
  dollars_at_risk NUMERIC(14,2) NOT NULL DEFAULT 0,
  dollars_recoverable NUMERIC(14,2) NOT NULL DEFAULT 0,
  dedup_cluster_key TEXT,
  is_primary_in_cluster BOOLEAN NOT NULL DEFAULT true,
  recommended_action TEXT,
  source_ref TEXT,
  resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_note TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.recovery_findings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own recovery findings" ON public.recovery_findings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own recovery findings" ON public.recovery_findings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own recovery findings" ON public.recovery_findings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own recovery findings" ON public.recovery_findings FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_recovery_findings_updated
BEFORE UPDATE ON public.recovery_findings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_recovery_findings_run ON public.recovery_findings(run_id, dollars_recoverable DESC);
CREATE INDEX idx_recovery_findings_user ON public.recovery_findings(user_id, created_at DESC);
