
ALTER TABLE public.patient_self_help_files
  ADD COLUMN IF NOT EXISTS chunk_results jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS chunks_done int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chunks_total int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS file_status text NOT NULL DEFAULT 'pending';
