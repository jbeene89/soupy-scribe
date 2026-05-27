
DROP POLICY IF EXISTS "Authenticated users can view active payer anomalies" ON public.payer_anomaly_flags;
CREATE POLICY "Admins view payer anomalies"
  ON public.payer_anomaly_flags
  FOR SELECT
  TO authenticated
  USING (public.is_soupy_admin(auth.uid()) AND is_active = true);

DROP POLICY IF EXISTS "Users view relevant regulatory flags" ON public.regulatory_flags;
CREATE POLICY "Users view own case regulatory flags"
  ON public.regulatory_flags
  FOR SELECT
  TO authenticated
  USING (
    case_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.audit_cases
      WHERE audit_cases.id = regulatory_flags.case_id
        AND audit_cases.owner_id = auth.uid()
    )
  );
CREATE POLICY "Admins view global regulatory flags"
  ON public.regulatory_flags
  FOR SELECT
  TO authenticated
  USING (case_id IS NULL AND public.is_soupy_admin(auth.uid()));
