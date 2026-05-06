-- RAC Clawback Shield schema
CREATE TABLE public.clawback_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  audit_name TEXT NOT NULL,
  contractor TEXT,
  contractor_type TEXT DEFAULT 'rac',
  demand_amount NUMERIC(14,2) DEFAULT 0,
  universe_size INTEGER,
  sample_size INTEGER,
  stratification JSONB DEFAULT '{}'::jsonb,
  audit_period_start DATE,
  audit_period_end DATE,
  notice_date DATE,
  response_deadline DATE,
  status TEXT NOT NULL DEFAULT 'intake',
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.clawback_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id UUID NOT NULL REFERENCES public.clawback_audits(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL,
  claim_number TEXT,
  patient_ref TEXT,
  date_of_service DATE,
  billed_amount NUMERIC(12,2) DEFAULT 0,
  rac_disallowed_amount NUMERIC(12,2) DEFAULT 0,
  cpt_codes TEXT[] DEFAULT '{}',
  icd_codes TEXT[] DEFAULT '{}',
  rac_finding_code TEXT,
  rac_finding_text TEXT,
  chart_file_path TEXT,
  defense_status TEXT NOT NULL DEFAULT 'pending',
  defense_strength TEXT,
  clinical_justification TEXT,
  defense_findings JSONB DEFAULT '[]'::jsonb,
  recommended_outcome TEXT,
  recovered_amount NUMERIC(12,2) DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX clawback_claims_audit_idx ON public.clawback_claims(audit_id);

CREATE TABLE public.clawback_extrapolation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id UUID NOT NULL REFERENCES public.clawback_audits(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL,
  cms_compliance JSONB DEFAULT '{}'::jsonb,
  procedural_defects JSONB DEFAULT '[]'::jsonb,
  rac_point_estimate NUMERIC(14,2),
  rac_demand NUMERIC(14,2),
  recomputed_point_estimate NUMERIC(14,2),
  recomputed_lower_ci NUMERIC(14,2),
  precision_pct NUMERIC(6,3),
  reduced_exposure NUMERIC(14,2),
  exposure_delta NUMERIC(14,2),
  leverage_score INTEGER DEFAULT 0,
  attack_summary TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX clawback_extrapolation_audit_uniq ON public.clawback_extrapolation(audit_id);

CREATE TABLE public.clawback_defense_packets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id UUID NOT NULL REFERENCES public.clawback_audits(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  storage_path TEXT,
  leverage_score INTEGER,
  summary JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.clawback_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clawback_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clawback_extrapolation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clawback_defense_packets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners manage clawback_audits" ON public.clawback_audits
  FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "owners manage clawback_claims" ON public.clawback_claims
  FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "owners manage clawback_extrapolation" ON public.clawback_extrapolation
  FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "owners manage clawback_defense_packets" ON public.clawback_defense_packets
  FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE TRIGGER clawback_audits_updated BEFORE UPDATE ON public.clawback_audits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER clawback_claims_updated BEFORE UPDATE ON public.clawback_claims
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER clawback_extrapolation_updated BEFORE UPDATE ON public.clawback_extrapolation
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('clawback-files', 'clawback-files', false)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "users read own clawback files" ON storage.objects FOR SELECT
  USING (bucket_id = 'clawback-files' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "users upload own clawback files" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'clawback-files' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "users update own clawback files" ON storage.objects FOR UPDATE
  USING (bucket_id = 'clawback-files' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "users delete own clawback files" ON storage.objects FOR DELETE
  USING (bucket_id = 'clawback-files' AND auth.uid()::text = (storage.foldername(name))[1]);