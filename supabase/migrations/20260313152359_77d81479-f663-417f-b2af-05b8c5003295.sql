
-- ═══════════════════════════════════════════════════════════════
-- SOUPY Engine v3 — Consolidated + Extended Schema
-- ═══════════════════════════════════════════════════════════════

-- 1. Decision Traces (replaces raw reasoning chain storage for audit output)
CREATE TABLE public.decision_traces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.audit_cases(id) ON DELETE CASCADE,
  trace_entries JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Each entry: { trigger, documentationGap, counterargumentConsidered, evidenceSupporting, regulationReferenced, confidenceImpact, sufficiencyImpact, consensusImpact }
  final_recommendation TEXT,
  recommendation_rationale TEXT,
  confidence_at_completion INTEGER DEFAULT 0,
  consensus_integrity_grade TEXT DEFAULT 'not_assessed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.decision_traces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access decision_traces" ON public.decision_traces FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Users view own decision traces" ON public.decision_traces FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.audit_cases WHERE audit_cases.id = decision_traces.case_id AND audit_cases.owner_id = auth.uid()));

-- 2. Confidence Floor Events
CREATE TABLE public.confidence_floor_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.audit_cases(id) ON DELETE CASCADE,
  floor_type TEXT NOT NULL, -- 'confidence', 'consensus_integrity', 'evidence_sufficiency'
  threshold_value NUMERIC NOT NULL DEFAULT 0,
  actual_value NUMERIC NOT NULL DEFAULT 0,
  uncertainty_drivers JSONB NOT NULL DEFAULT '[]'::jsonb,
  routed_to_human BOOLEAN NOT NULL DEFAULT true,
  explanation TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.confidence_floor_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access confidence_floor_events" ON public.confidence_floor_events FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Users view own confidence floor events" ON public.confidence_floor_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.audit_cases WHERE audit_cases.id = confidence_floor_events.case_id AND audit_cases.owner_id = auth.uid()));

-- 3. Regulatory Currency Flags
CREATE TABLE public.regulatory_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES public.audit_cases(id) ON DELETE CASCADE,
  flag_type TEXT NOT NULL, -- 'cms_change', 'cpt_update', 'lcd_ncd_change', 'payer_bulletin'
  description TEXT NOT NULL,
  effective_date DATE,
  source_reference TEXT,
  severity TEXT NOT NULL DEFAULT 'advisory', -- 'advisory', 'warning', 'critical'
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.regulatory_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access regulatory_flags" ON public.regulatory_flags FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users view regulatory flags" ON public.regulatory_flags FOR SELECT TO authenticated USING (true);

-- 4. Evidence Sufficiency Scores
CREATE TABLE public.evidence_sufficiency (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.audit_cases(id) ON DELETE CASCADE,
  overall_score NUMERIC NOT NULL DEFAULT 0,
  sufficiency_for_approve NUMERIC DEFAULT 0,
  sufficiency_for_deny NUMERIC DEFAULT 0,
  sufficiency_for_info_request NUMERIC DEFAULT 0,
  sufficiency_for_appeal_defense NUMERIC DEFAULT 0,
  sufficiency_for_appeal_not_recommended NUMERIC DEFAULT 0,
  missing_evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Each: { item, category, impact, obtainable }
  is_defensible BOOLEAN DEFAULT false,
  is_under_supported BOOLEAN DEFAULT true,
  source_weights_applied JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.evidence_sufficiency ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access evidence_sufficiency" ON public.evidence_sufficiency FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Users view own evidence sufficiency" ON public.evidence_sufficiency FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.audit_cases WHERE audit_cases.id = evidence_sufficiency.case_id AND audit_cases.owner_id = auth.uid()));

-- 5. Contradictions
CREATE TABLE public.contradictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.audit_cases(id) ON DELETE CASCADE,
  contradiction_type TEXT NOT NULL, -- 'code_vs_documentation', 'modifier_conflict', 'time_documentation', 'diagnosis_intensity', 'prior_clarification'
  description TEXT NOT NULL,
  explanation TEXT,
  severity TEXT NOT NULL DEFAULT 'warning', -- 'critical', 'warning', 'info'
  source_a TEXT, -- what says one thing
  source_b TEXT, -- what says the opposite
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.contradictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access contradictions" ON public.contradictions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Users view own contradictions" ON public.contradictions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.audit_cases WHERE audit_cases.id = contradictions.case_id AND audit_cases.owner_id = auth.uid()));

-- 6. Appeal Outcomes (extends payer intelligence)
CREATE TABLE public.appeal_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payer_code TEXT,
  denial_type TEXT,
  cpt_codes TEXT[] DEFAULT '{}',
  appeal_strategy TEXT, -- 'rebuttal', 'additional_documentation', 'modifier_explanation', 'recoding', 'peer_review'
  evidence_package JSONB DEFAULT '[]'::jsonb,
  outcome TEXT NOT NULL, -- 'overturned', 'upheld', 'partial', 'withdrawn'
  success_factors JSONB DEFAULT '[]'::jsonb,
  failure_factors JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  case_id UUID REFERENCES public.audit_cases(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.appeal_outcomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access appeal_outcomes" ON public.appeal_outcomes FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users view appeal outcomes" ON public.appeal_outcomes FOR SELECT TO authenticated USING (true);

-- 7. Source Weights
CREATE TABLE public.source_weights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type TEXT NOT NULL UNIQUE, -- 'operative_note', 'physician_attestation', 'nursing_notes', 'ehr_timestamp', 'lab_results', 'admin_data', 'billing_system'
  base_weight NUMERIC NOT NULL DEFAULT 1.0,
  recency_decay_days INTEGER DEFAULT 365,
  description TEXT,
  is_primary_clinical BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.source_weights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access source_weights" ON public.source_weights FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users view source weights" ON public.source_weights FOR SELECT TO authenticated USING (true);

-- 8. Gold Set Cases (locked benchmark set, separate from ghost_cases)
CREATE TABLE public.gold_set_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_label TEXT NOT NULL,
  case_template JSONB NOT NULL,
  known_outcome JSONB NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  is_locked BOOLEAN NOT NULL DEFAULT true,
  last_replayed_at TIMESTAMPTZ,
  total_replays INTEGER DEFAULT 0,
  total_correct INTEGER DEFAULT 0,
  accuracy_rate NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.gold_set_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access gold_set_cases" ON public.gold_set_cases FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users view gold set cases" ON public.gold_set_cases FOR SELECT TO authenticated USING (true);

-- 9. Minimal Winning Packets
CREATE TABLE public.minimal_winning_packets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.audit_cases(id) ON DELETE CASCADE,
  checklist JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Each: { item, category, priority, isMissing, isCurable, effort, impactIfObtained }
  top_priority_item TEXT,
  estimated_curable_count INTEGER DEFAULT 0,
  estimated_not_worth_chasing INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.minimal_winning_packets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access minimal_winning_packets" ON public.minimal_winning_packets FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Users view own minimal winning packets" ON public.minimal_winning_packets FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.audit_cases WHERE audit_cases.id = minimal_winning_packets.case_id AND audit_cases.owner_id = auth.uid()));

-- 10. Action Pathway Recommendations
CREATE TABLE public.action_pathways (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.audit_cases(id) ON DELETE CASCADE,
  recommended_action TEXT NOT NULL, -- 'approve', 'pend_for_records', 'modifier_clarification', 'admin_correction', 'route_to_human', 'build_pre_appeal', 'not_recommended_for_appeal'
  action_rationale TEXT NOT NULL,
  confidence_in_recommendation INTEGER DEFAULT 0,
  input_factors JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- { riskScore, evidenceSufficiency, contradictionCount, payerPattern, confidenceFloorStatus, sourceWeighting }
  alternative_actions JSONB DEFAULT '[]'::jsonb,
  is_human_review_required BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.action_pathways ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access action_pathways" ON public.action_pathways FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Users view own action pathways" ON public.action_pathways FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.audit_cases WHERE audit_cases.id = action_pathways.case_id AND audit_cases.owner_id = auth.uid()));

-- Seed source weights
INSERT INTO public.source_weights (source_type, base_weight, is_primary_clinical, description) VALUES
  ('operative_note', 1.0, true, 'Primary surgical documentation — highest evidentiary weight'),
  ('physician_attestation', 0.95, true, 'Direct physician documentation or attestation'),
  ('nursing_notes', 0.8, true, 'Clinical nursing documentation'),
  ('ehr_timestamp', 0.75, false, 'Electronic health record system timestamps'),
  ('lab_results', 0.85, true, 'Laboratory and diagnostic test results'),
  ('imaging_report', 0.85, true, 'Radiology and imaging reports'),
  ('medication_administration', 0.7, true, 'Medication administration records'),
  ('billing_system', 0.4, false, 'Administrative billing system data'),
  ('admin_data', 0.3, false, 'Downstream administrative or claims data'),
  ('prior_authorization', 0.6, false, 'Prior authorization documentation');

-- Seed gold set cases (locked benchmark set)
INSERT INTO public.gold_set_cases (case_label, case_template, known_outcome, category) VALUES
  ('GS-001: Clear Critical Care', '{"cpt_codes":["99291","99292"],"icd_codes":["I21.0","R06.02"],"claim_amount":3800,"source_text":"STEMI with documented critical care time 98 minutes. Full time log present. Separate procedures excluded.","physician_name":"Gold Set Provider","patient_id":"GS-PT-001","physician_id":"GS-DR-001","date_of_service":"2024-01-15","summary":"Clear critical care case with full documentation"}'::jsonb, '{"expected_risk_level":"low","expected_consensus_range":[75,100],"expected_action":"approve","expected_contradictions":0,"key_test":"Should approve with strong evidence"}'::jsonb, 'critical_care'),
  ('GS-002: Unbundling Violation', '{"cpt_codes":["29880","29881"],"icd_codes":["M23.21","M17.11"],"claim_amount":5200,"source_text":"Arthroscopic meniscectomy. Operative note describes medial meniscus tear only. No documentation of lateral compartment work.","physician_name":"Gold Set Provider","patient_id":"GS-PT-002","physician_id":"GS-DR-001","date_of_service":"2024-02-10","summary":"Likely unbundling — both meniscectomy codes billed but only medial documented"}'::jsonb, '{"expected_risk_level":"critical","expected_consensus_range":[20,50],"expected_action":"deny","expected_contradictions":1,"key_test":"Should identify unbundling and flag contradiction between codes and documentation"}'::jsonb, 'unbundling'),
  ('GS-003: Documentation Gap', '{"cpt_codes":["99285","99291"],"icd_codes":["J96.01"],"claim_amount":3200,"source_text":"ED Level 5 with critical care. No critical care time log. No MDM documentation. Nursing notes reference intubation.","physician_name":"Gold Set Provider","patient_id":"GS-PT-003","physician_id":"GS-DR-002","date_of_service":"2024-03-01","summary":"Documentation insufficient to support billed codes despite clinical acuity"}'::jsonb, '{"expected_risk_level":"high","expected_consensus_range":[30,60],"expected_action":"pend_for_records","expected_contradictions":1,"key_test":"Should identify documentation gap and recommend pend rather than deny"}'::jsonb, 'documentation_gap');

-- Seed regulatory flags (placeholder admin-managed entries)
INSERT INTO public.regulatory_flags (flag_type, description, effective_date, source_reference, severity) VALUES
  ('cms_change', 'CMS CY2025 OPPS Final Rule — updated critical care bundling guidance', '2025-01-01', 'CMS-1808-FC', 'warning'),
  ('cpt_update', 'AMA CPT 2025 — revised E/M documentation guidelines for emergency services', '2025-01-01', 'AMA CPT Professional Edition 2025', 'advisory'),
  ('lcd_ncd_change', 'LCD L38808 — updated coverage criteria for arthroscopic knee procedures', '2025-04-01', 'CMS LCD L38808 Rev 4', 'warning');
