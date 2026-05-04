CREATE OR REPLACE FUNCTION public.generate_case_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  next_num INTEGER;
  candidate TEXT;
  attempts INTEGER := 0;
BEGIN
  IF NEW.case_number IS NOT NULL AND NEW.case_number <> '' THEN
    RETURN NEW;
  END IF;

  LOOP
    SELECT COALESCE(MAX(CAST(SUBSTRING(case_number FROM 'AUD-\d{4}-(\d+)') AS INTEGER)), 0) + 1
    INTO next_num
    FROM public.audit_cases
    WHERE case_number ~ ('^AUD-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-\d+$');

    candidate := 'AUD-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-' || LPAD(next_num::TEXT, 3, '0');

    IF NOT EXISTS (SELECT 1 FROM public.audit_cases WHERE case_number = candidate) THEN
      NEW.case_number := candidate;
      RETURN NEW;
    END IF;

    attempts := attempts + 1;
    IF attempts > 50 THEN
      NEW.case_number := 'AUD-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-' || LPAD((next_num + floor(random() * 1000000)::int)::TEXT, 6, '0');
      RETURN NEW;
    END IF;
  END LOOP;
END;
$function$;