
CREATE TABLE public.payer_policies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  payer TEXT,
  policy_id TEXT NOT NULL,
  policy_type TEXT NOT NULL DEFAULT 'commercial',
  title TEXT,
  source_url TEXT,
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uniq_payer_policy_per_user
  ON public.payer_policies (user_id, policy_id, COALESCE(payer, ''));

CREATE TABLE public.payer_policy_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  policy_id UUID NOT NULL REFERENCES public.payer_policies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  version_label TEXT,
  effective_start DATE NOT NULL,
  effective_end DATE,
  policy_text TEXT NOT NULL,
  source_url TEXT,
  change_summary TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.payer_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payer_policy_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners read policies" ON public.payer_policies FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Owners insert policies" ON public.payer_policies FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owners update policies" ON public.payer_policies FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Owners delete policies" ON public.payer_policies FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Owners read versions" ON public.payer_policy_versions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Owners insert versions" ON public.payer_policy_versions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owners update versions" ON public.payer_policy_versions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Owners delete versions" ON public.payer_policy_versions FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_payer_policies_user ON public.payer_policies(user_id, policy_id);
CREATE INDEX idx_payer_policy_versions_policy ON public.payer_policy_versions(policy_id, effective_start DESC);
CREATE INDEX idx_payer_policy_versions_user ON public.payer_policy_versions(user_id);

CREATE TRIGGER trg_payer_policies_updated
BEFORE UPDATE ON public.payer_policies
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.policy_timeline_checks
  ADD COLUMN policy_version_id UUID REFERENCES public.payer_policy_versions(id) ON DELETE SET NULL,
  ADD COLUMN library_policy_id UUID REFERENCES public.payer_policies(id) ON DELETE SET NULL;

CREATE INDEX idx_policy_checks_version ON public.policy_timeline_checks(policy_version_id);
