import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { accessFor, type Permission } from "./access";

interface AuthState {
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
  isOwner: boolean;
  isHeadModerator: boolean;
  canSell: boolean;
  can: (permission: string, target?: string) => boolean;
  profile: { username: string | null; display_name: string | null; avatar_path: string | null } | null;
  loadedRoles: string[];
  authIssue: string | null;
  refresh: () => Promise<void>;
}

const empty = { user: null, isAdmin: false, loading: true, isOwner: false, isHeadModerator: false, canSell: false, can: () => false, profile: null, loadedRoles: [], authIssue: null, refresh: async () => {} };
const Ctx = createContext<AuthState>(empty);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(empty);

  useEffect(() => {
    const load = async (user: User | null) => {
      if (!user) { setState({ ...empty, loading: false }); return; }
      const [roles, permissions, profile] = await Promise.all([
        supabase.from("account_roles").select("role").eq("user_id", user.id),
        supabase.from("account_permissions").select("permission,scope_user_id").eq("user_id",user.id),
        supabase.from("profiles").select("is_banned,username,display_name,avatar_path").eq("id",user.id).maybeSingle(),
      ]);
      const roleNames = (roles.data ?? []).map(r => r.role);
      const access = accessFor(roleNames, (permissions.data ?? []) as Permission[], profile.data?.is_banned ?? true);
      const authIssue = roles.error ? "تعذر تحميل أدوار الحساب من قاعدة البيانات." : permissions.error ? "تعذر تحميل صلاحيات الحساب." : profile.error ? "تعذر تحميل ملف الحساب." : null;
      setState({ user, ...access, isHeadModerator: !profile.data?.is_banned && roleNames.includes("head_moderator"), isAdmin: access.isStaff, loading: false, profile: profile.data ? { username: profile.data.username, display_name: profile.data.display_name, avatar_path: profile.data.avatar_path } : null, loadedRoles: roleNames, authIssue, refresh: async () => load((await supabase.auth.getUser()).data.user) });
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
