import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
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
  const { t } = useI18n();
  const { user, profile } = useAuth();
  const { data: mine } = useQuery({
    queryKey: ["mine", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listings")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl ornate-border bg-card-gradient p-6">
        <div className="flex items-center gap-4">
          <UserAvatar path={profile?.avatar_path} className="size-14" />
          <div>
          <h1 className="text-2xl font-bold">{profile?.display_name ?? "…"}</h1>
          <Handle username={profile?.username} />
          <p className="text-sm text-muted-foreground" dir="ltr">{user?.email}</p>
          </div>
        </div>
        <Button variant="gold" asChild>
          <Link to="/new"><Plus /> {t("addListing")}</Link>
        </Button>
      </div>
      <ProfileEditor />
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
