import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { ListingCard } from "@/components/ListingCard";
import { useI18n } from "@/lib/i18n";
import { HEROES, HERO_TYPES } from "@/lib/heroes";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/listings/")({
  validateSearch: (s: Record<string, unknown>): { q?: string | undefined } => ({
    q: typeof s["q"] === "string" ? s["q"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "تصفح قلاع الفاتحون — Mo7hammed Store" },
      { name: "description", content: "ابحث وصفِّ قلاع لعبة الفاتحون حسب المستوى والقوة والسعر والأبطال." },
      { property: "og:title", content: "تصفح قلاع الفاتحون — Mo7hammed Store" },
      { property: "og:description", content: "ابحث وصفِّ قلاع لعبة الفاتحون المعروضة للبيع." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Browse,
});

type Sort = "newest" | "priceLow" | "priceHigh" | "powerHigh";

function Browse() {
  const { t, pick } = useI18n();
  const search = Route.useSearch();
  const [q, setQ] = useState(search.q ?? "");
  const [minLevel, setMinLevel] = useState("");
  const [minPower, setMinPower] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [hero, setHero] = useState("");
  const [sort, setSort] = useState<Sort>("newest");

  const { data, isLoading } = useQuery({
    queryKey: ["browse", q, minLevel, minPower, maxPrice, hero, sort],
    queryFn: async () => {
      let query = supabase
        .from("listings")
        .select(hero ? "*, listing_heroes!inner(hero_key)" : "*")
        .eq("status", "approved");
      const term = q.trim().replace(/[%,()]/g, "");
      if (term) query = query.or(`description.ilike.%${term}%,server.ilike.%${term}%`);
      if (minLevel) query = query.gte("castle_level", Number(minLevel));
      if (minPower) query = query.gte("power", Number(minPower));
      if (maxPrice) query = query.lte("price", Number(maxPrice));
      if (hero) query = query.eq("listing_heroes.hero_key", hero);
      const order = {
        newest: ["created_at", false],
        priceLow: ["price", true],
        priceHigh: ["price", false],
        powerHigh: ["power", false],
      } as const;
      const [col, asc] = order[sort];
      const { data, error } = await query.order(col, { ascending: asc }).limit(60);
      if (error) throw error;
      return data as unknown as import("@/lib/listings").Listing[];
    },
  });

  const selectCls = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gold-gradient">{t("browse")}</h1>
      <div className="grid gap-3 rounded-2xl ornate-border bg-card-gradient p-4 sm:grid-cols-2 lg:grid-cols-6">
        <Input className="lg:col-span-2" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search")} />
        <Input type="number" min={1} value={minLevel} onChange={(e) => setMinLevel(e.target.value)} placeholder={t("minLevel")} />
        <Input type="number" min={0} value={minPower} onChange={(e) => setMinPower(e.target.value)} placeholder={t("minPower")} />
        <Input type="number" min={0} value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} placeholder={t("maxPrice")} />
        <select className={selectCls} value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label={t("sort")}>
          {(["newest", "priceLow", "priceHigh", "powerHigh"] as const).map((s) => (
            <option key={s} value={s}>{t(s)}</option>
          ))}
        </select>
        <select className={`${selectCls} lg:col-span-2`} value={hero} onChange={(e) => setHero(e.target.value)} aria-label={t("heroes")}>
          <option value="">{t("heroes")}: {t("all")}</option>
          {HERO_TYPES.map((ht) => (
            <optgroup key={ht.type} label={pick(ht)}>
              {HEROES.filter((h) => h.type === ht.type).map((h) => (
                <option key={h.key} value={h.key}>{pick(h)}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
      {!isLoading && data?.length === 0 && <p className="py-10 text-center text-muted-foreground">{t("noResults")}</p>}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {data?.map((l) => <ListingCard key={l.id} listing={l} />)}
      </div>
    </div>
  );
}
