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

const empty: AuthState = {
  user: null,
  isAdmin: false,
  loading: true,
  isOwner: false,
  canSell: false,
  can: () => false,
};
const Ctx = createContext<AuthState>(empty);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(empty);

  useEffect(() => {
    let requestVersion = 0;
    let disposed = false;

    const load = async (user: User | null) => {
      const version = ++requestVersion;
      if (!user) {
        if (!disposed && version === requestVersion) setState({ ...empty, loading: false });
        return;
      }

      // Fail closed while permissions are being reloaded; never briefly retain
      // privileges from a previous account during an auth transition.
      setState({ ...empty, user, loading: true });

      try {
        const [roles, permissions, profile] = await Promise.all([
          supabase.from("account_roles").select("role").eq("user_id", user.id),
          supabase.from("account_permissions").select("permission,scope_user_id").eq("user_id", user.id),
          supabase.from("profiles").select("is_banned").eq("id", user.id).maybeSingle(),
        ]);

        if (roles.error || permissions.error || profile.error || !profile.data) {
          throw new Error("Unable to verify account access");
        }

        const access = accessFor(
          (roles.data ?? []).map((role) => role.role),
          (permissions.data ?? []) as Permission[],
          profile.data.is_banned,
        );

        if (!disposed && version === requestVersion) {
          setState({ user, ...access, isAdmin: access.isStaff, loading: false });
        }
      } catch {
        // Authentication may remain valid, but privileged capabilities are
        // unavailable unless all authorization data was verified successfully.
        if (!disposed && version === requestVersion) {
          setState({ ...empty, user, loading: false });
        }
      }
    };

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (!["SIGNED_IN", "SIGNED_OUT", "USER_UPDATED", "TOKEN_REFRESHED"].includes(event)) return;
      void load(session?.user ?? null);
    });

    void supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        if (!disposed) setState({ ...empty, loading: false });
        return;
      }
      // A newer auth event wins over this initial session lookup.
      if (requestVersion === 0) void load(data.session?.user ?? null);
    }).catch(() => {
      if (!disposed) setState({ ...empty, loading: false });
    });

    return () => {
      disposed = true;
      requestVersion++;
      subscription.subscription.unsubscribe();
    };
  }, []);

  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
