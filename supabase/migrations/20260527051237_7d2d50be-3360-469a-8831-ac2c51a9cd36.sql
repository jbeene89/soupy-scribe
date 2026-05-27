
CREATE TABLE public.capacity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid,
  case_id uuid,
  unit text NOT NULL,
  shift text,
  day_of_week text,
  event_date date DEFAULT CURRENT_DATE,
  staffed_beds integer NOT NULL DEFAULT 0,
  occupied_beds integer NOT NULL DEFAULT 0,
  nurses_on_shift numeric NOT NULL DEFAULT 0,
  target_ratio numeric NOT NULL DEFAULT 4,
  actual_ratio numeric NOT NULL DEFAULT 0,
  classification text NOT NULL DEFAULT 'balanced',
  estimated_impact numeric NOT NULL DEFAULT 0,
  impact_direction text NOT NULL DEFAULT 'neutral',
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.capacity_events TO authenticated;
GRANT ALL ON public.capacity_events TO service_role;

ALTER TABLE public.capacity_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access capacity_events"
ON public.capacity_events FOR ALL TO service_role
USING (true) WITH CHECK (true);

CREATE POLICY "Users view org or own capacity_events"
ON public.capacity_events FOR SELECT TO authenticated
USING (
  (org_id IN (SELECT user_org_ids(auth.uid())))
  OR (EXISTS (SELECT 1 FROM audit_cases WHERE audit_cases.id = capacity_events.case_id AND audit_cases.owner_id = auth.uid()))
);

CREATE POLICY "Users create org or own capacity_events"
ON public.capacity_events FOR INSERT TO authenticated
WITH CHECK (
  ((org_id IS NULL) OR (org_id IN (SELECT user_org_ids(auth.uid()))))
  AND ((case_id IS NULL) OR (EXISTS (SELECT 1 FROM audit_cases WHERE audit_cases.id = capacity_events.case_id AND audit_cases.owner_id = auth.uid())))
  AND ((org_id IS NOT NULL) OR (case_id IS NOT NULL))
);

CREATE INDEX idx_capacity_events_org ON public.capacity_events(org_id);
CREATE INDEX idx_capacity_events_unit ON public.capacity_events(unit);
CREATE INDEX idx_capacity_events_created ON public.capacity_events(created_at DESC);
