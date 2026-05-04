CREATE OR REPLACE FUNCTION public.clamp_audit_case_dos()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.date_of_service IS NOT NULL AND NEW.date_of_service > CURRENT_DATE THEN
    NEW.date_of_service := CURRENT_DATE;
  END IF;
  RETURN NEW;
END;
$$;