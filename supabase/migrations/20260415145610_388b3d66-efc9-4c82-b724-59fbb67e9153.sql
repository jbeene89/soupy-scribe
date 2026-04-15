-- ER/Acute Events
CREATE TABLE public.er_acute_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID REFERENCES public.audit_cases(id) ON DELETE SET NULL,
  org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  patient_id TEXT,
  acuity_level INTEGER DEFAULT 3,
  chief_complaint TEXT,
  arrival_method TEXT DEFAULT 'walk-in',
  triage_wait_minutes INTEGER DEFAULT 0,
  bed_assignment_minutes INTEGER DEFAULT 0,
  provider_seen_minutes INTEGER DEFAULT 0,
  disposition TEXT DEFAULT 'discharged',
  boarding_hours NUMERIC DEFAULT 0,
  left_without_seen BOOLEAN DEFAULT false,
  overcrowding_at_arrival BOOLEAN DEFAULT false,
  shift TEXT,
  day_of_week TEXT,
  department_zone TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.er_acute_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access er_acute_events" ON public.er_acute_events FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Users view org or own er_acute_events" ON public.er_acute_events FOR SELECT TO authenticated
  USING ((org_id IN (SELECT user_org_ids(auth.uid()))) OR (EXISTS (SELECT 1 FROM audit_cases WHERE audit_cases.id = er_acute_events.case_id AND audit_cases.owner_id = auth.uid())));

CREATE POLICY "Users create org or own er_acute_events" ON public.er_acute_events FOR INSERT TO authenticated
  WITH CHECK ((org_id IN (SELECT user_org_ids(auth.uid()))) OR (EXISTS (SELECT 1 FROM audit_cases WHERE audit_cases.id = er_acute_events.case_id AND audit_cases.owner_id = auth.uid())));

-- Patient Advocate Events
CREATE TABLE public.patient_advocate_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID REFERENCES public.audit_cases(id) ON DELETE SET NULL,
  org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  patient_id TEXT,
  event_category TEXT NOT NULL DEFAULT 'other',
  severity TEXT NOT NULL DEFAULT 'medium',
  description TEXT NOT NULL,
  expected_standard TEXT,
  actual_finding TEXT,
  deviation_minutes INTEGER DEFAULT 0,
  unit TEXT,
  shift TEXT,
  day_of_week TEXT,
  responsible_role TEXT,
  was_reported BOOLEAN DEFAULT false,
  resolution_status TEXT DEFAULT 'open',
  resolution_notes TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.patient_advocate_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access patient_advocate_events" ON public.patient_advocate_events FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Users view org or own patient_advocate_events" ON public.patient_advocate_events FOR SELECT TO authenticated
  USING ((org_id IN (SELECT user_org_ids(auth.uid()))) OR (EXISTS (SELECT 1 FROM audit_cases WHERE audit_cases.id = patient_advocate_events.case_id AND audit_cases.owner_id = auth.uid())));

CREATE POLICY "Users create org or own patient_advocate_events" ON public.patient_advocate_events FOR INSERT TO authenticated
  WITH CHECK ((org_id IN (SELECT user_org_ids(auth.uid()))) OR (EXISTS (SELECT 1 FROM audit_cases WHERE audit_cases.id = patient_advocate_events.case_id AND audit_cases.owner_id = auth.uid())));

-- Enable realtime for both
ALTER PUBLICATION supabase_realtime ADD TABLE public.er_acute_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.patient_advocate_events;