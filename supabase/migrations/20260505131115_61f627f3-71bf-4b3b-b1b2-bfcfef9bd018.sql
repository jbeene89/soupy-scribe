-- Vendor Watch outreach log: timestamped submissions with optional file attachments
CREATE TABLE public.vendor_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Scope: which vendor row this entry belongs to
  vendor_key text NOT NULL,                      -- VendorKey ('clearmd', etc.)
  scope text NOT NULL,                           -- 'contract' | 'anomaly' | 'deal' | 'roi'
  scope_ref text,                                -- optional row id (anomaly id, deal id, roi id)
  -- Entry contents
  entry_type text NOT NULL DEFAULT 'note',       -- 'note' | 'call' | 'email_draft' | 'email_sent' | 'response' | 'evidence'
  title text,
  body text NOT NULL DEFAULT '',
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{path, name, size, mime}]
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX vendor_submissions_owner_idx ON public.vendor_submissions(owner_id);
CREATE INDEX vendor_submissions_scope_idx ON public.vendor_submissions(owner_id, vendor_key, scope);

ALTER TABLE public.vendor_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own vendor submissions"
  ON public.vendor_submissions FOR SELECT
  TO authenticated USING (auth.uid() = owner_id);

CREATE POLICY "Users insert own vendor submissions"
  ON public.vendor_submissions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users update own vendor submissions"
  ON public.vendor_submissions FOR UPDATE
  TO authenticated USING (auth.uid() = owner_id);

CREATE POLICY "Users delete own vendor submissions"
  ON public.vendor_submissions FOR DELETE
  TO authenticated USING (auth.uid() = owner_id);

CREATE POLICY "Service role full access vendor_submissions"
  ON public.vendor_submissions FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER vendor_submissions_updated_at
  BEFORE UPDATE ON public.vendor_submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Private storage bucket for attached docs
INSERT INTO storage.buckets (id, name, public)
VALUES ('vendor-submissions', 'vendor-submissions', false)
ON CONFLICT (id) DO NOTHING;

-- Owner-scoped storage policies (path: {auth.uid}/...)
CREATE POLICY "Vendor subs: owner read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'vendor-submissions' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Vendor subs: owner insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'vendor-submissions' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Vendor subs: owner update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'vendor-submissions' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Vendor subs: owner delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'vendor-submissions' AND auth.uid()::text = (storage.foldername(name))[1]);