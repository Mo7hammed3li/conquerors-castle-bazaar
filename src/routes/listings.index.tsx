import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { RotateCcw, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
      { name: "description", content: "ابحث وصفِّ قلاع لعبة الفاتحون حسب المستوى والقوة والسعر والسيرفر والأبطال." },
      { property: "og:title", content: "تصفح قلاع الفاتحون — Mo7hammed Store" },
      { property: "og:description", content: "اعثر على القلعة المناسبة باستخدام فلاتر أكثر دقة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Browse,
});

type Sort = "newest" | "priceLow" | "priceHigh" | "powerHigh" | "scienceHigh" | "levelHigh";

function Browse() {
  const { t, pick, lang } = useI18n();
  const search = Route.useSearch();
  const [q, setQ] = useState(search.q ?? "");
  const [server, setServer] = useState("");
  const [minLevel, setMinLevel] = useState("");
  const [maxLevel, setMaxLevel] = useState("");
  const [minPower, setMinPower] = useState("");
  const [minScience, setMinScience] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [hero, setHero] = useState("");
  const [sort, setSort] = useState<Sort>("newest");

  const activeFilters = [q, server, minLevel, maxLevel, minPower, minScience, minPrice, maxPrice, hero].filter(Boolean).length;
  const resetFilters = () => {
    setQ(""); setServer(""); setMinLevel(""); setMaxLevel(""); setMinPower("");
    setMinScience(""); setMinPrice(""); setMaxPrice(""); setHero(""); setSort("newest");
  };

  const { data, isLoading, isError } = useQuery({
    queryKey: ["browse", q, server, minLevel, maxLevel, minPower, minScience, minPrice, maxPrice, hero, sort],
    queryFn: async () => {
      let query = supabase
        .from("listings")
        .select(hero ? "*, listing_heroes!inner(hero_key)" : "*")
        .eq("status", "approved");
      const term = q.trim().replace(/[%,()]/g, "");
      const serverTerm = server.trim().replace(/[%,()]/g, "");
      if (term) query = query.or(`description.ilike.%${term}%,server.ilike.%${term}%`);
      if (serverTerm) query = query.ilike("server", `%${serverTerm}%`);
      if (minLevel) query = query.gte("castle_level", Number(minLevel));
      if (maxLevel) query = query.lte("castle_level", Number(maxLevel));
      if (minPower) query = query.gte("power", Number(minPower));
      if (minScience) query = query.gte("science_power", Number(minScience));
      if (minPrice) query = query.gte("price", Number(minPrice));
      if (maxPrice) query = query.lte("price", Number(maxPrice));
      if (hero) query = query.eq("listing_heroes.hero_key", hero);
      const order = {
        newest: ["created_at", false],
        priceLow: ["price", true],
        priceHigh: ["price", false],
        powerHigh: ["power", false],
        scienceHigh: ["science_power", false],
        levelHigh: ["castle_level", false],
      } as const;
      const [col, asc] = order[sort];
      const { data, error } = await query.order(col, { ascending: asc }).limit(100);
      if (error) throw error;
      return data as unknown as import("@/lib/listings").Listing[];
    },
  });

  const selectCls = "h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm";
  const labelCls = "mb-1.5 block text-xs font-semibold text-muted-foreground";
  const ar = lang === "ar";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gold-gradient">{t("browse")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{ar ? "استخدم الفلاتر للوصول للقلعة التي تبحث عنها بدقة." : "Combine filters to find the castle that fits your needs."}</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <SlidersHorizontal className="size-4 text-primary" />
          <span>{ar ? `${activeFilters} فلاتر نشطة` : `${activeFilters} active filters`}</span>
        </div>
      </div>

      <section className="space-y-4 rounded-2xl ornate-border bg-card-gradient p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold">{ar ? "بحث وتصفية متقدمة" : "Advanced search & filters"}</h2>
          <Button type="button" variant="ghost" size="sm" onClick={resetFilters} disabled={activeFilters === 0 && sort === "newest"}>
            <RotateCcw className="me-1 size-4" />{ar ? "مسح الفلاتر" : "Clear filters"}
          </Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="sm:col-span-2">
            <span className={labelCls}>{ar ? "بحث عام" : "Keyword search"}</span>
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search")} />
          </label>
          <label>
            <span className={labelCls}>{ar ? "السيرفر" : "Server"}</span>
            <Input value={server} onChange={(e) => setServer(e.target.value)} placeholder={ar ? "مثال: K176" : "e.g. K176"} />
          </label>
          <label>
            <span className={labelCls}>{t("heroes")}</span>
            <select className={selectCls} value={hero} onChange={(e) => setHero(e.target.value)}>
              <option value="">{t("all")}</option>
              {HERO_TYPES.map((ht) => (
                <optgroup key={ht.type} label={pick(ht)}>
                  {HEROES.filter((h) => h.type === ht.type).map((h) => <option key={h.key} value={h.key}>{pick(h)}</option>)}
                </optgroup>
              ))}
            </select>
          </label>
          <label>
            <span className={labelCls}>{ar ? "أدنى مستوى قلعة" : "Minimum castle level"}</span>
            <Input type="number" min={1} max={100} value={minLevel} onChange={(e) => setMinLevel(e.target.value)} placeholder="1" />
          </label>
          <label>
            <span className={labelCls}>{ar ? "أعلى مستوى قلعة" : "Maximum castle level"}</span>
            <Input type="number" min={1} max={100} value={maxLevel} onChange={(e) => setMaxLevel(e.target.value)} placeholder="—" />
          </label>
          <label>
            <span className={labelCls}>{t("minPower")}</span>
            <Input type="number" min={0} value={minPower} onChange={(e) => setMinPower(e.target.value)} placeholder="0" />
          </label>
          <label>
            <span className={labelCls}>{ar ? "أدنى قوة علوم" : "Minimum science power"}</span>
            <Input type="number" min={0} value={minScience} onChange={(e) => setMinScience(e.target.value)} placeholder="0" />
          </label>
          <label>
            <span className={labelCls}>{ar ? "أقل سعر ($)" : "Minimum price ($)"}</span>
            <Input type="number" min={0} value={minPrice} onChange={(e) => setMinPrice(e.target.value)} placeholder="0" />
          </label>
          <label>
            <span className={labelCls}>{t("maxPrice")}</span>
            <Input type="number" min={0} value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} placeholder="—" />
          </label>
          <label className="sm:col-span-2">
            <span className={labelCls}>{t("sort")}</span>
            <select className={selectCls} value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
              <option value="newest">{t("newest")}</option>
              <option value="priceLow">{t("priceLow")}</option>
              <option value="priceHigh">{t("priceHigh")}</option>
              <option value="powerHigh">{t("powerHigh")}</option>
              <option value="scienceHigh">{ar ? "قوة العلوم: الأعلى" : "Science power: high"}</option>
              <option value="levelHigh">{ar ? "مستوى القلعة: الأعلى" : "Castle level: high"}</option>
            </select>
          </label>
        </div>
        <p className="text-xs text-muted-foreground">{ar ? "يمكنك الجمع بين أكثر من فلتر في نفس الوقت." : "You can combine multiple filters at the same time."}</p>
      </section>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{isLoading ? (ar ? "جارٍ تحميل النتائج…" : "Loading results…") : ar ? `النتائج: ${data?.length ?? 0}` : `Results: ${data?.length ?? 0}`}</span>
      </div>
      {isError && <p className="py-8 text-center text-destructive">{ar ? "تعذر تحميل الإعلانات. حاول مرة أخرى." : "Could not load listings. Please try again."}</p>}
      {!isLoading && !isError && data?.length === 0 && <p className="py-10 text-center text-muted-foreground">{t("noResults")}</p>}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {data?.map((l) => <ListingCard key={l.id} listing={l} />)}
      </div>
    </div>
  );
}
