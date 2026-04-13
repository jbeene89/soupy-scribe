
-- OR Readiness & Sterile Integrity Events
CREATE TABLE public.or_readiness_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID REFERENCES public.audit_cases(id) ON DELETE CASCADE,
  room_id TEXT,
  event_type TEXT NOT NULL DEFAULT 'other',
  delay_minutes INTEGER DEFAULT 0,
  replacement_source TEXT,
  patient_wait_status TEXT DEFAULT 'stable',
  classification TEXT NOT NULL DEFAULT 'isolated',
  vendor_rep TEXT,
  service_line TEXT,
  shift TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.or_readiness_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access or_readiness_events"
  ON public.or_readiness_events FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Users view own or_readiness_events"
  ON public.or_readiness_events FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM audit_cases WHERE audit_cases.id = or_readiness_events.case_id AND audit_cases.owner_id = auth.uid()
  ));

CREATE POLICY "Users create own or_readiness_events"
  ON public.or_readiness_events FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM audit_cases WHERE audit_cases.id = or_readiness_events.case_id AND audit_cases.owner_id = auth.uid()
  ));

-- Case-Triage Accuracy Events
CREATE TABLE public.triage_accuracy_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID REFERENCES public.audit_cases(id) ON DELETE CASCADE,
  booker_name TEXT,
  surgeon_name TEXT,
  service_line TEXT,
  expected_procedure TEXT,
  actual_procedure TEXT,
  expected_duration INTEGER,
  actual_duration INTEGER,
  expected_implant TEXT,
  actual_implant TEXT,
  extra_equipment TEXT[],
  unplanned_support TEXT[],
  foreseeability_score NUMERIC DEFAULT 0,
  foreseeability_class TEXT DEFAULT 'unavoidable',
  complexity_delta NUMERIC DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.triage_accuracy_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access triage_accuracy_events"
  ON public.triage_accuracy_events FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Users view own triage_accuracy_events"
  ON public.triage_accuracy_events FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM audit_cases WHERE audit_cases.id = triage_accuracy_events.case_id AND audit_cases.owner_id = auth.uid()
  ));

CREATE POLICY "Users create own triage_accuracy_events"
  ON public.triage_accuracy_events FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM audit_cases WHERE audit_cases.id = triage_accuracy_events.case_id AND audit_cases.owner_id = auth.uid()
  ));

-- Post-Op Flow Events
CREATE TABLE public.postop_flow_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID REFERENCES public.audit_cases(id) ON DELETE CASCADE,
  patient_wait_minutes INTEGER DEFAULT 0,
  staff_idle_minutes INTEGER DEFAULT 0,
  delay_reason TEXT,
  facility TEXT,
  surgeon_name TEXT,
  service_line TEXT,
  day_of_week TEXT,
  shift TEXT,
  bed_available BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.postop_flow_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access postop_flow_events"
  ON public.postop_flow_events FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Users view own postop_flow_events"
  ON public.postop_flow_events FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM audit_cases WHERE audit_cases.id = postop_flow_events.case_id AND audit_cases.owner_id = auth.uid()
  ));

CREATE POLICY "Users create own postop_flow_events"
  ON public.postop_flow_events FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM audit_cases WHERE audit_cases.id = postop_flow_events.case_id AND audit_cases.owner_id = auth.uid()
  ));
