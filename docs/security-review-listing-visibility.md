# Security review: listing visibility and authorization rollout

Reviewed against the source migrations on `mo7hammed-store-upgrade`. This document records findings and a remediation design; it is **not** a migration and has not been applied to the live database.

## Confirmed source-level findings

### 1. Hero rows can be read for non-public listings

`0000_store_schema.sql` creates the `heroes readable with listing` SELECT policy for both `anon` and `authenticated`. Its predicate only checks that a parent listing exists. It does not check moderation status or archival state.

`0002_phase_a_authorization.sql` drops the hero write policy but does not drop or replace this SELECT policy. Therefore, based on the migration source, hero metadata for pending, rejected, and archived listings remains readable to anonymous clients.

### 2. Private image objects can be read when attached to any listing

The bucket is private, but `0002_phase_a_authorization.sql` replaces the storage SELECT policy with `listing_images_visible`. Its predicate permits an object if its path appears in any listing's `images` array. It does not filter the parent listing by `status='approved'` or `archived_at IS NULL`.

A private bucket does not by itself prevent access when an RLS policy authorizes the Storage read or signed-URL request.

### 3. Authorization migration has a one-time bootstrap assumption

The source migration `0002_phase_a_authorization.sql` aborts unless there is exactly one row in `auth.users`, exactly one legacy admin, and that admin has the configured owner UUID. This is a bootstrap precondition, not a runtime user-count restriction. Once applied, the signup trigger assigns new users the customer role. Do not edit an already-applied migration; any rollout correction must be a separately reviewed follow-up migration.

## Proposed policy semantics for a reviewed follow-up

Public reads should be limited to listings with `status = 'approved'` and `archived_at IS NULL`.

- `listing_heroes`: allow a public read only when the parent listing is approved and not archived. Also allow the listing owner and users with an applicable `listings.review` or `listings.edit` authorization to inspect their permitted non-public listings.
- `storage.objects`: allow public reads only for image paths referenced by an approved, non-archived listing. Preserve private owner access for objects in that owner's folder. Allow appropriately scoped reviewers/editors to inspect images attached to listings they are authorized to manage.
- Keep the bucket private. Do not replace this with a public bucket.
- Avoid broad `TO authenticated` policies without row-level ownership or permission predicates.

Illustrative predicates to adapt only after checking the live schema and policy inventory:

```sql
-- Hero visibility predicate
EXISTS (
  SELECT 1
  FROM public.listings l
  WHERE l.id = listing_heroes.listing_id
    AND (
      (l.status = 'approved' AND l.archived_at IS NULL)
      OR l.user_id = auth.uid()
      OR public.account_can(auth.uid(), 'listings.review', l.user_id)
      OR public.account_can(auth.uid(), 'listings.edit', l.user_id)
    )
)

-- Storage visibility predicate
bucket_id = 'listing-images'
AND (
  (auth.uid() IS NOT NULL AND split_part(name, '/', 1) = auth.uid()::text)
  OR EXISTS (
    SELECT 1
    FROM public.listings l
    WHERE name = ANY(l.images)
      AND (
        (l.status = 'approved' AND l.archived_at IS NULL)
        OR l.user_id = auth.uid()
        OR public.account_can(auth.uid(), 'listings.review', l.user_id)
        OR public.account_can(auth.uid(), 'listings.edit', l.user_id)
      )
  )
)
```

These predicates are design guidance, not ready-to-run SQL. Confirm column qualification, policy composition (Postgres permissive policies are OR-combined by default), grants, and actual deployed policies before rollout.

## Required verification matrix

| Actor | Pending/rejected listing | Approved active listing | Archived listing |
|---|---|---|---|
| Anonymous visitor | No hero rows or images | Public hero rows and images | No hero rows or images |
| Unrelated signed-in customer | No hero rows or images | Public hero rows and images | No hero rows or images |
| Listing owner | Own hero rows and images | Own hero rows and images | Own hero rows and images |
| Scoped listing reviewer | Only listings within granted scope | Authorized listings | Only listings within granted scope |
| Owner | All listings | All listings | All listings |

Also test that an image path guessed from another user's folder is denied, that a signed URL cannot be minted for an unauthorized object, and that removing an image reference does not accidentally grant access.

## Rollout constraints

- The live Supabase connector currently denies migration-list and SQL-query access in this session. Live policy state therefore could not be re-read or verified here.
- Project instructions in `AGENTS.md` state that database migrations are managed by Lovable. Do not hand-edit `drizzle/migrations/` or apply SQL to production from this review.
- Do not change the owner UUID, roles, production data, project visibility, or deployment as part of this remediation.
- Run Supabase security advisors and the verification matrix after an authorized migration is applied.
