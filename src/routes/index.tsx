import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Search, ShieldCheck, MessageCircle, Crown } from "lucide-react";
import heroImg from "@/assets/hero-castle.jpg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ListingCard } from "@/components/ListingCard";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Mo7hammed Store — بيع وشراء قلاع الفاتحون" },
      { name: "description", content: "سوق فاخر لبيع وشراء قلاع وحسابات لعبة الفاتحون مع مراجعة لكل إعلان." },
      { property: "og:title", content: "Mo7hammed Store — بيع وشراء قلاع الفاتحون" },
      { property: "og:description", content: "سوق فاخر لبيع وشراء قلاع وحسابات لعبة الفاتحون." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const { data: latest } = useQuery({
    queryKey: ["latest"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listings")
        .select("*")
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .limit(6);
      if (error) throw error;
      return data;
    },
  });

  const features = [
    { icon: ShieldCheck, ar: "مراجعة كل إعلان", en: "Every listing reviewed" },
    { icon: MessageCircle, ar: "تواصل مباشر واتساب", en: "Direct WhatsApp contact" },
    { icon: Crown, ar: "تفاصيل الأبطال والعتاد", en: "Full hero & gear details" },
  ];

  return (
    <div className="space-y-14">
      <section className="relative -mx-4 overflow-hidden rounded-b-3xl sm:mx-0 sm:rounded-3xl">
        <img src={heroImg} alt="" className="absolute inset-0 size-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/20" />
        <div className="relative flex min-h-[460px] flex-col items-center justify-end gap-6 px-6 pb-12 text-center">
          <h1 className="max-w-3xl text-4xl font-bold leading-tight sm:text-6xl">
            <span className="text-gold-gradient">{t("heroTitle")}</span>
          </h1>
          <p className="max-w-xl text-lg text-foreground/85">{t("heroSub")}</p>
          <Button variant="gold" size="xl" asChild>
            <Link to="/new">
              <Plus className="!size-5" /> {t("addListing")}
            </Link>
          </Button>
          <form
            className="flex w-full max-w-xl gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              navigate({ to: "/listings", search: { q: q || undefined } });
            }}
          >
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search")} className="h-12 bg-background/80" />
            <Button type="submit" variant="ornate" className="h-12 px-5" aria-label="search">
              <Search />
            </Button>
          </form>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {features.map((f) => (
          <div key={f.en} className="flex items-center gap-3 rounded-2xl ornate-border bg-card-gradient p-5">
            <f.icon className="size-8 text-primary" />
            <span className="font-bold">{lang === "ar" ? f.ar : f.en}</span>
          </div>
        ))}
      </section>

      <section className="space-y-5">
        <div className="flex items-end justify-between">
          <h2 className="text-3xl font-bold">{t("latest")}</h2>
          <Link to="/listings" className="text-sm text-primary hover:underline">
            {t("viewAll")}
          </Link>
        </div>
        {latest && latest.length === 0 && <p className="text-muted-foreground">{t("empty")}</p>}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {latest?.map((l) => <ListingCard key={l.id} listing={l} />)}
        </div>
      </section>
    </div>
  );
}
