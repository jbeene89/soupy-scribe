
CREATE TABLE public.phi_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  user_email text,
  resource_type text NOT NULL,
  resource_id text,
  action text NOT NULL,
  ip_address text,
  user_agent text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_phi_access_log_user ON public.phi_access_log(user_id, created_at DESC);
CREATE INDEX idx_phi_access_log_resource ON public.phi_access_log(resource_type, resource_id);
CREATE INDEX idx_phi_access_log_created ON public.phi_access_log(created_at DESC);

ALTER TABLE public.phi_access_log ENABLE ROW LEVEL SECURITY;

-- Users can only insert their own access events (cannot read/edit/delete — append-only audit trail)
CREATE POLICY "Users insert own phi access log"
  ON public.phi_access_log FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can read their own access history
CREATE POLICY "Users read own phi access log"
  ON public.phi_access_log FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Soupy admins can read everything for compliance review
CREATE POLICY "Admins read all phi access log"
  ON public.phi_access_log FOR SELECT TO authenticated
  USING (public.is_soupy_admin(auth.uid()));

-- Service role has full access
CREATE POLICY "Service role full access phi_access_log"
  ON public.phi_access_log FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- BAA acknowledgement table — track which users have acknowledged the PHI usage policy
CREATE TABLE public.phi_policy_acknowledgements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  policy_version text NOT NULL,
  acknowledged_at timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  user_agent text
);

ALTER TABLE public.phi_policy_acknowledgements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own phi acknowledgement"
  ON public.phi_policy_acknowledgements FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role full access phi_policy_acknowledgements"
  ON public.phi_policy_acknowledgements FOR ALL TO service_role
  USING (true) WITH CHECK (true);
