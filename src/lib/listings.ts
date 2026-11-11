import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { ListingFormValues } from "./listing-form";

export type Listing = Database["public"]["Tables"]["listings"]["Row"];
export type ListingHero = Database["public"]["Tables"]["listing_heroes"]["Row"];
export type ListingWithHeroes = Listing & { listing_heroes: ListingHero[] };

export const BUCKET = "listing-images";

/** Resolve stored image paths to short-lived signed URLs (bucket is private). */
export function useImageUrls(paths: string[] | undefined) {
  const key = (paths ?? []).join("|");
  return useQuery({
    queryKey: ["img", key],
    enabled: !!paths && paths.length > 0,
    staleTime: 30 * 60 * 1000,
    queryFn: async () => {
      if (!paths?.length) return [];
      const { data } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 3600);
      return (data ?? []).map((d) => d.signedUrl).filter(Boolean) as string[];
    },
  });
}

export async function saveListing(userId: string, v: ListingFormValues, existingId?: string) {
  const row = {
    castle_level: Number(v.castle_level),
    power: Number(v.power),
    description: v.description.trim(),
    science_power: Number(v.science_power || 0),
    reserve: Number(v.reserve || 0),
    server: v.server.trim(),
    price: Number(v.price),
    whatsapp: v.whatsapp.trim(),
    images: v.images,
    ...v.equipment,
    ...v.links,
  };
  void userId; // The RPC derives identity from the authenticated session, never this argument.
  const { data, error } = await supabase.rpc("save_castle", { _values: { ...row, heroes: v.heroes.map(h => ({ ...h, crescents: Number(h.crescents) || 0, red_crescents: Number(h.red_crescents) || 0 })) }, ...(existingId ? { _id: existingId } : {}) });
  if (error) throw error;
  if (!data) throw new Error("Listing not saved");
  return data;
}

export function listingToForm(l: ListingWithHeroes): ListingFormValues {
  return {
    castle_level: l.castle_level,
    power: l.power,
    description: l.description,
    science_power: l.science_power,
    reserve: l.reserve,
    server: l.server,
    price: Number(l.price),
    whatsapp: l.whatsapp,
    images: l.images,
    equipment: {
      equip_normal: l.equip_normal,
      equip_green: l.equip_green,
      equip_blue: l.equip_blue,
      equip_purple: l.equip_purple,
      equip_gold: l.equip_gold,
    },
    links: {
      link_igg: l.link_igg,
      link_google: l.link_google,
      link_facebook: l.link_facebook,
      link_icloud: l.link_icloud,
      link_gamecenter: l.link_gamecenter,
      link_device: l.link_device,
    },
    heroes: l.listing_heroes.map((h) => ({
      hero_key: h.hero_key,
      crescents: h.crescents,
      red_crescents: h.red_crescents,
    })),
  };
}

export function formatNum(n: number | string, lang: "ar" | "en") {
  return new Intl.NumberFormat(lang === "ar" ? "ar-EG" : "en-US").format(Number(n));
}

export function useFavorites(userId: string | undefined) {
  return useQuery({
    queryKey: ["favorites", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from("favorites").select("listing_id");
      if (error) throw error;
      return new Set(data.map((f) => f.listing_id));
    },
  });
}
