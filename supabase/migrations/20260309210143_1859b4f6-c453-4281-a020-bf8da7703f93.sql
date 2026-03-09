
-- Add owner_id column to audit_cases
ALTER TABLE public.audit_cases ADD COLUMN owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Drop all existing overly permissive RLS policies
DROP POLICY IF EXISTS "Anyone can create audit cases" ON public.audit_cases;
DROP POLICY IF EXISTS "Anyone can update audit cases" ON public.audit_cases;
DROP POLICY IF EXISTS "Anyone can view audit cases" ON public.audit_cases;

DROP POLICY IF EXISTS "Anyone can create analyses" ON public.case_analyses;
DROP POLICY IF EXISTS "Anyone can update analyses" ON public.case_analyses;
DROP POLICY IF EXISTS "Anyone can view analyses" ON public.case_analyses;

DROP POLICY IF EXISTS "Anyone can create case files" ON public.case_files;
DROP POLICY IF EXISTS "Anyone can update case files" ON public.case_files;
DROP POLICY IF EXISTS "Anyone can view case files" ON public.case_files;

DROP POLICY IF EXISTS "Anyone can create code combinations" ON public.code_combinations;
DROP POLICY IF EXISTS "Anyone can view code combinations" ON public.code_combinations;

DROP POLICY IF EXISTS "Anyone can create queue items" ON public.processing_queue;
DROP POLICY IF EXISTS "Anyone can update queue items" ON public.processing_queue;
DROP POLICY IF EXISTS "Anyone can view queue" ON public.processing_queue;

-- audit_cases: authenticated users can view/create/update
CREATE POLICY "Authenticated users can view audit cases"
  ON public.audit_cases FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create audit cases"
  ON public.audit_cases FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update audit cases"
  ON public.audit_cases FOR UPDATE TO authenticated
  USING (true);

-- Service role needs insert/update for edge function
CREATE POLICY "Service role full access audit cases"
  ON public.audit_cases FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- case_analyses: authenticated read, service role write
CREATE POLICY "Authenticated users can view analyses"
  ON public.case_analyses FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Service role manages analyses"
  ON public.case_analyses FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- case_files: authenticated users only
CREATE POLICY "Authenticated users can view case files"
  ON public.case_files FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create case files"
  ON public.case_files FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update case files"
  ON public.case_files FOR UPDATE TO authenticated
  USING (true);

-- code_combinations: authenticated read, service role write
CREATE POLICY "Authenticated users can view code combinations"
  ON public.code_combinations FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Service role manages code combinations"
  ON public.code_combinations FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- processing_queue: authenticated read, service role write
CREATE POLICY "Authenticated users can view queue"
  ON public.processing_queue FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Service role manages queue"
  ON public.processing_queue FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Fix storage policies
DROP POLICY IF EXISTS "Anyone can upload case files" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view case files" ON storage.objects;

CREATE POLICY "Authenticated users can upload case files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'case-files' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can view case files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'case-files');
