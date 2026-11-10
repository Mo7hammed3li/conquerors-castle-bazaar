import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Crown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "تسجيل الدخول — Mo7hammed Store" },
      { name: "description", content: "سجّل الدخول أو أنشئ حسابًا لنشر قلعتك في Mo7hammed Store." },
      { property: "og:title", content: "تسجيل الدخول — Mo7hammed Store" },
      { property: "og:description", content: "سجّل الدخول لنشر وإدارة إعلاناتك." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

const G = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"/><path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/></svg>
);

function AuthPage() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const { user } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up" | "forgot">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) navigate({ to: "/account" });
  }, [user, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else if (mode === "up") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin, data: { display_name: name } },
        });
        if (error) throw error;
        toast.success(ar ? "تحقق من بريدك لتأكيد الحساب" : "Check your email to confirm your account");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success(ar ? "أرسلنا رابط إعادة التعيين" : "Reset link sent");
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) toast.error(error.message);
  };

  return (
    <div className="mx-auto max-w-md py-10">
      <div className="space-y-6 rounded-2xl ornate-border bg-card-gradient p-6 shadow-gold">
        <div className="text-center">
          <Crown className="mx-auto size-10 text-primary" />
          <h1 className="mt-2 text-2xl font-bold">
            {mode === "in" ? (ar ? "تسجيل الدخول" : "Sign in") : mode === "up" ? (ar ? "إنشاء حساب" : "Create account") : ar ? "نسيت كلمة المرور" : "Forgot password"}
          </h1>
        </div>
        {mode !== "forgot" && (
          <>
            <button
              type="button"
              onClick={google}
              className="flex h-10 w-full items-center justify-center gap-2.5 rounded-md border border-[#8E918F] bg-[#131314] px-3 text-sm font-medium text-[#E3E3E3]"
            >
              <G /> {ar ? "المتابعة باستخدام Google" : "Continue with Google"}
            </button>
            <div className="text-center text-xs text-muted-foreground">{ar ? "أو" : "or"}</div>
          </>
        )}
        <form onSubmit={submit} className="space-y-4">
          {mode === "up" && (
            <div className="space-y-1.5">
              <Label htmlFor="name">{ar ? "الاسم المعروض" : "Display name"}</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={40} />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="email">{ar ? "البريد الإلكتروني" : "Email"}</Label>
            <Input id="email" type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          {mode !== "forgot" && (
            <div className="space-y-1.5">
              <Label htmlFor="password">{ar ? "كلمة المرور" : "Password"}</Label>
              <Input id="password" type="password" dir="ltr" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
          )}
          <Button type="submit" variant="gold" className="w-full" disabled={busy}>
            {busy && <Loader2 className="animate-spin" />}
            {mode === "in" ? (ar ? "دخول" : "Sign in") : mode === "up" ? (ar ? "إنشاء الحساب" : "Sign up") : ar ? "إرسال الرابط" : "Send link"}
          </Button>
        </form>
        <div className="flex justify-between text-sm">
          <button className="text-primary hover:underline" onClick={() => setMode(mode === "up" ? "in" : "up")}>
            {mode === "up" ? (ar ? "لديك حساب؟ سجّل الدخول" : "Have an account? Sign in") : ar ? "حساب جديد" : "Create account"}
          </button>
          {mode === "in" && (
            <button className="text-muted-foreground hover:underline" onClick={() => setMode("forgot")}>
              {ar ? "نسيت كلمة المرور؟" : "Forgot password?"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
