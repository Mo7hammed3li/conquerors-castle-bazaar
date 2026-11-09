import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ListingCard } from "@/components/ListingCard";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import type { Listing } from "@/lib/listings";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/favorites")({
  head: () => ({
    meta: [
      { title: "المفضلة — Mo7hammed Store" },
      { name: "description", content: "القلاع التي حفظتها في المفضلة." },
      { property: "og:title", content: "المفضلة — Mo7hammed Store" },
      { property: "og:description", content: "القلاع التي حفظتها في المفضلة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Favorites,
});

function Favorites() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["favorite-listings", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("favorites")
        .select("created_at, listings(*)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data.map((f) => f.listings).filter(Boolean) as Listing[];
    },
  });
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gold-gradient">{t("favorites")}</h1>
      {data?.length === 0 && <p className="text-muted-foreground">{t("empty")}</p>}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {data?.map((l) => <ListingCard key={l.id} listing={l} />)}
      </div>
    </div>
  );
}
