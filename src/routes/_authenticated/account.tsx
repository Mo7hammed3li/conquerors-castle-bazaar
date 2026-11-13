import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Heart, ShieldCheck, Store, KeyRound, Loader2, ExternalLink, Clock3, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ListingCard } from "@/components/ListingCard";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { ProfileEditor } from "@/components/ProfileEditor";
import { UserAvatar, Handle } from "@/components/UserAvatar";

export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({
    meta: [
      { title: "حسابي — Mo7hammed Store" },
      { name: "description", content: "إدارة بيانات حسابك وإعلاناتك وأمانه." },
      { property: "og:title", content: "حسابي — Mo7hammed Store" },
      { property: "og:description", content: "إدارة بيانات حسابك وإعلاناتك وأمانه." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Account,
});

function Account() {
  const { t, lang } = useI18n();
  const ar = lang === "ar";
  const { user, profile } = useAuth();
  const [sendingReset, setSendingReset] = useState(false);
  const { data: mine, isLoading: loadingMine, error: mineError } = useQuery({
    queryKey: ["mine", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("listings").select("*").eq("user_id", user!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const { data: favoritesCount = 0 } = useQuery({
    queryKey: ["my-favorites-count", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { count, error } = await supabase.from("favorites").select("*", { count: "exact", head: true }).eq("user_id", user!.id);
      if (error) throw error;
      return count ?? 0;
    },
  });
  const { data: applications = [], isLoading: loadingApplications } = useQuery({
    queryKey: ["my-seller-applications", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("seller_applications").select("id,status,message,reason,created_at,reviewed_at").eq("user_id", user!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const sendPasswordReset = async () => {
    if (!user?.email) return;
    setSendingReset(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, { redirectTo: `${window.location.origin}/reset-password` });
      if (error) throw error;
      toast.success(ar ? "تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني" : "Password reset link sent to your email");
    } catch (error) {
      console.error("password reset request failed", error);
      toast.error(ar ? "تعذر إرسال الرابط. حاول مرة أخرى لاحقًا." : "Could not send the reset link. Try again later.");
    } finally {
      setSendingReset(false);
    }
  };

  const statusLabel = (status: string) => status === "approved" ? (ar ? "مقبول" : "Approved") : status === "rejected" ? (ar ? "مرفوض" : "Rejected") : (ar ? "قيد المراجعة" : "Pending");
  const StatusIcon = ({ status }: { status: string }) => status === "approved" ? <CheckCircle2 className="size-4 text-green-500" /> : status === "rejected" ? <XCircle className="size-4 text-destructive" /> : <Clock3 className="size-4 text-amber-500" />;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl ornate-border bg-card-gradient p-6">
        <div className="flex items-center gap-4">
          <UserAvatar path={profile?.avatar_path ?? null} className="size-16" />
          <div className="min-w-0">
            <h1 className="text-2xl font-bold">{profile?.display_name || (ar ? "حسابي" : "My account")}</h1>
            <div className="mt-1"><Handle username={profile?.username} /></div>
            <p className="mt-1 break-all text-sm text-muted-foreground" dir="ltr">{user?.email}</p>
          </div>
        </div>
        <Button variant="gold" asChild><Link to="/new"><Plus /> {t("addListing")}</Link></Button>
      </div>

      <ProfileEditor />

      <section className="grid gap-4 sm:grid-cols-2">
        <Link to="/favorites" className="group rounded-2xl ornate-border bg-card-gradient p-5 transition hover:border-primary/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3"><Heart className="size-5 text-primary" /><h2 className="font-bold">{ar ? "المفضلة" : "Favorites"}</h2></div>
            <ExternalLink className="size-4 text-muted-foreground transition group-hover:text-primary" />
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums">{favoritesCount}</p>
          <p className="text-sm text-muted-foreground">{ar ? "الإعلانات التي حفظتها" : "Listings you saved"}</p>
        </Link>
        <div className="rounded-2xl ornate-border bg-card-gradient p-5">
          <div className="flex items-center gap-3"><Store className="size-5 text-primary" /><h2 className="font-bold">{ar ? "طلبات التاجر" : "Seller applications"}</h2></div>
          <p className="mt-2 text-2xl font-bold tabular-nums">{applications.length}</p>
          <p className="text-sm text-muted-foreground">{ar ? "إجمالي طلبات الانضمام كتاجر" : "Total seller applications"}</p>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl ornate-border bg-card-gradient p-6">
        <div className="flex items-center gap-2"><ShieldCheck className="text-primary" /><h2 className="text-xl font-bold">{ar ? "أمان الحساب" : "Account security"}</h2></div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-medium">{ar ? "كلمة المرور" : "Password"}</p>
            <p className="text-sm text-muted-foreground">{ar ? "إرسال رابط آمن لتعيين كلمة مرور جديدة إلى بريدك" : "Email yourself a secure password reset link"}</p>
          </div>
          <Button variant="outline" disabled={sendingReset || !user?.email} onClick={sendPasswordReset}>
            {sendingReset ? <Loader2 className="animate-spin" /> : <KeyRound />}
            {ar ? "إعادة تعيين كلمة المرور" : "Reset password"}
          </Button>
        </div>
        <div className="border-t border-border/60 pt-3">
          <p className="text-sm text-muted-foreground">{ar ? "البريد المرتبط بالحساب" : "Email linked to this account"}</p>
          <p className="mt-1 break-all font-medium" dir="ltr">{user?.email}</p>
          <p className="mt-1 text-xs text-muted-foreground">{ar ? "تغيير البريد غير متاح من صفحة الحساب حاليًا." : "Email changes are not currently available from this page."}</p>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold">{ar ? "حالة طلبات التاجر" : "Seller application status"}</h2>
        {loadingApplications ? <p className="text-sm text-muted-foreground">{ar ? "جارٍ تحميل الطلبات…" : "Loading applications…"}</p> : applications.length === 0 ? <p className="rounded-xl border border-border p-4 text-sm text-muted-foreground">{ar ? "لم تقدم طلب تاجر حتى الآن." : "You have not submitted a seller application yet."}</p> : (
          <div className="space-y-3">
            {applications.map((application) => (
              <article key={application.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2"><StatusIcon status={application.status} /><span className="font-semibold">{statusLabel(application.status)}</span></div>
                  <time className="text-xs text-muted-foreground">{new Date(application.created_at).toLocaleDateString(ar ? "ar-EG" : "en-US")}</time>
                </div>
                {application.message && <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{application.message}</p>}
                {application.reason && <p className="mt-2 rounded-lg bg-destructive/5 p-3 text-sm">{ar ? "ملاحظة الإدارة: " : "Moderator note: "}{application.reason}</p>}
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-bold">{t("myListings")}</h2>
          <span className="text-sm text-muted-foreground">{mine?.length ?? 0} {ar ? "إعلان" : "listings"}</span>
        </div>
        {loadingMine && <p className="text-sm text-muted-foreground">{ar ? "جارٍ تحميل إعلاناتك…" : "Loading your listings…"}</p>}
        {mineError && <p className="text-sm text-destructive">{ar ? "تعذر تحميل إعلاناتك. حدّث الصفحة وحاول مرة أخرى." : "Could not load your listings. Refresh and try again."}</p>}
        {!loadingMine && !mineError && mine?.length === 0 && <p className="text-muted-foreground">{t("empty")}</p>}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {mine?.map((l) => <ListingCard key={l.id} listing={l} showStatus />)}
        </div>
      </section>
    </div>
  );
}
