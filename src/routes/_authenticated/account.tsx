import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ListingCard } from "@/components/ListingCard";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({
    meta: [
      { title: "حسابي — Mo7hammed Store" },
      { name: "description", content: "إدارة حسابك وإعلاناتك." },
      { property: "og:title", content: "حسابي — Mo7hammed Store" },
      { property: "og:description", content: "إدارة حسابك وإعلاناتك." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Account,
});

function Account() {
  const { t, lang } = useI18n();
  const { user, canSell } = useAuth();
  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle()).data,
  });
  const { data: mine } = useQuery({
    queryKey: ["mine", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listings")
        .select("*")
        .eq("user_id", user!.id)
        .is("archived_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl ornate-border bg-card-gradient p-6">
        <div>
          <h1 className="text-2xl font-bold">{profile?.display_name ?? "…"}</h1>
          <p className="text-sm text-muted-foreground" dir="ltr">{user?.email}</p>
          {profile?.is_banned && <p className="mt-1 text-sm text-destructive">{t("banned")}</p>}
        </div>
        <Button variant="gold" asChild>
          <Link to="/new"><Plus /> {canSell ? t("addListing") : (lang === "ar" ? "التقديم كتاجر" : "Apply to sell")}</Link>
        </Button>
      </div>
      {canSell && mine && (
        <section className="space-y-3 rounded-2xl ornate-border bg-card-gradient p-5">
          <h2 className="text-lg font-bold text-primary">{lang === "ar" ? "إحصائيات التاجر" : "Seller overview"}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: lang === "ar" ? "إجمالي الإعلانات" : "Total listings", value: mine.length },
              { label: lang === "ar" ? "معتمدة" : "Approved", value: mine.filter((item) => item.status === "approved").length },
              { label: lang === "ar" ? "قيد المراجعة" : "Pending review", value: mine.filter((item) => item.status === "pending").length },
              { label: lang === "ar" ? "مرفوضة" : "Rejected", value: mine.filter((item) => item.status === "rejected").length },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl border border-border/70 bg-background/50 p-3">
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <p className="mt-1 text-2xl font-bold tabular-nums">{stat.value}</p>
              </div>
            ))}
          </div>
        </section>
      )}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold">{t("myListings")}</h2>
        {mine?.length === 0 && <p className="text-muted-foreground">{t("empty")}</p>}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {mine?.map((l) => <ListingCard key={l.id} listing={l} showStatus />)}
        </div>
      </section>
    </div>
  );
}
