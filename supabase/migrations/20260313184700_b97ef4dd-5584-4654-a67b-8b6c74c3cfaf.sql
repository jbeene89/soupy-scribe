
-- 1. appeal_outcomes: scope SELECT to case owner instead of all authenticated
DROP POLICY IF EXISTS "Authenticated users view appeal outcomes" ON public.appeal_outcomes;
CREATE POLICY "Users view own appeal outcomes" ON public.appeal_outcomes
  FOR SELECT TO authenticated
  USING (
    case_id IS NULL OR EXISTS (
      SELECT 1 FROM audit_cases WHERE audit_cases.id = appeal_outcomes.case_id AND audit_cases.owner_id = auth.uid()
    )
  );

-- 2. ghost_cases: restrict to service_role only (system calibration data)
DROP POLICY IF EXISTS "Authenticated users view ghost cases" ON public.ghost_cases;

-- 3. ghost_case_results: restrict to service_role only
DROP POLICY IF EXISTS "Authenticated users view ghost case results" ON public.ghost_case_results;

-- 4. gold_set_cases: restrict to service_role only
DROP POLICY IF EXISTS "Authenticated users view gold set cases" ON public.gold_set_cases;

-- 5. payer_profiles: restrict to service_role only (contains adversarial prompt data)
DROP POLICY IF EXISTS "Authenticated users view payer profiles" ON public.payer_profiles;

-- 6. regulatory_flags: scope to case owner for case-specific flags, allow global flags
DROP POLICY IF EXISTS "Authenticated users view regulatory flags" ON public.regulatory_flags;
CREATE POLICY "Users view relevant regulatory flags" ON public.regulatory_flags
  FOR SELECT TO authenticated
  USING (
    case_id IS NULL OR EXISTS (
      SELECT 1 FROM audit_cases WHERE audit_cases.id = regulatory_flags.case_id AND audit_cases.owner_id = auth.uid()
    )
  );
