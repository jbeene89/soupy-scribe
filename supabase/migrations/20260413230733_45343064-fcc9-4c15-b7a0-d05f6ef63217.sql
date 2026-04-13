
-- 1. Fix storage policies: restrict case-files to owner-scoped access via folder path
-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Authenticated users can view case files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload case files" ON storage.objects;

-- New owner-scoped SELECT policy (folder structure: {user_id}/{case_id}/filename)
CREATE POLICY "Users can view own case files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'case-files'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- New owner-scoped INSERT policy
CREATE POLICY "Users can upload own case files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'case-files'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- New owner-scoped DELETE policy
CREATE POLICY "Users can delete own case files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'case-files'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 2. Fix organizations INSERT policy: scope to user creating their own org
DROP POLICY IF EXISTS "Authenticated users can create orgs" ON public.organizations;
CREATE POLICY "Authenticated users can create orgs"
ON public.organizations FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.org_members
    WHERE org_members.org_id = organizations.id
    AND org_members.user_id = auth.uid()
  )
  OR NOT EXISTS (
    SELECT 1 FROM public.org_members
    WHERE org_members.org_id = organizations.id
  )
);
