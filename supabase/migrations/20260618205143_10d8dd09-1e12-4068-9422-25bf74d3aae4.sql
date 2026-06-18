
-- Invite codes
CREATE TABLE public.patient_self_help_invites (
  code text PRIMARY KEY,
  label text,
  max_uses integer NOT NULL DEFAULT 1,
  uses_count integer NOT NULL DEFAULT 0,
  expires_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_self_help_invites TO authenticated;
GRANT ALL ON public.patient_self_help_invites TO service_role;
ALTER TABLE public.patient_self_help_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Soupy admins manage invites" ON public.patient_self_help_invites
  FOR ALL TO authenticated
  USING (public.is_soupy_admin(auth.uid()))
  WITH CHECK (public.is_soupy_admin(auth.uid()));

-- Cases
CREATE TABLE public.patient_self_help_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  access_token uuid NOT NULL DEFAULT gen_random_uuid(),
  invite_code text REFERENCES public.patient_self_help_invites(code) ON DELETE SET NULL,
  contact_email text,
  contact_name text,
  case_title text,
  scope text,
  narrative text,
  status text NOT NULL DEFAULT 'awaiting_files',
  progress_message text,
  file_count integer NOT NULL DEFAULT 0,
  results jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX patient_self_help_cases_token_idx ON public.patient_self_help_cases(access_token);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_self_help_cases TO authenticated;
GRANT ALL ON public.patient_self_help_cases TO service_role;
ALTER TABLE public.patient_self_help_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Soupy admins view all self-help cases" ON public.patient_self_help_cases
  FOR SELECT TO authenticated
  USING (public.is_soupy_admin(auth.uid()));

CREATE TRIGGER patient_self_help_cases_set_updated_at
  BEFORE UPDATE ON public.patient_self_help_cases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Files
CREATE TABLE public.patient_self_help_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.patient_self_help_cases(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  file_type text,
  file_size integer,
  page_count integer,
  extracted_text text,
  ocr_text text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX patient_self_help_files_case_idx ON public.patient_self_help_files(case_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_self_help_files TO authenticated;
GRANT ALL ON public.patient_self_help_files TO service_role;
ALTER TABLE public.patient_self_help_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Soupy admins view all self-help files" ON public.patient_self_help_files
  FOR SELECT TO authenticated
  USING (public.is_soupy_admin(auth.uid()));
