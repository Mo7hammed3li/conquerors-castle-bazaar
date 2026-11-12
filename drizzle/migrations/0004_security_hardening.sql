-- API privilege hardening and RLS/performance cleanup.
-- Applied to the standalone Supabase project on 2026-11-12.

REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM anon, authenticated;

-- Public marketplace reads only.
GRANT SELECT ON TABLE public.listings TO anon, authenticated;
GRANT SELECT ON TABLE public.listing_heroes TO anon, authenticated;
GRANT SELECT ON TABLE public.seller_public_profiles TO anon, authenticated;
GRANT SELECT ON TABLE public.seller_directory TO anon, authenticated;

-- Signed-in account reads, still constrained by RLS.
GRANT SELECT ON TABLE
  public.account_permissions,
  public.account_roles,
  public.admin_audit,
  public.favorites,
  public.profiles,
  public.seller_applications,
  public.user_roles
TO authenticated;

-- Direct client writes supported by the current RLS policies.
GRANT INSERT, UPDATE, DELETE ON TABLE public.favorites TO authenticated;
GRANT UPDATE ON TABLE public.profiles TO authenticated;

-- Make the aggregate seller directory obey underlying-table RLS.
ALTER VIEW public.seller_directory SET (security_invoker = true);

-- Keep anonymous users on the public approved-listing policy only.
DROP POLICY IF EXISTS approved_public ON public.listings;
DROP POLICY IF EXISTS listings_private_read ON public.listings;

CREATE POLICY listings_public_read
ON public.listings
FOR SELECT
TO anon
USING (status = 'approved'::public.listing_status AND archived_at IS NULL);

CREATE POLICY listings_authenticated_read
ON public.listings
FOR SELECT
TO authenticated
USING (
  (status = 'approved'::public.listing_status AND archived_at IS NULL)
  OR user_id = (SELECT auth.uid())
  OR public.account_can((SELECT auth.uid()), 'listings.review', user_id)
  OR public.account_can((SELECT auth.uid()), 'listings.edit', user_id)
);
