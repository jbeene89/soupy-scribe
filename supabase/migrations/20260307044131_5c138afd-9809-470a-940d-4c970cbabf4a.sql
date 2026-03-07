
-- ============================================================
-- SOUPY Audit Platform — Full Schema
-- ============================================================

-- Timestamp trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ============================================================
-- AUDIT CASES
-- ============================================================
CREATE TABLE public.audit_cases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_number TEXT NOT NULL UNIQUE,
  patient_id TEXT NOT NULL,
  physician_id TEXT NOT NULL,
  physician_name TEXT NOT NULL,
  date_of_service DATE NOT NULL,
  date_submitted DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in-review', 'approved', 'rejected', 'appealed')),
  assigned_to TEXT,
  cpt_codes TEXT[] NOT NULL DEFAULT '{}',
  icd_codes TEXT[] NOT NULL DEFAULT '{}',
  claim_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  consensus_score INTEGER DEFAULT 0,
  risk_score JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  decision JSONB,
  source_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_cases ENABLE ROW LEVEL SECURITY;

-- Public read/write for now (no auth required for demo)
CREATE POLICY "Anyone can view audit cases" ON public.audit_cases FOR SELECT USING (true);
CREATE POLICY "Anyone can create audit cases" ON public.audit_cases FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update audit cases" ON public.audit_cases FOR UPDATE USING (true);

CREATE TRIGGER update_audit_cases_updated_at
  BEFORE UPDATE ON public.audit_cases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- AI ANALYSES (one per role per case)
-- ============================================================
CREATE TABLE public.case_analyses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID NOT NULL REFERENCES public.audit_cases(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('builder', 'redteam', 'analyst', 'breaker')),
  model TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'analyzing' CHECK (status IN ('analyzing', 'complete', 'error')),
  confidence INTEGER DEFAULT 0,
  perspective_statement TEXT,
  key_insights TEXT[] DEFAULT '{}',
  assumptions TEXT[] DEFAULT '{}',
  violations JSONB DEFAULT '[]',
  overall_assessment TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(case_id, role)
);

ALTER TABLE public.case_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view analyses" ON public.case_analyses FOR SELECT USING (true);
CREATE POLICY "Anyone can create analyses" ON public.case_analyses FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update analyses" ON public.case_analyses FOR UPDATE USING (true);

CREATE TRIGGER update_case_analyses_updated_at
  BEFORE UPDATE ON public.case_analyses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- UPLOADED CASE FILES
-- ============================================================
CREATE TABLE public.case_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID REFERENCES public.audit_cases(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER,
  storage_path TEXT,
  extracted_text TEXT,
  extraction_status TEXT NOT NULL DEFAULT 'pending' CHECK (extraction_status IN ('pending', 'processing', 'complete', 'error')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.case_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view case files" ON public.case_files FOR SELECT USING (true);
CREATE POLICY "Anyone can create case files" ON public.case_files FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update case files" ON public.case_files FOR UPDATE USING (true);

-- ============================================================
-- CODE COMBINATION FLAGS
-- ============================================================
CREATE TABLE public.code_combinations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID REFERENCES public.audit_cases(id) ON DELETE CASCADE,
  codes TEXT[] NOT NULL,
  flag_reason TEXT NOT NULL,
  legitimate_explanations TEXT[] DEFAULT '{}',
  noncompliant_explanations TEXT[] DEFAULT '{}',
  required_documentation TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.code_combinations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view code combinations" ON public.code_combinations FOR SELECT USING (true);
CREATE POLICY "Anyone can create code combinations" ON public.code_combinations FOR INSERT WITH CHECK (true);

-- ============================================================
-- PROCESSING QUEUE (tracks analysis jobs)
-- ============================================================
CREATE TABLE public.processing_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID NOT NULL REFERENCES public.audit_cases(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'complete', 'error')),
  current_step TEXT,
  progress INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.processing_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view queue" ON public.processing_queue FOR SELECT USING (true);
CREATE POLICY "Anyone can create queue items" ON public.processing_queue FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update queue items" ON public.processing_queue FOR UPDATE USING (true);

-- ============================================================
-- STORAGE BUCKET FOR CASE FILES
-- ============================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('case-files', 'case-files', false);

CREATE POLICY "Anyone can upload case files" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'case-files');
CREATE POLICY "Anyone can view case files" ON storage.objects FOR SELECT USING (bucket_id = 'case-files');

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_audit_cases_status ON public.audit_cases(status);
CREATE INDEX idx_audit_cases_physician ON public.audit_cases(physician_id);
CREATE INDEX idx_audit_cases_case_number ON public.audit_cases(case_number);
CREATE INDEX idx_case_analyses_case_id ON public.case_analyses(case_id);
CREATE INDEX idx_case_files_case_id ON public.case_files(case_id);
CREATE INDEX idx_processing_queue_case_id ON public.processing_queue(case_id);
CREATE INDEX idx_processing_queue_status ON public.processing_queue(status);

-- Generate case numbers automatically
CREATE OR REPLACE FUNCTION public.generate_case_number()
RETURNS TRIGGER AS $$
DECLARE
  next_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(case_number FROM 'AUD-\d{4}-(\d+)') AS INTEGER)), 0) + 1
  INTO next_num
  FROM public.audit_cases;
  
  IF NEW.case_number IS NULL OR NEW.case_number = '' THEN
    NEW.case_number := 'AUD-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-' || LPAD(next_num::TEXT, 3, '0');
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER generate_case_number_trigger
  BEFORE INSERT ON public.audit_cases
  FOR EACH ROW EXECUTE FUNCTION public.generate_case_number();
