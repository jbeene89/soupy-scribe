CREATE TABLE public.linkedin_posts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','published','failed')),
  text_snippet text NOT NULL,
  link_url text,
  has_image boolean NOT NULL DEFAULT false,
  post_id text,
  post_url text,
  error_message text,
  queued_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.linkedin_posts TO authenticated;
GRANT ALL ON public.linkedin_posts TO service_role;
ALTER TABLE public.linkedin_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own linkedin posts" ON public.linkedin_posts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own linkedin posts" ON public.linkedin_posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own linkedin posts" ON public.linkedin_posts FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER update_linkedin_posts_updated_at BEFORE UPDATE ON public.linkedin_posts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX linkedin_posts_user_created_idx ON public.linkedin_posts(user_id, created_at DESC);