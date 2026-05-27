CREATE TABLE public.writeoff_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid,
  case_id uuid,
  event_date date DEFAULT CURRENT_DATE,
  payer text NOT NULL,
  patient_account text,
  writeoff_type text NOT NULL DEFAULT 'contractual',
  amount numeric NOT NULL DEFAULT 0,
  recoverable_estimate numeric NOT NULL DEFAULT 0,
  reason_code text,
  policy_basis text,
  appeal_viable boolean NOT NULL DEFAULT false,
  classification text NOT NULL DEFAULT 'review',
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.writeoff_events TO authenticated;
GRANT ALL ON public.writeoff_events TO service_role;

ALTER TABLE public.writeoff_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access writeoff_events"
ON public.writeoff_events FOR ALL TO service_role
USING (true) WITH CHECK (true);

CREATE POLICY "Users view org or own writeoff_events"
ON public.writeoff_events FOR SELECT TO authenticated
USING (
  (org_id IN (SELECT user_org_ids(auth.uid())))
  OR (EXISTS (SELECT 1 FROM audit_cases WHERE audit_cases.id = writeoff_events.case_id AND audit_cases.owner_id = auth.uid()))
);

CREATE POLICY "Users create org or own writeoff_events"
ON public.writeoff_events FOR INSERT TO authenticated
WITH CHECK (
  ((org_id IS NULL) OR (org_id IN (SELECT user_org_ids(auth.uid()))))
  AND ((case_id IS NULL) OR (EXISTS (SELECT 1 FROM audit_cases WHERE audit_cases.id = writeoff_events.case_id AND audit_cases.owner_id = auth.uid())))
  AND ((org_id IS NOT NULL) OR (case_id IS NOT NULL))
);

CREATE INDEX idx_writeoff_events_org ON public.writeoff_events(org_id);
CREATE INDEX idx_writeoff_events_payer ON public.writeoff_events(payer);
CREATE INDEX idx_writeoff_events_type ON public.writeoff_events(writeoff_type);
CREATE INDEX idx_writeoff_events_created ON public.writeoff_events(created_at DESC);