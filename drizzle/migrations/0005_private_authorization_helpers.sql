-- Move internal authorization primitives out of the exposed public API schema.
CREATE SCHEMA IF NOT EXISTS private AUTHORIZATION postgres;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA private TO authenticated;

ALTER FUNCTION public.account_has_role(uuid, text) SET SCHEMA private;
ALTER FUNCTION public.account_can(uuid, text, uuid) SET SCHEMA private;
ALTER FUNCTION public.can_sell(uuid) SET SCHEMA private;
ALTER FUNCTION public.is_banned(uuid) SET SCHEMA private;

DO $$
DECLARE
  item record;
  definition text;
BEGIN
  FOR item IN
    SELECT p.oid
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname IN ('public', 'private')
      AND p.prokind = 'f'
      AND (
        pg_get_functiondef(p.oid) LIKE '%public.account_has_role%'
        OR pg_get_functiondef(p.oid) LIKE '%public.account_can%'
        OR pg_get_functiondef(p.oid) LIKE '%public.can_sell%'
        OR pg_get_functiondef(p.oid) LIKE '%public.is_banned%'
      )
  LOOP
    definition := pg_get_functiondef(item.oid);
    definition := replace(definition, 'public.account_has_role', 'private.account_has_role');
    definition := replace(definition, 'public.account_can', 'private.account_can');
    definition := replace(definition, 'public.can_sell', 'private.can_sell');
    definition := replace(definition, 'public.is_banned', 'private.is_banned');
    EXECUTE definition;
  END LOOP;
END
$$;

REVOKE ALL ON FUNCTION private.account_has_role(uuid, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.account_can(uuid, text, uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.can_sell(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.is_banned(uuid) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION private.account_has_role(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION private.account_can(uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_sell(uuid) TO authenticated;
