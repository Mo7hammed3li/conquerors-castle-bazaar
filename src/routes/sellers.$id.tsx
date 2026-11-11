import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ShieldCheck, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ListingCard } from "@/components/ListingCard";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import type { ListingWithHeroes } from "@/lib/listings";

export const Route = createFileRoute("/sellers/$id")({
  head: () => ({
    meta: [
      { title: "ملف التاجر — Mo7hammed Store" },
      { name: "description", content: "ملف التاجر وإعلانات القلاع المعتمدة." },
    ],
  }),
  component: SellerProfile,
});

function SellerProfile() {
  const { id } = Route.useParams();
  const { lang } = useI18n();
  const { data: seller, isLoading: sellerLoading } = useQuery({
    queryKey: ["seller-directory-profile", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("seller_directory")
        .select("seller_id, display_name, created_at, approved_listings")
        .eq("seller_id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const { data: listings, isLoading: listingsLoading } = useQuery({
    queryKey: ["seller-approved-listings", id],
    enabled: !!seller,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listings")
        .select("*, listing_heroes(*)")
        .eq("user_id", id)
        .eq("status", "approved")
        .is("archived_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ListingWithHeroes[];
    },
  });

  if (sellerLoading) return <p className="py-20 text-center text-muted-foreground">…</p>;
  if (!seller) return (
    <div className="py-20 text-center">
      <h1 className="text-xl font-bold">{lang === "ar" ? "ملف التاجر غير متاح" : "Seller profile unavailable"}</h1>
      <Button variant="ornate" className="mt-4" asChild><Link to="/sellers">{lang === "ar" ? "كل التجار" : "All sellers"}</Link></Button>
    </div>
  );

  return (
    <div className="space-y-6">
      <Button variant="ghost" asChild>
        <Link to="/sellers"><ArrowLeft className="size-4" /> {lang === "ar" ? "العودة للتجار" : "Back to sellers"}</Link>
      </Button>
      <section className="rounded-2xl ornate-border bg-card-gradient p-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Store className="size-8" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{seller.display_name}</h1>
              <ShieldCheck className="size-5 shrink-0 text-success" />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {lang === "ar" ? "تاجر معتمد" : "Approved seller"}
              {" · "}
              {lang === "ar" ? "عضو منذ " : "Member since "}
              {new Date(seller.created_at).toLocaleDateString(lang === "ar" ? "ar-EG" : "en-US")}
            </p>
          </div>
          <div className="rounded-xl bg-muted/60 px-4 py-3 text-center">
            <p className="text-2xl font-bold tabular-nums">{seller.approved_listings}</p>
            <p className="text-xs text-muted-foreground">{lang === "ar" ? "إعلانات معتمدة" : "Approved listings"}</p>
          </div>
        </div>
      </section>
      <section className="space-y-4">
        <h2 className="text-xl font-bold">{lang === "ar" ? "إعلانات التاجر" : "Seller listings"}</h2>
        {listingsLoading && <p className="py-10 text-center text-muted-foreground">…</p>}
        {!listingsLoading && listings?.length === 0 && <p className="py-10 text-center text-muted-foreground">{lang === "ar" ? "لا توجد إعلانات منشورة حاليًا." : "No published listings yet."}</p>}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {listings?.map((listing) => <ListingCard key={listing.id} listing={listing} />)}
        </div>
      </section>
    </div>
  );
}
