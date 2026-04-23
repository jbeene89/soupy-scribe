-- Imaging Audit module: AI vision analysis of clinical images (X-rays, etc.)
-- linked to patient/physician/case so findings flow through System Impact.

CREATE TABLE public.imaging_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid REFERENCES public.audit_cases(id) ON DELETE CASCADE,
  org_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  patient_id text,
  physician_name text,
  procedure_label text,                       -- e.g. "Right TKA — primary"
  body_region text,                           -- knee, hip, shoulder, etc.
  expected_implant_count int DEFAULT 0,
  detected_implant_count int DEFAULT 0,
  image_storage_path text,                    -- bucket key in case-files
  image_file_name text,
  image_mime_type text,
  ai_summary text,                            -- short headline ("Two implants detected, alignment normal")
  ai_findings jsonb NOT NULL DEFAULT '[]'::jsonb,  -- [{label, severity, detail}]
  ai_confidence numeric DEFAULT 0,            -- 0-100
  estimated_loss numeric DEFAULT 0,           -- $ revenue/risk impact
  severity text NOT NULL DEFAULT 'low',       -- low | medium | high | critical
  status text NOT NULL DEFAULT 'analyzed',    -- analyzing | analyzed | reviewed | dismissed
  reviewer_notes text,
  metadata jsonb DEFAULT '{}'::jsonb,
  owner_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX imaging_findings_case_idx ON public.imaging_findings(case_id);
CREATE INDEX imaging_findings_owner_idx ON public.imaging_findings(owner_id);
CREATE INDEX imaging_findings_org_idx ON public.imaging_findings(org_id);
CREATE INDEX imaging_findings_patient_idx ON public.imaging_findings(patient_id);
CREATE INDEX imaging_findings_physician_idx ON public.imaging_findings(physician_name);

ALTER TABLE public.imaging_findings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access imaging_findings"
  ON public.imaging_findings FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Users view own or org imaging_findings"
  ON public.imaging_findings FOR SELECT TO authenticated
  USING (
    owner_id = auth.uid()
    OR (org_id IS NOT NULL AND org_id IN (SELECT public.user_org_ids(auth.uid())))
    OR (case_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.audit_cases ac
      WHERE ac.id = imaging_findings.case_id AND ac.owner_id = auth.uid()
    ))
  );

CREATE POLICY "Users create own imaging_findings"
  ON public.imaging_findings FOR INSERT TO authenticated
  WITH CHECK (
    owner_id = auth.uid()
    AND (
      org_id IS NULL
      OR org_id IN (SELECT public.user_org_ids(auth.uid()))
    )
    AND (
      case_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.audit_cases ac
        WHERE ac.id = imaging_findings.case_id AND ac.owner_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users update own imaging_findings"
  ON public.imaging_findings FOR UPDATE TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "Users delete own imaging_findings"
  ON public.imaging_findings FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

CREATE TRIGGER imaging_findings_set_updated_at
BEFORE UPDATE ON public.imaging_findings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();