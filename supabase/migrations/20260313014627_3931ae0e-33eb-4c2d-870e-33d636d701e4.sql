
-- 1. Reasoning chains: stores full reasoning from each AI role per analysis
CREATE TABLE public.reasoning_chains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.audit_cases(id) ON DELETE CASCADE,
  analysis_id UUID REFERENCES public.case_analyses(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  model TEXT NOT NULL,
  raw_reasoning TEXT,
  structured_steps JSONB DEFAULT '[]'::jsonb,
  token_count INTEGER DEFAULT 0,
  latency_ms INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Ghost cases: synthetic known-answer cases for calibration
CREATE TABLE public.ghost_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_template JSONB NOT NULL,
  known_answer JSONB NOT NULL,
  difficulty TEXT NOT NULL DEFAULT 'medium',
  category TEXT NOT NULL DEFAULT 'general',
  last_injected_at TIMESTAMPTZ,
  times_tested INTEGER DEFAULT 0,
  times_correct INTEGER DEFAULT 0,
  accuracy_rate NUMERIC(5,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Ghost case results: outcomes of ghost case injections
CREATE TABLE public.ghost_case_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ghost_case_id UUID NOT NULL REFERENCES public.ghost_cases(id) ON DELETE CASCADE,
  case_id UUID REFERENCES public.audit_cases(id) ON DELETE SET NULL,
  engine_output JSONB NOT NULL DEFAULT '{}'::jsonb,
  expected_output JSONB NOT NULL DEFAULT '{}'::jsonb,
  accuracy_score NUMERIC(5,2) DEFAULT 0,
  deviation_details JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Payer profiles: adversarial denial pattern profiles per payer
CREATE TABLE public.payer_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payer_name TEXT NOT NULL UNIQUE,
  payer_code TEXT UNIQUE,
  denial_patterns JSONB DEFAULT '[]'::jsonb,
  modifier_sensitivity JSONB DEFAULT '{}'::jsonb,
  code_combination_flags JSONB DEFAULT '[]'::jsonb,
  appeal_success_rates JSONB DEFAULT '{}'::jsonb,
  behavioral_notes TEXT,
  adversarial_prompt_additions TEXT,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Engine calibration: tracks prediction vs actual outcome
CREATE TABLE public.engine_calibration (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.audit_cases(id) ON DELETE CASCADE,
  predicted_outcome TEXT NOT NULL,
  predicted_confidence INTEGER NOT NULL DEFAULT 0,
  actual_outcome TEXT,
  role_weights JSONB DEFAULT '{}'::jsonb,
  deviation_score NUMERIC(5,2),
  calibration_notes TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Case graph edges: cross-case relationships for pattern memory
CREATE TABLE public.case_graph_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_case_id UUID NOT NULL REFERENCES public.audit_cases(id) ON DELETE CASCADE,
  target_case_id UUID NOT NULL REFERENCES public.audit_cases(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL,
  strength NUMERIC(5,2) DEFAULT 0,
  shared_attributes JSONB DEFAULT '[]'::jsonb,
  insights JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Stability checks: temporal drift detection results
CREATE TABLE public.stability_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.audit_cases(id) ON DELETE CASCADE,
  run_a_output JSONB NOT NULL DEFAULT '{}'::jsonb,
  run_b_output JSONB NOT NULL DEFAULT '{}'::jsonb,
  drift_score NUMERIC(5,2) DEFAULT 0,
  unstable_roles TEXT[] DEFAULT '{}',
  prompt_order_a TEXT[] DEFAULT '{}',
  prompt_order_b TEXT[] DEFAULT '{}',
  is_stable BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. Devil's advocate results: 5th pass that attacks consensus
CREATE TABLE public.devils_advocate_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.audit_cases(id) ON DELETE CASCADE,
  consensus_before INTEGER DEFAULT 0,
  consensus_after INTEGER,
  attack_vectors JSONB DEFAULT '[]'::jsonb,
  consensus_survived BOOLEAN DEFAULT true,
  vulnerabilities_found JSONB DEFAULT '[]'::jsonb,
  reanalysis_triggered BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS policies
ALTER TABLE public.reasoning_chains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ghost_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ghost_case_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.engine_calibration ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_graph_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stability_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devils_advocate_results ENABLE ROW LEVEL SECURITY;

-- Service role full access for all engine tables
CREATE POLICY "Service role full access reasoning_chains" ON public.reasoning_chains FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access ghost_cases" ON public.ghost_cases FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access ghost_case_results" ON public.ghost_case_results FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access payer_profiles" ON public.payer_profiles FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access engine_calibration" ON public.engine_calibration FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access case_graph_edges" ON public.case_graph_edges FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access stability_checks" ON public.stability_checks FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access devils_advocate_results" ON public.devils_advocate_results FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Authenticated users can view their own data via case ownership
CREATE POLICY "Users view own reasoning chains" ON public.reasoning_chains FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM audit_cases WHERE audit_cases.id = reasoning_chains.case_id AND audit_cases.owner_id = auth.uid()));

CREATE POLICY "Users view own stability checks" ON public.stability_checks FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM audit_cases WHERE audit_cases.id = stability_checks.case_id AND audit_cases.owner_id = auth.uid()));

CREATE POLICY "Users view own devils advocate results" ON public.devils_advocate_results FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM audit_cases WHERE audit_cases.id = devils_advocate_results.case_id AND audit_cases.owner_id = auth.uid()));

CREATE POLICY "Users view own engine calibration" ON public.engine_calibration FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM audit_cases WHERE audit_cases.id = engine_calibration.case_id AND audit_cases.owner_id = auth.uid()));

CREATE POLICY "Users view own case graph edges" ON public.case_graph_edges FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM audit_cases WHERE audit_cases.id = case_graph_edges.source_case_id AND audit_cases.owner_id = auth.uid()));

-- Payer profiles and ghost cases are global reference data (read-only for authenticated)
CREATE POLICY "Authenticated users view payer profiles" ON public.payer_profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users view ghost cases" ON public.ghost_cases FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users view ghost case results" ON public.ghost_case_results FOR SELECT TO authenticated USING (true);

-- Enable realtime for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.stability_checks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.devils_advocate_results;
ALTER PUBLICATION supabase_realtime ADD TABLE public.reasoning_chains;
