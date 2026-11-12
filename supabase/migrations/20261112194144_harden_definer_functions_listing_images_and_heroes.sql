-- Keep every SECURITY DEFINER routine independent of objects injected into exposed schemas.
ALTER FUNCTION private.account_can(uuid, text, uuid) SET search_path = '';
ALTER FUNCTION private.account_has_role(uuid, text) SET search_path = '';
ALTER FUNCTION private.can_sell(uuid) SET search_path = '';
ALTER FUNCTION private.is_banned(uuid) SET search_path = '';

ALTER FUNCTION public.admin_list_accounts() SET search_path = '';
ALTER FUNCTION public.handle_new_user() SET search_path = '';
ALTER FUNCTION public.has_role(uuid, public.app_role) SET search_path = '';
ALTER FUNCTION public.listing_moderation() SET search_path = '';
ALTER FUNCTION public.marketplace_action(text, uuid, jsonb, text) SET search_path = '';
ALTER FUNCTION public.profile_guard() SET search_path = '';
ALTER FUNCTION public.protect_profile_ban() SET search_path = '';
ALTER FUNCTION public.public_profiles(uuid[]) SET search_path = '';
ALTER FUNCTION public.rls_auto_enable() SET search_path = '';
ALTER FUNCTION public.save_castle(jsonb, uuid) SET search_path = '';
ALTER FUNCTION public.sync_seller_public_profile() SET search_path = '';
ALTER FUNCTION public.username_available(text) SET search_path = '';

-- Remove broad/default execution rights from privileged routines.
REVOKE EXECUTE ON FUNCTION private.account_can(uuid, text, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION private.account_has_role(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION private.can_sell(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION private.is_banned(uuid) FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION public.admin_list_accounts() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.listing_moderation() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.marketplace_action(text, uuid, jsonb, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.profile_guard() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.protect_profile_ban() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.public_profiles(uuid[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.save_castle(jsonb, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.sync_seller_public_profile() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.username_available(text) FROM PUBLIC, anon;

-- Restore only the intended client-facing entry points and internal RLS helpers.
GRANT EXECUTE ON FUNCTION private.account_can(uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.account_has_role(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_sell(uuid) TO authenticated;

GRANT EXECUTE ON FUNCTION public.admin_list_accounts() TO authenticated;
GRANT EXECUTE ON FUNCTION public.marketplace_action(text, uuid, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_castle(jsonb, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.public_profiles(uuid[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.username_available(text) TO anon, authenticated;

-- Restrict listing image uploads to the same raster formats accepted by the UI.
UPDATE storage.buckets
SET allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
WHERE id = 'listing-images';

-- Enforce the actual 27-hero catalogue at the database boundary as well as in the UI.
ALTER TABLE public.listing_heroes
  ADD CONSTRAINT listing_heroes_hero_key_check
  CHECK (hero_key = ANY (ARRAY[
    'mukhtar','fatih','ertugrul','qalawun','mawiya','zainab',
    'saladin','qutuz','malik','barquq','zubaida','nefertiti','kafur',
    'baron','harun','burak','iskandar','abdulrahman','jawhar','salih_ali',
    'halima','zarqa','barbarossa','qaitbay','kosem','orhan','attila'
  ]::text[]));
