import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { RotateCcw, SlidersHorizontal, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ListingCard } from "@/components/ListingCard";
import { useI18n } from "@/lib/i18n";
import { HEROES, HERO_TYPES, EQUIPMENT_TIERS, LINK_TYPES } from "@/lib/heroes";
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
type RangeField = "minLevel" | "maxLevel" | "minPower" | "maxPower" | "minScience" | "maxScience" | "minPrice" | "maxPrice" | "minReserve" | "maxReserve" | "minCrescents" | "minRedCrescents" | "minEquipment";

function Browse() {
  const { t, pick, lang } = useI18n();
  const search = Route.useSearch();
  const [q, setQ] = useState(search.q ?? "");
  const [server, setServer] = useState("");
  const [ranges, setRanges] = useState<Record<RangeField, string>>({
    minLevel: "", maxLevel: "", minPower: "", maxPower: "", minScience: "", maxScience: "",
    minPrice: "", maxPrice: "", minReserve: "", maxReserve: "", minCrescents: "",
    minRedCrescents: "", minEquipment: "",
  });
  const [heroes, setHeroes] = useState<string[]>([]);
  const [equipment, setEquipment] = useState<string[]>([]);
  const [links, setLinks] = useState<string[]>([]);
  const [sort, setSort] = useState<Sort>("newest");
  const ar = lang === "ar";
  const setRange = (key: RangeField, value: string) => setRanges((old) => ({ ...old, [key]: value }));
  const toggle = (items: string[], key: string, setter: (next: string[]) => void) =>
    setter(items.includes(key) ? items.filter((x) => x !== key) : [...items, key]);
  const activeFilters = useMemo(() => [
    q, server, ...Object.values(ranges), ...heroes, ...equipment, ...links,
  ].filter(Boolean).length, [q, server, ranges, heroes, equipment, links]);

  const resetFilters = () => {
    setQ(""); setServer("");
    setRanges({ minLevel: "", maxLevel: "", minPower: "", maxPower: "", minScience: "", maxScience: "",
      minPrice: "", maxPrice: "", minReserve: "", maxReserve: "", minCrescents: "",
      minRedCrescents: "", minEquipment: "" });
    setHeroes([]); setEquipment([]); setLinks([]); setSort("newest");
  };

  const { data, isLoading, isError } = useQuery({
    queryKey: ["browse-v2", q, server, ranges, heroes, equipment, links, sort],
    queryFn: async () => {
      let query = supabase
        .from("listings")
        .select(heroes.length ? "*, listing_heroes!inner(hero_key, crescents, red_crescents)" : "*")
        .eq("status", "approved")
        .is("archived_at", null);
      const clean = (value: string) => value.trim().replace(/[%,()]/g, "");
      const term = clean(q);
      const serverTerm = clean(server);
      if (term) query = query.or(`description.ilike.%${term}%,server.ilike.%${term}%`);
      if (serverTerm) query = query.ilike("server", `%${serverTerm}%`);
      const numeric: [RangeField, "castle_level" | "power" | "science_power" | "price" | "reserve", "gte" | "lte"][] = [
        ["minLevel", "castle_level", "gte"], ["maxLevel", "castle_level", "lte"],
        ["minPower", "power", "gte"], ["maxPower", "power", "lte"],
        ["minScience", "science_power", "gte"], ["maxScience", "science_power", "lte"],
        ["minPrice", "price", "gte"], ["maxPrice", "price", "lte"],
        ["minReserve", "reserve", "gte"], ["maxReserve", "reserve", "lte"],
      ];
      for (const [key, column, op] of numeric) {
        const value = ranges[key];
        if (value !== "") query = op === "gte" ? query.gte(column, Number(value)) : query.lte(column, Number(value));
      }
      if (heroes.length) query = query.in("listing_heroes.hero_key", heroes);
      if (ranges.minCrescents) query = query.gte("listing_heroes.crescents", Number(ranges.minCrescents));
      if (ranges.minRedCrescents) query = query.gte("listing_heroes.red_crescents", Number(ranges.minRedCrescents));
      if (equipment.length && ranges.minEquipment) {
        for (const key of equipment as ("equip_normal" | "equip_green" | "equip_blue" | "equip_purple" | "equip_gold")[]) {
          query = query.gte(key, Number(ranges.minEquipment));
        }
      }
      for (const key of links as ("link_igg" | "link_google" | "link_facebook" | "link_icloud" | "link_gamecenter" | "link_device")[]) {
        query = query.eq(key, true);
      }
      const order = {
        newest: ["created_at", false], priceLow: ["price", true], priceHigh: ["price", false],
        powerHigh: ["power", false], scienceHigh: ["science_power", false], levelHigh: ["castle_level", false],
      } as const;
      const [col, asc] = order[sort];
      const { data, error } = await query.order(col, { ascending: asc }).limit(100);
      if (error) throw error;
      return data as unknown as import("@/lib/listings").Listing[];
    },
  });

  const labelCls = "mb-1.5 block text-xs font-semibold text-muted-foreground";
  const selectCls = "h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm";
  const field = (key: RangeField, label: string, placeholder = "0") => (
    <label key={key} className="min-w-0">
      <span className={labelCls}>{label}</span>
      <Input type="number" min={0} value={ranges[key]} onChange={(e) => setRange(key, e.target.value)} placeholder={placeholder} />
    </label>
  );
  const check = (checked: boolean, label: string, onChange: () => void) => (
    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border/70 px-3 py-2 text-sm hover:bg-muted/50">
      <input type="checkbox" checked={checked} onChange={onChange} className="size-4 accent-primary" />
      <span>{label}</span>
    </label>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gold-gradient">{t("browse")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{ar ? "كل الفلاتر أمامك مباشرة — غيّر أي اختيار وستتحدث النتائج تلقائيًا." : "All filters are available immediately. Results update as you change them."}</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <SlidersHorizontal className="size-4 text-primary" />
          <span>{ar ? `${activeFilters} اختيار نشط` : `${activeFilters} active filters`}</span>
        </div>
      </div>

      <section className="space-y-5 rounded-2xl ornate-border bg-card-gradient p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-bold"><Search className="size-4 text-primary" />{ar ? "البحث والفلاتر الشاملة" : "Search & advanced filters"}</h2>
          <Button type="button" variant="ghost" size="sm" onClick={resetFilters} disabled={activeFilters === 0 && sort === "newest"}>
            <RotateCcw className="me-1 size-4" />{ar ? "مسح الكل" : "Clear all"}
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="sm:col-span-2"><span className={labelCls}>{ar ? "كلمة البحث" : "Keyword"}</span><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={ar ? "ابحث في الوصف أو السيرفر..." : "Search description or server..."} /></label>
          <label><span className={labelCls}>{ar ? "السيرفر" : "Server"}</span><Input value={server} onChange={(e) => setServer(e.target.value)} placeholder="K176" /></label>
          <label><span className={labelCls}>{t("sort")}</span><select className={selectCls} value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="newest">{t("newest")}</option><option value="priceLow">{t("priceLow")}</option><option value="priceHigh">{t("priceHigh")}</option><option value="powerHigh">{t("powerHigh")}</option><option value="scienceHigh">{ar ? "قوة العلوم: الأعلى" : "Science: highest"}</option><option value="levelHigh">{ar ? "مستوى القلعة: الأعلى" : "Castle level: highest"}</option>
          </select></label>
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-bold">{ar ? "مواصفات القلعة" : "Castle specifications"}</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {field("minLevel", ar ? "المستوى من" : "Level from", "1")}{field("maxLevel", ar ? "المستوى إلى" : "Level to", "100")}
            {field("minPower", ar ? "القوة من" : "Power from")}{field("maxPower", ar ? "القوة إلى" : "Power to")}
            {field("minScience", ar ? "قوة العلوم من" : "Science power from")}{field("maxScience", ar ? "قوة العلوم إلى" : "Science power to")}
            {field("minPrice", ar ? "السعر من ($)" : "Price from ($)")}{field("maxPrice", ar ? "السعر إلى ($)" : "Price to ($)")}
            {field("minReserve", ar ? "الاحتياطي من" : "Reserve from")}{field("maxReserve", ar ? "الاحتياطي إلى" : "Reserve to")}
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-bold">{ar ? "الأبطال والهلالات" : "Heroes & crescents"}</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2 rounded-xl border border-border/70 p-3">
              <p className="text-xs text-muted-foreground">{ar ? "اختر بطلًا أو أكثر" : "Choose one or more heroes"}</p>
              {HERO_TYPES.map((ht) => <div key={ht.type} className="space-y-2">
                <p className="text-xs font-semibold text-primary">{pick(ht)}</p>
                <div className="grid grid-cols-2 gap-2">
                  {HEROES.filter((h) => h.type === ht.type).map((h) => check(heroes.includes(h.key), pick(h), () => toggle(heroes, h.key, setHeroes)))}
                </div>
              </div>)}
            </div>
            <div className="grid content-start gap-3 sm:grid-cols-2">
              {field("minCrescents", ar ? "الهلالات العادية (حد أدنى)" : "Normal crescents (minimum)")}
              {field("minRedCrescents", ar ? "الهلالات الحمراء (حد أدنى)" : "Red crescents (minimum)")}
              <p className="sm:col-span-2 text-xs text-muted-foreground">{ar ? "فلاتر الهلالات تطبق على الأبطال المختارين، أو على أي بطل عند عدم اختيار بطل محدد." : "Crescent filters apply to selected heroes, or any hero if none is selected."}</p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <h3 className="text-sm font-bold">{ar ? "العتاد" : "Equipment"}</h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {EQUIPMENT_TIERS.map((tier) => check(equipment.includes(tier.key), ar ? tier.ar : tier.en, () => toggle(equipment, tier.key, setEquipment)))}
            </div>
            <label className="block max-w-xs"><span className={labelCls}>{ar ? "الحد الأدنى لعدد كل فئة مختارة" : "Minimum count for each selected tier"}</span><Input type="number" min={0} value={ranges.minEquipment} onChange={(e) => setRange("minEquipment", e.target.value)} placeholder="0" /></label>
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-bold">{ar ? "طرق الربط" : "Account links"}</h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {LINK_TYPES.map((link) => check(links.includes(link.key), link.label, () => toggle(links, link.key, setLinks)))}
            </div>
            <p className="text-xs text-muted-foreground">{ar ? "عند اختيار أكثر من وسيلة، يجب أن تتوفر كلها في الإعلان." : "When multiple links are selected, a listing must include all selected methods."}</p>
          </div>
        </div>
        {activeFilters > 0 && <div className="flex flex-wrap items-center gap-2 border-t border-border/70 pt-3">
          <span className="text-xs font-semibold text-muted-foreground">{ar ? "الفلاتر المطبقة" : "Applied filters"}:</span>
          {[q && `${ar ? "بحث" : "Search"}: ${q}`, server && `Server: ${server}`,
            ...Object.entries(ranges).filter(([,v]) => v !== "").map(([k,v]) => `${k}: ${v}`),
            ...heroes.map((h) => HEROES.find((x) => x.key === h)?.[ar ? "ar" : "en"] ?? h),
            ...equipment.map((e) => EQUIPMENT_TIERS.find((x) => x.key === e)?.[ar ? "ar" : "en"] ?? e),
            ...links].filter(Boolean).map((chip, i) => <span key={i} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs">{chip}<X className="size-3" /></span>)}
        </div>}
      </section>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{isLoading ? (ar ? "جارٍ تحميل النتائج…" : "Loading results…") : ar ? `النتائج: ${data?.length ?? 0}` : `Results: ${data?.length ?? 0}`}</span>
        <span className="text-xs">{ar ? "تحديث تلقائي" : "Live filtering"}</span>
      </div>
      {isError && <p className="py-8 text-center text-destructive">{ar ? "تعذر تحميل الإعلانات. حاول مرة أخرى." : "Could not load listings. Please try again."}</p>}
      {!isLoading && !isError && data?.length === 0 && <p className="py-10 text-center text-muted-foreground">{t("noResults")}</p>}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{data?.map((l) => <ListingCard key={l.id} listing={l} />)}</div>
    </div>
  );
}
