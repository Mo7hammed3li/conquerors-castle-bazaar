import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { accessFor, type Permission } from "./access";

interface AuthState {
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
  isOwner: boolean;
  canSell: boolean;
  can: (permission: string, target?: string) => boolean;
}

const empty = { user: null, isAdmin: false, loading: true, isOwner: false, canSell: false, can: () => false };
const Ctx = createContext<AuthState>(empty);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(empty);

  useEffect(() => {
    const load = async (user: User | null) => {
      if (!user) return setState({ ...empty, loading: false });
      const [roles, permissions, profile] = await Promise.all([
        supabase.from("account_roles").select("role").eq("user_id", user.id),
        supabase.from("account_permissions").select("permission,scope_user_id").eq("user_id",user.id),
        supabase.from("profiles").select("is_banned").eq("id",user.id).maybeSingle(),
      ]);
      const access = accessFor((roles.data ?? []).map(r => r.role), (permissions.data ?? []) as Permission[], profile.data?.is_banned ?? true);
      setState({ user, ...access, isAdmin: access.isStaff, loading: false });
    };
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!["SIGNED_IN", "SIGNED_OUT", "USER_UPDATED"].includes(event)) return;
      setTimeout(() => load(session?.user ?? null), 0);
    });
    supabase.auth.getSession().then(({ data }) => load(data.session?.user ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
