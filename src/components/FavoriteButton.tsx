import { Heart } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { useFavorites } from "@/lib/listings";
import { supabase } from "@/integrations/supabase/client";

export function FavoriteButton({ listingId }: { listingId: string }) {
  const { user } = useAuth();
  const { t } = useI18n();
  const qc = useQueryClient();
  const { data: favs } = useFavorites(user?.id);
  const isFav = favs?.has(listingId) ?? false;

  const toggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!user) { toast.info(t("signInToFav")); return; }
    const { error } = isFav
      ? await supabase.from("favorites").delete().eq("listing_id", listingId).eq("user_id", user.id)
      : await supabase.from("favorites").insert({ listing_id: listingId, user_id: user.id });
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["favorites"] });
    qc.invalidateQueries({ queryKey: ["favorite-listings"] });
  };

  return (
    <button
      onClick={toggle}
      aria-label={isFav ? t("removeFav") : t("addFav")}
      className="rounded-full bg-background/80 p-2 backdrop-blur transition hover:scale-110"
    >
      <Heart className={cn("size-5", isFav ? "fill-crescent-red text-crescent-red" : "text-foreground")} />
    </button>
  );
}
