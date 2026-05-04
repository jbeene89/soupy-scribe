
ALTER TABLE public.appeal_outcomes
  ADD COLUMN IF NOT EXISTS is_quarantined BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS quarantine_reason TEXT;

CREATE TABLE IF NOT EXISTS public.payer_anomaly_flags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payer_code TEXT NOT NULL,
  anomaly_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'warning',
  denial_count INTEGER NOT NULL DEFAULT 0,
  window_days INTEGER NOT NULL DEFAULT 14,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.payer_anomaly_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access payer_anomaly_flags"
  ON public.payer_anomaly_flags FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can view active payer anomalies"
  ON public.payer_anomaly_flags FOR SELECT
  TO authenticated USING (is_active = true);

CREATE TRIGGER update_payer_anomaly_flags_updated_at
  BEFORE UPDATE ON public.payer_anomaly_flags
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.novel_code_cases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID NOT NULL,
  novel_codes TEXT[] NOT NULL DEFAULT '{}',
  posture TEXT NOT NULL DEFAULT 'relaxed_anchor',
  requires_human_review BOOLEAN NOT NULL DEFAULT TRUE,
  rationale TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.novel_code_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access novel_code_cases"
  ON public.novel_code_cases FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Users view own novel_code_cases"
  ON public.novel_code_cases FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.audit_cases
      WHERE audit_cases.id = novel_code_cases.case_id
        AND audit_cases.owner_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_novel_code_cases_case_id ON public.novel_code_cases(case_id);
CREATE INDEX IF NOT EXISTS idx_payer_anomaly_active ON public.payer_anomaly_flags(payer_code, is_active);
