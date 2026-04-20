-- ───────────────────────────────────────────────────────────
-- 1. Replace open organization INSERT policy with SECURITY DEFINER function
-- ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users can create orgs" ON public.organizations;

-- New policy: only service_role may insert directly. Users go through the function.
CREATE POLICY "Service role manages org creation"
ON public.organizations
FOR INSERT
TO authenticated
WITH CHECK (false);

-- Atomically create an organization and make the caller its first admin.
CREATE OR REPLACE FUNCTION public.create_organization(_name text, _slug text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _new_org_id uuid;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Must be authenticated to create an organization';
  END IF;

  -- Reserved slugs blocked at trigger level too, but reject here for a clean error.
  IF _slug IS NOT NULL AND _slug IN ('soupy-admin', 'admin', 'system', 'root', 'superadmin') THEN
    RAISE EXCEPTION 'Slug "%" is reserved.', _slug USING ERRCODE = 'insufficient_privilege';
  END IF;

  INSERT INTO public.organizations (name, slug)
  VALUES (_name, _slug)
  RETURNING id INTO _new_org_id;

  INSERT INTO public.org_members (org_id, user_id, role)
  VALUES (_new_org_id, _user_id, 'admin');

  RETURN _new_org_id;
END;
$$;

-- ───────────────────────────────────────────────────────────
-- 2. Tighten event-table INSERT rules (require BOTH org match AND case ownership when case_id is set)
-- ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users create org or own or_readiness_events" ON public.or_readiness_events;
CREATE POLICY "Users create org or own or_readiness_events"
ON public.or_readiness_events
FOR INSERT
TO authenticated
WITH CHECK (
  (org_id IS NULL OR org_id IN (SELECT user_org_ids(auth.uid())))
  AND
  (case_id IS NULL OR EXISTS (
    SELECT 1 FROM audit_cases WHERE audit_cases.id = or_readiness_events.case_id AND audit_cases.owner_id = auth.uid()
  ))
  AND
  (org_id IS NOT NULL OR case_id IS NOT NULL)
);

DROP POLICY IF EXISTS "Users create org or own triage_accuracy_events" ON public.triage_accuracy_events;
CREATE POLICY "Users create org or own triage_accuracy_events"
ON public.triage_accuracy_events
FOR INSERT
TO authenticated
WITH CHECK (
  (org_id IS NULL OR org_id IN (SELECT user_org_ids(auth.uid())))
  AND
  (case_id IS NULL OR EXISTS (
    SELECT 1 FROM audit_cases WHERE audit_cases.id = triage_accuracy_events.case_id AND audit_cases.owner_id = auth.uid()
  ))
  AND
  (org_id IS NOT NULL OR case_id IS NOT NULL)
);

DROP POLICY IF EXISTS "Users create org or own postop_flow_events" ON public.postop_flow_events;
CREATE POLICY "Users create org or own postop_flow_events"
ON public.postop_flow_events
FOR INSERT
TO authenticated
WITH CHECK (
  (org_id IS NULL OR org_id IN (SELECT user_org_ids(auth.uid())))
  AND
  (case_id IS NULL OR EXISTS (
    SELECT 1 FROM audit_cases WHERE audit_cases.id = postop_flow_events.case_id AND audit_cases.owner_id = auth.uid()
  ))
  AND
  (org_id IS NOT NULL OR case_id IS NOT NULL)
);

DROP POLICY IF EXISTS "Users create org or own er_acute_events" ON public.er_acute_events;
CREATE POLICY "Users create org or own er_acute_events"
ON public.er_acute_events
FOR INSERT
TO authenticated
WITH CHECK (
  (org_id IS NULL OR org_id IN (SELECT user_org_ids(auth.uid())))
  AND
  (case_id IS NULL OR EXISTS (
    SELECT 1 FROM audit_cases WHERE audit_cases.id = er_acute_events.case_id AND audit_cases.owner_id = auth.uid()
  ))
  AND
  (org_id IS NOT NULL OR case_id IS NOT NULL)
);

DROP POLICY IF EXISTS "Users create org or own patient_advocate_events" ON public.patient_advocate_events;
CREATE POLICY "Users create org or own patient_advocate_events"
ON public.patient_advocate_events
FOR INSERT
TO authenticated
WITH CHECK (
  (org_id IS NULL OR org_id IN (SELECT user_org_ids(auth.uid())))
  AND
  (case_id IS NULL OR EXISTS (
    SELECT 1 FROM audit_cases WHERE audit_cases.id = patient_advocate_events.case_id AND audit_cases.owner_id = auth.uid()
  ))
  AND
  (org_id IS NOT NULL OR case_id IS NOT NULL)
);

-- ───────────────────────────────────────────────────────────
-- 3. Restrict source_weights to service_role only (Tier 3 housekeeping)
-- ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users view source weights" ON public.source_weights;

-- ───────────────────────────────────────────────────────────
-- 4. Add UPDATE protection on organizations (prevent slug rewrites to reserved values)
-- ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Members cannot update orgs" ON public.organizations;
-- No UPDATE policy = no UPDATE allowed for non-service-role. Trigger also blocks reserved slugs.

-- Make sure the reserved-slug trigger fires on UPDATE too, not just INSERT.
DROP TRIGGER IF EXISTS block_reserved_org_slugs_trigger ON public.organizations;
CREATE TRIGGER block_reserved_org_slugs_trigger
  BEFORE INSERT OR UPDATE OF slug ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.block_reserved_org_slugs();