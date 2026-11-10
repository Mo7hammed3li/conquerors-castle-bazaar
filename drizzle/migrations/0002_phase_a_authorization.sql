CREATE TABLE public.account_roles(user_id uuid NOT NULL REFERENCES public.profiles(id),role text NOT NULL CHECK(role IN ('owner','head_moderator','seller','customer')),PRIMARY KEY(user_id,role));
GRANT SELECT ON public.account_roles TO authenticated; GRANT ALL ON public.account_roles TO service_role; ALTER TABLE public.account_roles ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX sole_platform_owner ON public.account_roles(role) WHERE role='owner';
DO $$ BEGIN IF (SELECT count(*) FROM auth.users)<>1 OR (SELECT count(*) FROM public.user_roles WHERE role='admin')<>1 OR NOT EXISTS(SELECT 1 FROM public.user_roles r JOIN auth.users u ON u.id=r.user_id JOIN public.profiles p ON p.id=u.id WHERE r.role='admin' AND u.id='aad0b037-ff7a-4d92-bfbc-5d5f23f7990b') THEN RAISE EXCEPTION 'Owner mapping changed'; END IF; END $$;
INSERT INTO public.account_roles SELECT id,'customer' FROM public.profiles; INSERT INTO public.account_roles SELECT user_id,'owner' FROM public.user_roles WHERE role='admin';
COMMENT ON TABLE public.user_roles IS 'DEPRECATED: legacy rows retained; account_roles now authorizes';
CREATE TABLE public.account_permissions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES public.profiles(id),permission text NOT NULL CHECK(permission IN ('listings.review','listings.edit','sellers.review','accounts.suspend')),scope_user_id uuid REFERENCES public.profiles(id),granted_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.account_permissions TO authenticated; GRANT ALL ON public.account_permissions TO service_role; ALTER TABLE public.account_permissions ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX permission_assignment_unique ON public.account_permissions(user_id,permission,COALESCE(scope_user_id,'00000000-0000-0000-0000-000000000000'::uuid));
CREATE TABLE public.seller_applications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES public.profiles(id),message text NOT NULL DEFAULT '',status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),reason text,reviewed_by uuid,created_at timestamptz NOT NULL DEFAULT now(),reviewed_at timestamptz);
GRANT SELECT ON public.seller_applications TO authenticated; GRANT ALL ON public.seller_applications TO service_role; ALTER TABLE public.seller_applications ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX one_pending_application ON public.seller_applications(user_id) WHERE status='pending';
CREATE TABLE public.admin_audit(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),actor uuid NOT NULL,action text NOT NULL,target uuid,created_at timestamptz NOT NULL DEFAULT now(),reason text NOT NULL,details jsonb NOT NULL DEFAULT '{}');
GRANT SELECT ON public.admin_audit TO authenticated; GRANT SELECT,INSERT ON public.admin_audit TO service_role; ALTER TABLE public.admin_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listings ADD COLUMN archived_at timestamptz;
CREATE FUNCTION public.account_has_role(_user uuid,_role text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM public.account_roles WHERE user_id=_user AND role=_role) $$;
CREATE FUNCTION public.account_can(_user uuid,_permission text,_target uuid DEFAULT NULL) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT _user IS NOT NULL AND NOT public.is_banned(_user) AND (public.account_has_role(_user,'owner') OR (public.account_has_role(_user,'head_moderator') AND _permission IN ('listings.review','sellers.review')) OR EXISTS(SELECT 1 FROM public.account_permissions WHERE user_id=_user AND permission=_permission AND (scope_user_id IS NULL OR scope_user_id=_target))) $$;
CREATE FUNCTION public.can_sell(_user uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT _user IS NOT NULL AND NOT public.is_banned(_user) AND (public.account_has_role(_user,'seller') OR public.account_has_role(_user,'owner')) $$;
CREATE POLICY roles_visible ON public.account_roles FOR SELECT TO authenticated USING(user_id=auth.uid() OR public.account_has_role(auth.uid(),'owner') OR public.account_has_role(auth.uid(),'head_moderator'));
CREATE POLICY permissions_visible ON public.account_permissions FOR SELECT TO authenticated USING(user_id=auth.uid() OR public.account_has_role(auth.uid(),'owner') OR public.account_has_role(auth.uid(),'head_moderator'));
CREATE POLICY applications_visible ON public.seller_applications FOR SELECT TO authenticated USING(user_id=auth.uid() OR public.account_can(auth.uid(),'sellers.review',user_id));
CREATE POLICY audits_visible ON public.admin_audit FOR SELECT TO authenticated USING(public.account_has_role(auth.uid(),'owner') OR actor=auth.uid());
CREATE FUNCTION public.audit_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN RAISE EXCEPTION 'Audit records are append-only'; END $$;
CREATE TRIGGER immutable_audit BEFORE UPDATE OR DELETE ON public.admin_audit FOR EACH ROW EXECUTE FUNCTION public.audit_immutable();
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN INSERT INTO public.profiles(id,display_name) VALUES(NEW.id,COALESCE(NEW.raw_user_meta_data->>'display_name',NEW.raw_user_meta_data->>'full_name',split_part(NEW.email,'@',1))); INSERT INTO public.account_roles(user_id,role) VALUES(NEW.id,'customer'); RETURN NEW; END $$;
REVOKE INSERT,UPDATE,DELETE ON public.user_roles FROM authenticated,anon;
DROP POLICY "admin add roles" ON public.user_roles; DROP POLICY "admin remove roles" ON public.user_roles; DROP POLICY "roles read" ON public.user_roles;
CREATE POLICY legacy_roles_read ON public.user_roles FOR SELECT TO authenticated USING(user_id=auth.uid() OR public.account_has_role(auth.uid(),'owner'));
REVOKE UPDATE ON public.profiles FROM authenticated; GRANT UPDATE(display_name) ON public.profiles TO authenticated;
DROP POLICY "own profile read" ON public.profiles; DROP POLICY "own profile update" ON public.profiles;
CREATE POLICY profiles_read ON public.profiles FOR SELECT TO authenticated USING(id=auth.uid() OR public.account_has_role(auth.uid(),'owner') OR public.account_has_role(auth.uid(),'head_moderator') OR public.account_can(auth.uid(),'accounts.suspend',id));
CREATE POLICY profiles_update ON public.profiles FOR UPDATE TO authenticated USING(id=auth.uid()) WITH CHECK(id=auth.uid());
CREATE OR REPLACE FUNCTION public.protect_profile_ban() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN IF NEW.is_banned IS DISTINCT FROM OLD.is_banned AND (NOT public.account_can(auth.uid(),'accounts.suspend',OLD.id) OR public.account_has_role(OLD.id,'owner') OR (public.account_has_role(OLD.id,'head_moderator') AND NOT public.account_has_role(auth.uid(),'owner'))) THEN RAISE EXCEPTION 'Forbidden'; END IF; RETURN NEW; END $$;
REVOKE INSERT,UPDATE,DELETE ON public.listings,public.listing_heroes FROM authenticated,anon;
DROP POLICY "approved public" ON public.listings; DROP POLICY "owner or admin read" ON public.listings; DROP POLICY "owner insert" ON public.listings; DROP POLICY "owner or admin update" ON public.listings; DROP POLICY "owner or admin delete" ON public.listings;
CREATE POLICY approved_public ON public.listings FOR SELECT TO anon,authenticated USING(status='approved' AND archived_at IS NULL);
CREATE POLICY listings_private_read ON public.listings FOR SELECT TO authenticated USING(user_id=auth.uid() OR public.account_can(auth.uid(),'listings.review',user_id) OR public.account_can(auth.uid(),'listings.edit',user_id));
DROP POLICY "heroes write by owner or admin" ON public.listing_heroes;
CREATE OR REPLACE FUNCTION public.listing_moderation() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN NEW.updated_at:=now(); IF TG_OP='INSERT' THEN NEW.status:='pending'; NEW.rejection_reason:=NULL; ELSE NEW.user_id:=OLD.user_id; IF (to_jsonb(NEW)-ARRAY['status','rejection_reason','updated_at','archived_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','rejection_reason','updated_at','archived_at']) OR NOT public.account_can(auth.uid(),'listings.review',OLD.user_id) THEN NEW.status:='pending'; NEW.rejection_reason:=NULL; END IF; END IF; RETURN NEW; END $$;
CREATE FUNCTION public.marketplace_action(_action text,_target uuid DEFAULT NULL,_payload jsonb DEFAULT '{}',_reason text DEFAULT '') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE actor uuid:=auth.uid(); l public.listings; app public.seller_applications; chosen_role text; perm text; scope_id uuid;
BEGIN
IF actor IS NULL OR public.is_banned(actor) THEN RAISE EXCEPTION 'Unauthorized'; END IF;
IF _action='apply_seller' THEN
 IF public.can_sell(actor) OR length(trim(COALESCE(_payload->>'message',''))) NOT BETWEEN 1 AND 2000 THEN RAISE EXCEPTION 'Invalid application'; END IF;
 INSERT INTO public.seller_applications(user_id,message) VALUES(actor,trim(_payload->>'message')) RETURNING id INTO _target;
ELSIF _action='review_seller' THEN
 SELECT * INTO app FROM public.seller_applications WHERE id=_target FOR UPDATE;
 IF app.id IS NULL OR app.status<>'pending' OR app.user_id=actor OR NOT public.account_can(actor,'sellers.review',app.user_id) THEN RAISE EXCEPTION 'Forbidden'; END IF;
 IF _payload->>'status' IS NULL OR _payload->>'status' NOT IN ('approved','rejected') THEN RAISE EXCEPTION 'Invalid status'; END IF;
 UPDATE public.seller_applications SET status=_payload->>'status',reason=_reason,reviewed_by=actor,reviewed_at=now() WHERE id=_target;
 IF _payload->>'status'='approved' THEN INSERT INTO public.account_roles VALUES(app.user_id,'seller') ON CONFLICT DO NOTHING; END IF;
ELSIF _action IN ('set_role','set_permission','suspend') THEN
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=_target) OR _target=actor OR public.account_has_role(_target,'owner') THEN RAISE EXCEPTION 'Protected account'; END IF;
 IF _action='set_role' THEN
  IF NOT public.account_has_role(actor,'owner') THEN RAISE EXCEPTION 'Owner only'; END IF;
  chosen_role:=_payload->>'role'; IF chosen_role IS NULL OR chosen_role NOT IN ('head_moderator','seller') THEN RAISE EXCEPTION 'Invalid role'; END IF;
  IF COALESCE((_payload->>'enabled')::boolean,false) THEN INSERT INTO public.account_roles VALUES(_target,chosen_role) ON CONFLICT DO NOTHING; ELSE DELETE FROM public.account_roles WHERE user_id=_target AND role=chosen_role; DELETE FROM public.account_permissions WHERE user_id=_target; END IF;
 ELSIF _action='set_permission' THEN
  perm:=_payload->>'permission'; scope_id:=NULLIF(_payload->>'scope_user_id','')::uuid;
  IF perm IS NULL OR perm NOT IN ('listings.review','listings.edit','sellers.review','accounts.suspend') OR NOT (public.account_has_role(_target,'seller') OR public.account_has_role(_target,'head_moderator')) THEN RAISE EXCEPTION 'Invalid permission recipient'; END IF;
  IF NOT public.account_has_role(actor,'owner') THEN
   IF NOT public.account_has_role(actor,'head_moderator') OR public.account_has_role(_target,'head_moderator') OR scope_id IS NULL OR perm NOT IN ('listings.review','listings.edit') OR NOT public.account_can(actor,perm,scope_id) THEN RAISE EXCEPTION 'Forbidden delegation'; END IF;
  END IF;
  IF COALESCE((_payload->>'enabled')::boolean,false) THEN INSERT INTO public.account_permissions(user_id,permission,scope_user_id,granted_by) VALUES(_target,perm,scope_id,actor) ON CONFLICT DO NOTHING; ELSE DELETE FROM public.account_permissions WHERE user_id=_target AND permission=perm AND scope_user_id IS NOT DISTINCT FROM scope_id; END IF;
 ELSE
  IF NOT public.account_can(actor,'accounts.suspend',_target) OR (public.account_has_role(_target,'head_moderator') AND NOT public.account_has_role(actor,'owner')) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  UPDATE public.profiles SET is_banned=COALESCE((_payload->>'enabled')::boolean,false) WHERE id=_target;
 END IF;
ELSIF _action IN ('moderate_listing','archive_listing') THEN
 SELECT * INTO l FROM public.listings WHERE id=_target FOR UPDATE;
 IF l.id IS NULL THEN RAISE EXCEPTION 'Listing not found'; END IF;
 IF _action='moderate_listing' THEN
  IF NOT public.account_can(actor,'listings.review',l.user_id) OR l.archived_at IS NOT NULL THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF _payload->>'status' IS NULL OR _payload->>'status' NOT IN ('approved','rejected','pending') THEN RAISE EXCEPTION 'Invalid status'; END IF;
  UPDATE public.listings SET status=(_payload->>'status')::public.listing_status,rejection_reason=NULLIF(_reason,'') WHERE id=_target;
 ELSE
  IF NOT ((actor=l.user_id AND public.can_sell(actor)) OR public.account_can(actor,'listings.review',l.user_id)) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  UPDATE public.listings SET archived_at=now() WHERE id=_target;
 END IF;
ELSE RAISE EXCEPTION 'Unknown action'; END IF;
IF _action<>'apply_seller' AND length(trim(_reason))=0 THEN RAISE EXCEPTION 'Reason required'; END IF;
INSERT INTO public.admin_audit(actor,action,target,reason,details) VALUES(actor,_action,_target,COALESCE(NULLIF(_reason,''),'Seller application submitted'),_payload);
RETURN jsonb_build_object('id',_target);
END $$;
CREATE FUNCTION public.save_castle(_values jsonb,_id uuid DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE actor uuid:=auth.uid(); old_row public.listings; r public.listings; hero jsonb; result_id uuid;
BEGIN
IF actor IS NULL OR public.is_banned(actor) THEN RAISE EXCEPTION 'Unauthorized'; END IF;
IF _id IS NOT NULL THEN SELECT * INTO old_row FROM public.listings WHERE id=_id FOR UPDATE; IF old_row.id IS NULL OR old_row.archived_at IS NOT NULL OR NOT ((old_row.user_id=actor AND public.can_sell(actor)) OR public.account_can(actor,'listings.edit',old_row.user_id)) THEN RAISE EXCEPTION 'Forbidden'; END IF; ELSE IF NOT public.can_sell(actor) THEN RAISE EXCEPTION 'Seller approval required'; END IF; END IF;
SELECT * INTO r FROM jsonb_populate_record(NULL::public.listings,_values);
IF r.castle_level IS NULL OR r.power IS NULL OR r.price IS NULL OR length(trim(COALESCE(r.server,''))) NOT BETWEEN 1 AND 30 OR r.whatsapp IS NULL OR r.whatsapp !~ '^\+?[0-9]{8,15}$' OR length(COALESCE(r.description,''))>3000 OR r.price>10000000 OR cardinality(r.images)>10 THEN RAISE EXCEPTION 'Invalid listing'; END IF;
IF EXISTS(SELECT 1 FROM unnest(COALESCE(r.images,'{}')) path WHERE NOT EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id='listing-images' AND o.name=path AND (split_part(path,'/',1)=actor::text OR path=ANY(COALESCE(old_row.images,'{}'))))) THEN RAISE EXCEPTION 'Invalid image ownership'; END IF;
IF _id IS NULL THEN
 INSERT INTO public.listings(user_id,castle_level,power,description,science_power,reserve,server,price,whatsapp,images,equip_normal,equip_green,equip_blue,equip_purple,equip_gold,link_igg,link_google,link_facebook,link_icloud,link_gamecenter,link_device) VALUES(actor,r.castle_level,r.power,COALESCE(r.description,''),COALESCE(r.science_power,0),COALESCE(r.reserve,0),r.server,r.price,r.whatsapp,COALESCE(r.images,'{}'),COALESCE(r.equip_normal,0),COALESCE(r.equip_green,0),COALESCE(r.equip_blue,0),COALESCE(r.equip_purple,0),COALESCE(r.equip_gold,0),COALESCE(r.link_igg,false),COALESCE(r.link_google,false),COALESCE(r.link_facebook,false),COALESCE(r.link_icloud,false),COALESCE(r.link_gamecenter,false),COALESCE(r.link_device,false)) RETURNING id INTO result_id;
ELSE
 UPDATE public.listings SET castle_level=r.castle_level,power=r.power,description=COALESCE(r.description,''),science_power=COALESCE(r.science_power,0),reserve=COALESCE(r.reserve,0),server=r.server,price=r.price,whatsapp=r.whatsapp,images=COALESCE(r.images,'{}'),equip_normal=r.equip_normal,equip_green=r.equip_green,equip_blue=r.equip_blue,equip_purple=r.equip_purple,equip_gold=r.equip_gold,link_igg=r.link_igg,link_google=r.link_google,link_facebook=r.link_facebook,link_icloud=r.link_icloud,link_gamecenter=r.link_gamecenter,link_device=r.link_device,status='pending',rejection_reason=NULL WHERE id=_id RETURNING id INTO result_id;
 DELETE FROM public.listing_heroes WHERE listing_id=result_id;
END IF;
FOR hero IN SELECT * FROM jsonb_array_elements(COALESCE(_values->'heroes','[]')) LOOP INSERT INTO public.listing_heroes(listing_id,hero_key,crescents,red_crescents) VALUES(result_id,hero->>'hero_key',COALESCE(NULLIF(hero->>'crescents','')::integer,0),COALESCE(NULLIF(hero->>'red_crescents','')::integer,0)); END LOOP;
UPDATE public.listings SET status='pending',rejection_reason=NULL WHERE id=result_id;
IF _id IS NOT NULL AND actor<>old_row.user_id THEN INSERT INTO public.admin_audit(actor,action,target,reason) VALUES(actor,'edit_listing',result_id,'Delegated listing edit'); END IF;
RETURN result_id;
END $$;
DROP POLICY "listing images read" ON storage.objects; DROP POLICY "listing images upload own folder" ON storage.objects; DROP POLICY "listing images delete own or admin" ON storage.objects;
CREATE POLICY listing_images_visible ON storage.objects FOR SELECT TO anon,authenticated USING(bucket_id='listing-images' AND (split_part(name,'/',1)=auth.uid()::text OR EXISTS(SELECT 1 FROM public.listings l WHERE storage.objects.name=ANY(l.images))));
CREATE POLICY listing_images_upload ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='listing-images' AND split_part(name,'/',1)=auth.uid()::text AND public.can_sell(auth.uid()));
CREATE POLICY listing_images_remove ON storage.objects FOR DELETE TO authenticated USING(bucket_id='listing-images' AND split_part(name,'/',1)=auth.uid()::text AND public.can_sell(auth.uid()) AND NOT EXISTS(SELECT 1 FROM public.listings l WHERE storage.objects.name=ANY(l.images)));
REVOKE EXECUTE ON FUNCTION public.has_role(uuid,public.app_role),public.is_banned(uuid),public.handle_new_user(),public.protect_profile_ban(),public.listing_moderation(),public.audit_immutable(),public.account_has_role(uuid,text),public.account_can(uuid,text,uuid),public.can_sell(uuid),public.marketplace_action(text,uuid,jsonb,text),public.save_castle(jsonb,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid,public.app_role),public.is_banned(uuid),public.account_has_role(uuid,text),public.account_can(uuid,text,uuid),public.can_sell(uuid),public.marketplace_action(text,uuid,jsonb,text),public.save_castle(jsonb,uuid) TO authenticated;
