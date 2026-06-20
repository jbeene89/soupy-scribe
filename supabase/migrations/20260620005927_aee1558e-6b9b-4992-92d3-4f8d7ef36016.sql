ALTER TABLE public.patient_self_help_cases
  ADD COLUMN IF NOT EXISTS worries text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS recollection jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS analysis_modes jsonb NOT NULL DEFAULT '{"clinical":false,"billing":false,"consent":false}'::jsonb,
  ADD COLUMN IF NOT EXISTS disabled_modes_reason text;

ALTER TABLE public.patient_self_help_files
  ADD COLUMN IF NOT EXISTS doc_type text,
  ADD COLUMN IF NOT EXISTS doc_type_source text;