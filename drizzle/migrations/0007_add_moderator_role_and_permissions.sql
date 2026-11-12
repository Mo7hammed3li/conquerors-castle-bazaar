-- Add an explicit moderator role and permit owner-managed staff permissions.
ALTER TABLE public.account_roles
  DROP CONSTRAINT IF EXISTS account_roles_role_check;

ALTER TABLE public.account_roles
  ADD CONSTRAINT account_roles_role_check
  CHECK (role = ANY (ARRAY['owner','head_moderator','moderator','seller','customer']::text[]));

CREATE OR REPLACE FUNCTION public.marketplace_action(
  _action text,
  _target uuid DEFAULT NULL::uuid,
  _payload jsonb DEFAULT '{}'::jsonb,
  _reason text DEFAULT ''::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  actor uuid := auth.uid();
  l public.listings;
  app public.seller_applications;
  chosen_role text;
  perm text;
  scope_id uuid;
BEGIN
  IF actor IS NULL OR private.is_banned(actor) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF _action = 'apply_seller' THEN
    IF private.can_sell(actor)
       OR length(trim(COALESCE(_payload->>'message',''))) NOT BETWEEN 1 AND 2000 THEN
      RAISE EXCEPTION 'Invalid application';
    END IF;
    INSERT INTO public.seller_applications(user_id,message)
    VALUES(actor,trim(_payload->>'message'))
    RETURNING id INTO _target;

  ELSIF _action = 'review_seller' THEN
    SELECT * INTO app FROM public.seller_applications WHERE id=_target FOR UPDATE;
    IF app.id IS NULL OR app.status<>'pending' OR app.user_id=actor
       OR NOT private.account_can(actor,'sellers.review',app.user_id) THEN
      RAISE EXCEPTION 'Forbidden';
    END IF;
    IF _payload->>'status' IS NULL OR _payload->>'status' NOT IN ('approved','rejected') THEN
      RAISE EXCEPTION 'Invalid status';
    END IF;
    UPDATE public.seller_applications
      SET status=_payload->>'status', reason=_reason, reviewed_by=actor, reviewed_at=now()
      WHERE id=_target;
    IF _payload->>'status'='approved' THEN
      INSERT INTO public.account_roles(user_id,role)
      VALUES(app.user_id,'seller') ON CONFLICT DO NOTHING;
    END IF;

  ELSIF _action IN ('set_role','set_permission','suspend') THEN
    IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=_target)
       OR _target=actor OR private.account_has_role(_target,'owner') THEN
      RAISE EXCEPTION 'Protected account';
    END IF;

    IF _action = 'set_role' THEN
      IF NOT private.account_has_role(actor,'owner') THEN
        RAISE EXCEPTION 'Owner only';
      END IF;
      chosen_role := _payload->>'role';
      IF chosen_role IS NULL OR chosen_role NOT IN ('moderator','head_moderator','seller') THEN
        RAISE EXCEPTION 'Invalid role';
      END IF;
      IF COALESCE((_payload->>'enabled')::boolean,false) THEN
        INSERT INTO public.account_roles(user_id,role)
        VALUES(_target,chosen_role) ON CONFLICT DO NOTHING;
      ELSE
        DELETE FROM public.account_roles WHERE user_id=_target AND role=chosen_role;
        IF chosen_role IN ('moderator','head_moderator') THEN
          DELETE FROM public.account_permissions WHERE user_id=_target;
        END IF;
      END IF;

    ELSIF _action = 'set_permission' THEN
      perm := _payload->>'permission';
      scope_id := NULLIF(_payload->>'scope_user_id','')::uuid;
      IF perm IS NULL OR perm NOT IN ('listings.review','listings.edit','sellers.review','accounts.suspend')
         OR NOT (
           private.account_has_role(_target,'seller')
           OR private.account_has_role(_target,'moderator')
           OR private.account_has_role(_target,'head_moderator')
         ) THEN
        RAISE EXCEPTION 'Invalid permission recipient';
      END IF;
      IF NOT private.account_has_role(actor,'owner') THEN
        IF NOT private.account_has_role(actor,'head_moderator')
           OR private.account_has_role(_target,'head_moderator')
           OR scope_id IS NULL
           OR perm NOT IN ('listings.review','listings.edit')
           OR NOT private.account_can(actor,perm,scope_id) THEN
          RAISE EXCEPTION 'Forbidden delegation';
        END IF;
      END IF;
      IF COALESCE((_payload->>'enabled')::boolean,false) THEN
        INSERT INTO public.account_permissions(user_id,permission,scope_user_id,granted_by)
        VALUES(_target,perm,scope_id,actor) ON CONFLICT DO NOTHING;
      ELSE
        DELETE FROM public.account_permissions
        WHERE user_id=_target AND permission=perm
          AND scope_user_id IS NOT DISTINCT FROM scope_id;
      END IF;

    ELSE
      IF NOT private.account_can(actor,'accounts.suspend',_target)
         OR (private.account_has_role(_target,'head_moderator')
             AND NOT private.account_has_role(actor,'owner')) THEN
        RAISE EXCEPTION 'Forbidden';
      END IF;
      UPDATE public.profiles
        SET is_banned=COALESCE((_payload->>'enabled')::boolean,false)
        WHERE id=_target;
    END IF;

  ELSIF _action IN ('moderate_listing','archive_listing') THEN
    SELECT * INTO l FROM public.listings WHERE id=_target FOR UPDATE;
    IF l.id IS NULL THEN RAISE EXCEPTION 'Listing not found'; END IF;

    IF _action='moderate_listing' THEN
      IF NOT private.account_can(actor,'listings.review',l.user_id) OR l.archived_at IS NOT NULL THEN
        RAISE EXCEPTION 'Forbidden';
      END IF;
      IF _payload->>'status' IS NULL OR _payload->>'status' NOT IN ('approved','rejected','pending') THEN
        RAISE EXCEPTION 'Invalid status';
      END IF;
      UPDATE public.listings
        SET status=(_payload->>'status')::public.listing_status,
            rejection_reason=NULLIF(_reason,'')
        WHERE id=_target;
    ELSE
      IF NOT ((actor=l.user_id AND private.can_sell(actor))
              OR private.account_can(actor,'listings.review',l.user_id)) THEN
        RAISE EXCEPTION 'Forbidden';
      END IF;
      UPDATE public.listings SET archived_at=now() WHERE id=_target;
    END IF;
  ELSE
    RAISE EXCEPTION 'Unknown action';
  END IF;

  IF _action<>'apply_seller' AND length(trim(_reason))=0 THEN
    RAISE EXCEPTION 'Reason required';
  END IF;

  INSERT INTO public.admin_audit(actor,action,target,reason,details)
  VALUES(actor,_action,_target,
         COALESCE(NULLIF(_reason,''),'Seller application submitted'),_payload);

  RETURN jsonb_build_object('id',_target);
END
$function$;
