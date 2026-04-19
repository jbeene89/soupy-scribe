-- ════════════════════════════════════════════════════════════════
-- Security hardening pass — fixes 4 findings:
--   1. soupy-admin slug escalation (anyone could become admin by creating an org with slug 'soupy-admin')
--   2. Realtime channels wide open (any authed user could subscribe to other users' case channels)
--   3. case_graph_edges leaked target case IDs from other users' cases
--   4. Database functions missing search_path setting (warning-level)
-- ════════════════════════════════════════════════════════════════

-- ─── Fix 1: Block reserved org slugs (soupy-admin escalation) ───
-- Anyone could previously INSERT into organizations with slug='soupy-admin' and become admin.
-- We now block reserved slugs at insert time via a trigger.

CREATE OR REPLACE FUNCTION public.block_reserved_org_slugs()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Reserved slugs that grant special privileges; only service_role may set them.
  IF NEW.slug IN ('soupy-admin', 'admin', 'system', 'root', 'superadmin') THEN
    IF auth.role() <> 'service_role' THEN
      RAISE EXCEPTION 'Slug "%" is reserved and cannot be used.', NEW.slug
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_reserved_org_slugs_insert ON public.organizations;
CREATE TRIGGER trg_block_reserved_org_slugs_insert
  BEFORE INSERT ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.block_reserved_org_slugs();

DROP TRIGGER IF EXISTS trg_block_reserved_org_slugs_update ON public.organizations;
CREATE TRIGGER trg_block_reserved_org_slugs_update
  BEFORE UPDATE OF slug ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.block_reserved_org_slugs();


-- ─── Fix 2: Lock down Realtime subscriptions ───
-- Without RLS on realtime.messages, any authenticated client can subscribe to any
-- channel topic and receive change broadcasts for tables containing patient data.
-- We restrict subscriptions to channels the user owns:
--   case:<case_id>   — only allowed if user owns the audit_case
--   user:<user_id>   — only allowed if user_id = auth.uid()
--   org:<org_id>     — only allowed if user belongs to that org
-- Anything else is denied.

ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authed users can subscribe to own channels" ON realtime.messages;
CREATE POLICY "Authed users can subscribe to own channels"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (
    -- case:<uuid> — must own the audit case
    (
      realtime.topic() LIKE 'case:%'
      AND EXISTS (
        SELECT 1 FROM public.audit_cases
        WHERE id::text = substring(realtime.topic() FROM 6)
          AND owner_id = auth.uid()
      )
    )
    OR
    -- user:<uuid> — must be your own user channel
    (
      realtime.topic() LIKE 'user:%'
      AND substring(realtime.topic() FROM 6) = auth.uid()::text
    )
    OR
    -- org:<uuid> — must be a member of the org
    (
      realtime.topic() LIKE 'org:%'
      AND substring(realtime.topic() FROM 5)::uuid IN (SELECT public.user_org_ids(auth.uid()))
    )
  );


-- ─── Fix 3: case_graph_edges target leak ───
-- Old policy only checked source_case_id ownership, so target_case_id (which can point
-- to another user's case) was leaked. Replace with a policy that requires ownership of BOTH.

DROP POLICY IF EXISTS "Users view own case graph edges" ON public.case_graph_edges;
CREATE POLICY "Users view own case graph edges"
  ON public.case_graph_edges
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.audit_cases
      WHERE id = case_graph_edges.source_case_id
        AND owner_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.audit_cases
      WHERE id = case_graph_edges.target_case_id
        AND owner_id = auth.uid()
    )
  );


-- ─── Fix 4: Set search_path on database functions missing it ───
-- The linter warns that functions without an explicit search_path can be exploited
-- via search_path manipulation. Set it to 'public' on the affected functions.

ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public;