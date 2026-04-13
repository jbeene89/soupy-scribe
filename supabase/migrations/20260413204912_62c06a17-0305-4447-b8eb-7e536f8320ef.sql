
-- Organizations table
CREATE TABLE public.organizations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Org members table
CREATE TABLE public.org_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id, user_id)
);
ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;

-- Security definer function to get user's org IDs (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.user_org_ids(_user_id UUID)
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT org_id FROM public.org_members WHERE user_id = _user_id;
$$;

-- Add org_id to operational tables
ALTER TABLE public.or_readiness_events ADD COLUMN org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;
ALTER TABLE public.triage_accuracy_events ADD COLUMN org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;
ALTER TABLE public.postop_flow_events ADD COLUMN org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;

-- Create indexes
CREATE INDEX idx_org_members_user ON public.org_members(user_id);
CREATE INDEX idx_org_members_org ON public.org_members(org_id);
CREATE INDEX idx_or_readiness_org ON public.or_readiness_events(org_id);
CREATE INDEX idx_triage_accuracy_org ON public.triage_accuracy_events(org_id);
CREATE INDEX idx_postop_flow_org ON public.postop_flow_events(org_id);

-- ══ RLS: organizations ══
CREATE POLICY "Members can view own orgs"
  ON public.organizations FOR SELECT TO authenticated
  USING (id IN (SELECT public.user_org_ids(auth.uid())));

CREATE POLICY "Authenticated users can create orgs"
  ON public.organizations FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Service role full access organizations"
  ON public.organizations FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ══ RLS: org_members ══
CREATE POLICY "Members can view fellow members"
  ON public.org_members FOR SELECT TO authenticated
  USING (org_id IN (SELECT public.user_org_ids(auth.uid())));

CREATE POLICY "Org admins can insert members"
  ON public.org_members FOR INSERT TO authenticated
  WITH CHECK (
    org_id IN (SELECT public.user_org_ids(auth.uid()))
  );

CREATE POLICY "Service role full access org_members"
  ON public.org_members FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ══ Update operational table RLS to include org scoping ══

-- OR Readiness: drop old SELECT/INSERT, replace with org-aware versions
DROP POLICY IF EXISTS "Users view own or_readiness_events" ON public.or_readiness_events;
DROP POLICY IF EXISTS "Users create own or_readiness_events" ON public.or_readiness_events;

CREATE POLICY "Users view org or own or_readiness_events"
  ON public.or_readiness_events FOR SELECT TO authenticated
  USING (
    org_id IN (SELECT public.user_org_ids(auth.uid()))
    OR (EXISTS (SELECT 1 FROM audit_cases WHERE audit_cases.id = or_readiness_events.case_id AND audit_cases.owner_id = auth.uid()))
  );

CREATE POLICY "Users create org or own or_readiness_events"
  ON public.or_readiness_events FOR INSERT TO authenticated
  WITH CHECK (
    org_id IN (SELECT public.user_org_ids(auth.uid()))
    OR (EXISTS (SELECT 1 FROM audit_cases WHERE audit_cases.id = or_readiness_events.case_id AND audit_cases.owner_id = auth.uid()))
  );

-- Triage Accuracy
DROP POLICY IF EXISTS "Users view own triage_accuracy_events" ON public.triage_accuracy_events;
DROP POLICY IF EXISTS "Users create own triage_accuracy_events" ON public.triage_accuracy_events;

CREATE POLICY "Users view org or own triage_accuracy_events"
  ON public.triage_accuracy_events FOR SELECT TO authenticated
  USING (
    org_id IN (SELECT public.user_org_ids(auth.uid()))
    OR (EXISTS (SELECT 1 FROM audit_cases WHERE audit_cases.id = triage_accuracy_events.case_id AND audit_cases.owner_id = auth.uid()))
  );

CREATE POLICY "Users create org or own triage_accuracy_events"
  ON public.triage_accuracy_events FOR INSERT TO authenticated
  WITH CHECK (
    org_id IN (SELECT public.user_org_ids(auth.uid()))
    OR (EXISTS (SELECT 1 FROM audit_cases WHERE audit_cases.id = triage_accuracy_events.case_id AND audit_cases.owner_id = auth.uid()))
  );

-- Post-Op Flow
DROP POLICY IF EXISTS "Users view own postop_flow_events" ON public.postop_flow_events;
DROP POLICY IF EXISTS "Users create own postop_flow_events" ON public.postop_flow_events;

CREATE POLICY "Users view org or own postop_flow_events"
  ON public.postop_flow_events FOR SELECT TO authenticated
  USING (
    org_id IN (SELECT public.user_org_ids(auth.uid()))
    OR (EXISTS (SELECT 1 FROM audit_cases WHERE audit_cases.id = postop_flow_events.case_id AND audit_cases.owner_id = auth.uid()))
  );

CREATE POLICY "Users create org or own postop_flow_events"
  ON public.postop_flow_events FOR INSERT TO authenticated
  WITH CHECK (
    org_id IN (SELECT public.user_org_ids(auth.uid()))
    OR (EXISTS (SELECT 1 FROM audit_cases WHERE audit_cases.id = postop_flow_events.case_id AND audit_cases.owner_id = auth.uid()))
  );
