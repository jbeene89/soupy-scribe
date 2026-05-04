-- Revenue Integrity findings (standalone module)
CREATE TABLE public.revenue_integrity_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid,
  org_id uuid,
  claim_id text,
  patient_id text,
  payer_code text,
  payer_name text,
  finding_type text NOT NULL DEFAULT 'underpayment',
  severity text NOT NULL DEFAULT 'medium',
  expected_amount numeric DEFAULT 0,
  paid_amount numeric DEFAULT 0,
  variance_amount numeric DEFAULT 0,
  description text,
  source_data jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'open',
  notes text,
  date_of_service date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.revenue_integrity_findings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access revenue_integrity_findings"
  ON public.revenue_integrity_findings FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Users view own or org revenue_integrity_findings"
  ON public.revenue_integrity_findings FOR SELECT TO authenticated
  USING (
    owner_id = auth.uid()
    OR (org_id IS NOT NULL AND org_id IN (SELECT user_org_ids(auth.uid())))
  );

CREATE POLICY "Users insert own revenue_integrity_findings"
  ON public.revenue_integrity_findings FOR INSERT TO authenticated
  WITH CHECK (
    owner_id = auth.uid()
    AND (org_id IS NULL OR org_id IN (SELECT user_org_ids(auth.uid())))
  );

CREATE POLICY "Users update own revenue_integrity_findings"
  ON public.revenue_integrity_findings FOR UPDATE TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "Users delete own revenue_integrity_findings"
  ON public.revenue_integrity_findings FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

CREATE TRIGGER revenue_integrity_findings_updated_at
  BEFORE UPDATE ON public.revenue_integrity_findings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_rif_owner ON public.revenue_integrity_findings(owner_id);
CREATE INDEX idx_rif_org ON public.revenue_integrity_findings(org_id);
CREATE INDEX idx_rif_type ON public.revenue_integrity_findings(finding_type);
CREATE INDEX idx_rif_status ON public.revenue_integrity_findings(status);

-- CDI findings (Provider mode lens)
CREATE TABLE public.cdi_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL,
  finding_type text NOT NULL DEFAULT 'query_opportunity',
  severity text NOT NULL DEFAULT 'medium',
  description text NOT NULL,
  current_code text,
  suggested_code text,
  evidence_excerpt text,
  estimated_revenue_impact numeric DEFAULT 0,
  status text NOT NULL DEFAULT 'open',
  rationale text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cdi_findings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access cdi_findings"
  ON public.cdi_findings FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Users view own cdi_findings"
  ON public.cdi_findings FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.audit_cases
    WHERE audit_cases.id = cdi_findings.case_id
      AND audit_cases.owner_id = auth.uid()
  ));

CREATE POLICY "Users insert own cdi_findings"
  ON public.cdi_findings FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.audit_cases
    WHERE audit_cases.id = cdi_findings.case_id
      AND audit_cases.owner_id = auth.uid()
  ));

CREATE POLICY "Users update own cdi_findings"
  ON public.cdi_findings FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.audit_cases
    WHERE audit_cases.id = cdi_findings.case_id
      AND audit_cases.owner_id = auth.uid()
  ));

CREATE TRIGGER cdi_findings_updated_at
  BEFORE UPDATE ON public.cdi_findings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_cdi_case ON public.cdi_findings(case_id);
CREATE INDEX idx_cdi_type ON public.cdi_findings(finding_type);