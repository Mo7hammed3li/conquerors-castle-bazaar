import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthState {
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
}

const Ctx = createContext<AuthState>({ user: null, isAdmin: false, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, isAdmin: false, loading: true });

  useEffect(() => {
    const load = async (user: User | null) => {
      if (!user) return setState({ user: null, isAdmin: false, loading: false });
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      setState({ user, isAdmin: !!data?.some((r) => r.role === "admin"), loading: false });
    };
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "TOKEN_REFRESHED") return;
      setTimeout(() => load(session?.user ?? null), 0);
    });
    supabase.auth.getSession().then(({ data }) => load(data.session?.user ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
