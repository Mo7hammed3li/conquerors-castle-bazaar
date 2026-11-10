import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ListingForm } from "@/components/ListingForm";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { listingToForm, saveListing, type ListingWithHeroes } from "@/lib/listings";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/edit/$id")({
  head: () => ({
    meta: [
      { title: "تعديل الإعلان — Mo7hammed Store" },
      { name: "description", content: "عدّل إعلان قلعتك." },
      { property: "og:title", content: "تعديل الإعلان — Mo7hammed Store" },
      { property: "og:description", content: "عدّل إعلان قلعتك." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EditListing,
});

function EditListing() {
  const { id } = Route.useParams();
  const { t } = useI18n();
  const { user, canSell, can } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["edit", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("listings").select("*, listing_heroes(*)").eq("id", id).maybeSingle();
      if (error) throw error;
      return data as ListingWithHeroes | null;
    },
  });
  if (!user || isLoading) return null;
  if (!data) return <p className="py-20 text-center text-muted-foreground">{t("noResults")}</p>;
  if (!((user.id === data.user_id && canSell) || can("listings.edit", data.user_id)) || data.archived_at) return <p>403</p>;
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="text-3xl font-bold text-gold-gradient">{t("edit")}</h1>
      <ListingForm
        initial={listingToForm(data)}
        userId={user.id}
        submitLabel={t("save")}
        onSubmit={async (v) => {
          await saveListing(data.user_id, v, id);
          await qc.invalidateQueries();
          toast.success(t("saved"));
          navigate({ to: "/listings/$id", params: { id } });
        }}
      />
    </div>
  );
}
