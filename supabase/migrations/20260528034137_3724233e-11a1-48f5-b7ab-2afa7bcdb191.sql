
CREATE TABLE public.vendor_watch_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  vendor_key TEXT NOT NULL,
  vendor_name TEXT NOT NULL,
  doc_type TEXT NOT NULL CHECK (doc_type IN ('contract','fee_schedule','remit','eob','correspondence','other')),
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL DEFAULT 0,
  mime_type TEXT,
  raw_text TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','analyzing','analyzed','failed')),
  analysis JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_watch_documents TO authenticated;
GRANT ALL ON public.vendor_watch_documents TO service_role;

ALTER TABLE public.vendor_watch_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view their vendor watch documents" ON public.vendor_watch_documents
  FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "Owners insert their vendor watch documents" ON public.vendor_watch_documents
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners update their vendor watch documents" ON public.vendor_watch_documents
  FOR UPDATE TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "Owners delete their vendor watch documents" ON public.vendor_watch_documents
  FOR DELETE TO authenticated USING (auth.uid() = owner_id);

CREATE INDEX idx_vw_docs_owner ON public.vendor_watch_documents(owner_id, created_at DESC);
CREATE INDEX idx_vw_docs_vendor ON public.vendor_watch_documents(owner_id, vendor_key);

CREATE TRIGGER trg_vw_docs_updated
  BEFORE UPDATE ON public.vendor_watch_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


CREATE TABLE public.vendor_watch_findings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.vendor_watch_documents(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL,
  finding_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
  title TEXT NOT NULL,
  detail TEXT,
  recommended_action TEXT,
  dollar_impact NUMERIC,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewing','resolved','dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_watch_findings TO authenticated;
GRANT ALL ON public.vendor_watch_findings TO service_role;

ALTER TABLE public.vendor_watch_findings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view their vendor watch findings" ON public.vendor_watch_findings
  FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "Owners insert their vendor watch findings" ON public.vendor_watch_findings
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners update their vendor watch findings" ON public.vendor_watch_findings
  FOR UPDATE TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "Owners delete their vendor watch findings" ON public.vendor_watch_findings
  FOR DELETE TO authenticated USING (auth.uid() = owner_id);

CREATE INDEX idx_vw_findings_doc ON public.vendor_watch_findings(document_id);
CREATE INDEX idx_vw_findings_owner ON public.vendor_watch_findings(owner_id, severity, created_at DESC);

CREATE TRIGGER trg_vw_findings_updated
  BEFORE UPDATE ON public.vendor_watch_findings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- Storage policies for vendor-submissions bucket (already exists) — scoped to vendor-watch/ folder
CREATE POLICY "Owners read their vendor watch files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'vendor-submissions' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Owners upload their vendor watch files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'vendor-submissions' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Owners delete their vendor watch files"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'vendor-submissions' AND auth.uid()::text = (storage.foldername(name))[1]);
