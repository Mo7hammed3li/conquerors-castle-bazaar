-- Restrict full profile enumeration to the owner and head moderators only.
-- Staff with scoped suspension permissions must use the audited SECURITY DEFINER action;
-- that permission must not grant broad profile-table visibility.
DROP POLICY IF EXISTS profiles_read ON public.profiles;

CREATE POLICY profiles_read
ON public.profiles
FOR SELECT
TO authenticated
USING (
  id = (SELECT auth.uid())
  OR private.account_has_role((SELECT auth.uid()), 'owner')
  OR private.account_has_role((SELECT auth.uid()), 'head_moderator')
);
