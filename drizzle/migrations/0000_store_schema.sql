
CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TYPE public.listing_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  is_banned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT, INSERT, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_banned(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT is_banned FROM public.profiles WHERE id = _user_id), false)
$$;

CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- prevent non-admins from changing their own ban flag
CREATE OR REPLACE FUNCTION public.protect_profile_ban()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.is_banned IS DISTINCT FROM OLD.is_banned AND NOT public.has_role(auth.uid(), 'admin') THEN
    NEW.is_banned := OLD.is_banned;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER profiles_protect_ban BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_ban();

CREATE POLICY "roles read" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin add roles" ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin remove roles" ON public.user_roles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') AND user_id <> auth.uid());

-- profile + role on signup; very first user becomes admin
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  castle_level integer NOT NULL CHECK (castle_level BETWEEN 1 AND 100),
  power bigint NOT NULL CHECK (power >= 0),
  description text NOT NULL DEFAULT '',
  science_power bigint NOT NULL DEFAULT 0 CHECK (science_power >= 0),
  reserve bigint NOT NULL DEFAULT 0 CHECK (reserve >= 0),
  server text NOT NULL,
  price numeric(12,2) NOT NULL CHECK (price >= 0),
  whatsapp text NOT NULL,
  images text[] NOT NULL DEFAULT '{}',
  equip_normal integer NOT NULL DEFAULT 0 CHECK (equip_normal >= 0),
  equip_green integer NOT NULL DEFAULT 0 CHECK (equip_green >= 0),
  equip_blue integer NOT NULL DEFAULT 0 CHECK (equip_blue >= 0),
  equip_purple integer NOT NULL DEFAULT 0 CHECK (equip_purple >= 0),
  equip_gold integer NOT NULL DEFAULT 0 CHECK (equip_gold >= 0),
  link_igg boolean NOT NULL DEFAULT false,
  link_google boolean NOT NULL DEFAULT false,
  link_facebook boolean NOT NULL DEFAULT false,
  link_icloud boolean NOT NULL DEFAULT false,
  link_gamecenter boolean NOT NULL DEFAULT false,
  link_device boolean NOT NULL DEFAULT false,
  status public.listing_status NOT NULL DEFAULT 'pending',
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX listings_status_idx ON public.listings(status, created_at DESC);
CREATE INDEX listings_user_idx ON public.listings(user_id);
GRANT SELECT ON public.listings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.listings TO authenticated;
GRANT ALL ON public.listings TO service_role;
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "approved public" ON public.listings FOR SELECT TO anon, authenticated
  USING (status = 'approved');
CREATE POLICY "owner or admin read" ON public.listings FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "owner insert" ON public.listings FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND NOT public.is_banned(auth.uid()));
CREATE POLICY "owner or admin update" ON public.listings FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "owner or admin delete" ON public.listings FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- non-admins: new and edited listings always go back to review
CREATE OR REPLACE FUNCTION public.listing_moderation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    NEW.status := 'pending';
    NEW.rejection_reason := NULL;
    IF TG_OP = 'UPDATE' THEN NEW.user_id := OLD.user_id; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER listings_moderation BEFORE INSERT OR UPDATE ON public.listings
  FOR EACH ROW EXECUTE FUNCTION public.listing_moderation();

-- one independent row per hero per listing
CREATE TABLE public.listing_heroes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  hero_key text NOT NULL,
  crescents integer NOT NULL DEFAULT 0 CHECK (crescents >= 0),
  red_crescents integer NOT NULL DEFAULT 0 CHECK (red_crescents >= 0),
  UNIQUE (listing_id, hero_key)
);
GRANT SELECT ON public.listing_heroes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.listing_heroes TO authenticated;
GRANT ALL ON public.listing_heroes TO service_role;
ALTER TABLE public.listing_heroes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "heroes readable with listing" ON public.listing_heroes FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_id));
CREATE POLICY "heroes write by owner or admin" ON public.listing_heroes FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_id AND (l.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_id AND (l.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));

CREATE TABLE public.favorites (
  user_id uuid NOT NULL,
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, listing_id)
);
GRANT SELECT, INSERT, DELETE ON public.favorites TO authenticated;
GRANT ALL ON public.favorites TO service_role;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own favorites" ON public.favorites FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
