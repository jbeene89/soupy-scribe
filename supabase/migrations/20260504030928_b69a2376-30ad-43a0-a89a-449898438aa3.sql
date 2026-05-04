-- Backfill: clamp any future date_of_service values to the case's created_at date
UPDATE public.audit_cases
SET date_of_service = created_at::date
WHERE date_of_service > CURRENT_DATE;

-- Prevent future date_of_service at the database layer
CREATE OR REPLACE FUNCTION public.clamp_audit_case_dos()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.date_of_service IS NOT NULL AND NEW.date_of_service > CURRENT_DATE THEN
    NEW.date_of_service := CURRENT_DATE;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clamp_audit_case_dos ON public.audit_cases;
CREATE TRIGGER trg_clamp_audit_case_dos
BEFORE INSERT OR UPDATE OF date_of_service ON public.audit_cases
FOR EACH ROW
EXECUTE FUNCTION public.clamp_audit_case_dos();