-- Fix 1: Replace permissive org_members INSERT policy with admin-only check
DROP POLICY IF EXISTS "Org admins can insert members" ON public.org_members;

CREATE POLICY "Org admins can insert members"
ON public.org_members
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.org_members AS om
    WHERE om.org_id = org_members.org_id
      AND om.user_id = auth.uid()
      AND om.role = 'admin'
  )
);

-- Fix 2: Remove null case_id bypass on appeal_outcomes SELECT
DROP POLICY IF EXISTS "Users view own appeal outcomes" ON public.appeal_outcomes;

CREATE POLICY "Users view own appeal outcomes"
ON public.appeal_outcomes
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM audit_cases
    WHERE audit_cases.id = appeal_outcomes.case_id
      AND audit_cases.owner_id = auth.uid()
  )
);