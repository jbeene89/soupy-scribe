
-- Drop existing authenticated policies that use USING (true)
DROP POLICY IF EXISTS "Authenticated users can view audit cases" ON public.audit_cases;
DROP POLICY IF EXISTS "Authenticated users can update audit cases" ON public.audit_cases;
DROP POLICY IF EXISTS "Authenticated users can create audit cases" ON public.audit_cases;

DROP POLICY IF EXISTS "Authenticated users can view analyses" ON public.case_analyses;
DROP POLICY IF EXISTS "Authenticated users can view case files" ON public.case_files;
DROP POLICY IF EXISTS "Authenticated users can create case files" ON public.case_files;
DROP POLICY IF EXISTS "Authenticated users can update case files" ON public.case_files;
DROP POLICY IF EXISTS "Authenticated users can view code combinations" ON public.code_combinations;
DROP POLICY IF EXISTS "Authenticated users can view queue" ON public.processing_queue;

-- audit_cases: scope to owner
CREATE POLICY "Users can view own audit cases"
  ON public.audit_cases FOR SELECT TO authenticated
  USING (auth.uid() = owner_id);

CREATE POLICY "Users can create own audit cases"
  ON public.audit_cases FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update own audit cases"
  ON public.audit_cases FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id);

-- case_analyses: scope via parent case ownership
CREATE POLICY "Users can view own case analyses"
  ON public.case_analyses FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.audit_cases
    WHERE audit_cases.id = case_analyses.case_id
      AND audit_cases.owner_id = auth.uid()
  ));

-- case_files: scope via parent case ownership
CREATE POLICY "Users can view own case files"
  ON public.case_files FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.audit_cases
    WHERE audit_cases.id = case_files.case_id
      AND audit_cases.owner_id = auth.uid()
  ));

CREATE POLICY "Users can create own case files"
  ON public.case_files FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.audit_cases
    WHERE audit_cases.id = case_files.case_id
      AND audit_cases.owner_id = auth.uid()
  ));

CREATE POLICY "Users can update own case files"
  ON public.case_files FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.audit_cases
    WHERE audit_cases.id = case_files.case_id
      AND audit_cases.owner_id = auth.uid()
  ));

-- code_combinations: scope via parent case ownership
CREATE POLICY "Users can view own code combinations"
  ON public.code_combinations FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.audit_cases
    WHERE audit_cases.id = code_combinations.case_id
      AND audit_cases.owner_id = auth.uid()
  ));

-- processing_queue: scope via parent case ownership
CREATE POLICY "Users can view own queue items"
  ON public.processing_queue FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.audit_cases
    WHERE audit_cases.id = processing_queue.case_id
      AND audit_cases.owner_id = auth.uid()
  ));
