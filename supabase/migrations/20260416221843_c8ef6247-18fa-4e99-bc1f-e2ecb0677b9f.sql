
-- Messages table for in-app inbox
CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  sender_email TEXT,
  sender_name TEXT,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unread',
  admin_reply TEXT,
  admin_replied_at TIMESTAMPTZ,
  replied_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  thread_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_sender ON public.messages(sender_id, created_at DESC);
CREATE INDEX idx_messages_status ON public.messages(status, created_at DESC);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Helper: is the current user a SOUPY admin?
CREATE OR REPLACE FUNCTION public.is_soupy_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.org_members om
    JOIN public.organizations o ON o.id = om.org_id
    WHERE om.user_id = _user_id
      AND om.role = 'admin'
      AND o.slug = 'soupy-admin'
  );
$$;

-- RLS policies
CREATE POLICY "Users can send messages"
  ON public.messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users view own messages"
  ON public.messages FOR SELECT TO authenticated
  USING (auth.uid() = sender_id OR public.is_soupy_admin(auth.uid()));

CREATE POLICY "Users update own messages"
  ON public.messages FOR UPDATE TO authenticated
  USING (auth.uid() = sender_id OR public.is_soupy_admin(auth.uid()));

CREATE POLICY "Service role full access messages"
  ON public.messages FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Auto-update updated_at
CREATE TRIGGER update_messages_updated_at
  BEFORE UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed the SOUPY admin org so you can be marked as admin
INSERT INTO public.organizations (name, slug)
VALUES ('SOUPY Admin', 'soupy-admin')
ON CONFLICT DO NOTHING;
