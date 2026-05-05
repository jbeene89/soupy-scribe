
-- Lock down SECURITY DEFINER functions: revoke broad EXECUTE, then re-grant only where needed.

-- Trigger-only functions: no API caller should invoke these directly.
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.block_reserved_org_slugs() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.generate_case_number() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.clamp_audit_case_dos() FROM PUBLIC, anon, authenticated;

-- Service-role-only queue helpers.
REVOKE ALL ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;

-- RLS / RPC helpers: revoke from anon, keep authenticated only.
REVOKE ALL ON FUNCTION public.is_soupy_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_soupy_admin(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.user_org_ids(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_org_ids(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.create_organization(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_organization(text, text) TO authenticated;
