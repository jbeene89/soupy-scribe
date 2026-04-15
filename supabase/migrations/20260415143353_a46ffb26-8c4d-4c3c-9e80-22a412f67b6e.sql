
-- Add body_region and linked_case_id to audit_cases
ALTER TABLE public.audit_cases
ADD COLUMN body_region text,
ADD COLUMN linked_case_id uuid REFERENCES public.audit_cases(id) ON DELETE SET NULL;

-- Index for fast matching queries
CREATE INDEX idx_audit_cases_patient_body ON public.audit_cases(patient_id, body_region);
CREATE INDEX idx_audit_cases_linked ON public.audit_cases(linked_case_id);
