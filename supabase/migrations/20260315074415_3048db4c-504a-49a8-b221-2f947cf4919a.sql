-- Allow authenticated users to delete their own audit cases
CREATE POLICY "Users can delete own audit cases"
ON public.audit_cases
FOR DELETE
TO authenticated
USING (auth.uid() = owner_id);
