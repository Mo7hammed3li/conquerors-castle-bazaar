ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username text, ADD COLUMN IF NOT EXISTS avatar_path text;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_key ON public.profiles (lower(username));

CREATE OR REPLACE FUNCTION public.valid_username(_u text) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path TO 'public'
AS $$ SELECT _u ~ '^[a-z0-9_]{3,20}$' AND _u !~ '^_|_$' $$;

CREATE OR REPLACE FUNCTION public.profile_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$ BEGIN
 IF NEW.username IS NOT NULL THEN NEW.username := lower(trim(NEW.username)); END IF;
 IF NEW.username IS DISTINCT FROM OLD.username THEN
  IF OLD.username IS NOT NULL AND NOT public.account_has_role(auth.uid(),'owner') THEN RAISE EXCEPTION 'Username is permanent'; END IF;
  IF NEW.username IS NULL OR NOT public.valid_username(NEW.username) THEN RAISE EXCEPTION 'Invalid username'; END IF;
 END IF;
 IF NEW.display_name IS NOT NULL AND length(trim(NEW.display_name)) NOT BETWEEN 1 AND 40 THEN RAISE EXCEPTION 'Invalid display name'; END IF;
 IF NEW.avatar_path IS DISTINCT FROM OLD.avatar_path AND NEW.avatar_path IS NOT NULL THEN
  IF split_part(NEW.avatar_path,'/',1) <> OLD.id::text OR NOT EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id='avatars' AND o.name=NEW.avatar_path) THEN RAISE EXCEPTION 'Invalid avatar'; END IF;
 END IF;
 NEW.id := OLD.id; NEW.created_at := OLD.created_at;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS profiles_guard ON public.profiles;
CREATE TRIGGER profiles_guard BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.profile_guard();

-- Signup: username from metadata is only a suggestion; validated and uniqueness-checked here, never used for authorization.
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$ DECLARE u text := lower(trim(COALESCE(NEW.raw_user_meta_data->>'username',''))); BEGIN
 IF NOT public.valid_username(u) OR EXISTS(SELECT 1 FROM public.profiles WHERE lower(username)=u) THEN u := NULL; END IF;
 BEGIN
  INSERT INTO public.profiles(id,display_name,username) VALUES(NEW.id,left(COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'display_name'),''),NULLIF(trim(NEW.raw_user_meta_data->>'full_name'),''),split_part(NEW.email,'@',1)),40),u);
 EXCEPTION WHEN unique_violation THEN
  INSERT INTO public.profiles(id,display_name) VALUES(NEW.id,left(COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'display_name'),''),split_part(NEW.email,'@',1)),40));
 END;
 INSERT INTO public.account_roles(user_id,role) VALUES(NEW.id,'customer');
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.username_available(_u text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT public.valid_username(lower(trim(_u))) AND NOT EXISTS(SELECT 1 FROM public.profiles WHERE lower(username)=lower(trim(_u)) AND id IS DISTINCT FROM auth.uid()) $$;

-- Public identity card: only safe fields, only for sellers with live listings, yourself, or staff.
CREATE OR REPLACE FUNCTION public.public_profiles(_ids uuid[]) RETURNS TABLE(id uuid, username text, display_name text, avatar_path text, is_seller boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT p.id,p.username,p.display_name,p.avatar_path,public.can_sell(p.id) FROM public.profiles p
 WHERE p.id = ANY(_ids) AND (p.id=auth.uid() OR public.account_has_role(auth.uid(),'owner') OR public.account_has_role(auth.uid(),'head_moderator')
  OR EXISTS(SELECT 1 FROM public.listings l WHERE l.user_id=p.id AND l.status='approved' AND l.archived_at IS NULL)) $$;

CREATE OR REPLACE FUNCTION public.admin_list_accounts() RETURNS TABLE(id uuid, username text, display_name text, avatar_path text, email text, roles text[], is_banned boolean, created_at timestamptz, listings_count bigint, seller_application text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ BEGIN
 IF NOT (public.account_has_role(auth.uid(),'owner') OR public.account_has_role(auth.uid(),'head_moderator')) OR public.is_banned(auth.uid()) THEN RAISE EXCEPTION 'Forbidden'; END IF;
 RETURN QUERY SELECT p.id,p.username,p.display_name,p.avatar_path,u.email::text,
  COALESCE((SELECT array_agg(r.role ORDER BY r.role) FROM public.account_roles r WHERE r.user_id=p.id),'{}'),
  p.is_banned,p.created_at,(SELECT count(*) FROM public.listings l WHERE l.user_id=p.id),
  (SELECT a.status FROM public.seller_applications a WHERE a.user_id=p.id ORDER BY a.created_at DESC LIMIT 1)
 FROM public.profiles p LEFT JOIN auth.users u ON u.id=p.id ORDER BY p.created_at DESC;
END $$;

REVOKE ALL ON FUNCTION public.admin_list_accounts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_accounts() TO authenticated;
GRANT EXECUTE ON FUNCTION public.username_available(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_profiles(uuid[]) TO anon, authenticated;
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (display_name, username, avatar_path, is_banned) ON public.profiles TO authenticated;

CREATE POLICY avatars_read ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id='avatars');
CREATE POLICY avatars_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='avatars' AND split_part(name,'/',1)=auth.uid()::text AND lower(storage.extension(name)) IN ('jpg','jpeg','png','webp') AND NOT public.is_banned(auth.uid()));
CREATE POLICY avatars_delete ON storage.objects FOR DELETE TO authenticated USING (bucket_id='avatars' AND split_part(name,'/',1)=auth.uid()::text);