import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Check, MessageCircle, X, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FavoriteButton } from "@/components/FavoriteButton";
import { StatusBadge } from "@/components/StatusBadge";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { EQUIPMENT_TIERS, HERO_BY_KEY, HERO_TYPES, LINK_TYPES } from "@/lib/heroes";
import { formatNum, useImageUrls, type ListingWithHeroes } from "@/lib/listings";
import { whatsappLink } from "@/lib/listing-form";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { marketplaceAction } from "@/lib/marketplace.functions";
import { usePublicProfile } from "@/lib/profiles";
import { UserAvatar, Handle } from "@/components/UserAvatar";

export const Route = createFileRoute("/listings/$id")({
  head: () => ({
    meta: [
      { title: "تفاصيل القلعة — Mo7hammed Store" },
      { name: "description", content: "تفاصيل قلعة الفاتحون: المستوى، القوة، الأبطال، العتاد والروابط." },
      { property: "og:title", content: "تفاصيل القلعة — Mo7hammed Store" },
      { property: "og:description", content: "تفاصيل قلعة معروضة للبيع في لعبة الفاتحون." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Detail,
});

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted/60 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-bold">{value}</div>
    </div>
  );
}

function Detail() {
  const { id } = Route.useParams();
  const { t, lang, pick } = useI18n();
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [active, setActive] = useState(0);

  const { data: l, isLoading } = useQuery({
    queryKey: ["listing", id, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("listings").select("*, listing_heroes(*)").eq("id", id).maybeSingle();
      if (error) throw error;
      return data as ListingWithHeroes | null;
    },
  });
  const { data: urls } = useImageUrls(l?.images);
  const { data: seller } = usePublicProfile(l?.user_id);
  const act = useServerFn(marketplaceAction);

  if (isLoading) return <div className="py-20 text-center text-muted-foreground">…</div>;
  if (!l) return <div className="py-20 text-center text-muted-foreground">{t("noResults")}</div>;

  const canManage = user && (user.id === l.user_id || isAdmin);
  const del = async () => {
    if (!confirm(t("delete") + "?")) return;
    try { await act({ data: { action: "archive_listing", target: l.id, reason: "Removed from listing page" } }); }
    catch (e) { toast.error((e as Error).message); return; }
    navigate({ to: "/account" });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <div className="space-y-6">
        <div className="overflow-hidden rounded-2xl ornate-border bg-muted">
          {urls?.[active] ? (
            <img src={urls[active]} alt="" className="aspect-video w-full object-contain" />
          ) : (
            <div className="aspect-video" />
          )}
        </div>
        {urls && urls.length > 1 && (
          <div className="flex gap-2 overflow-x-auto">
            {urls.map((u, i) => (
              <button key={u} onClick={() => setActive(i)} className={cn("size-20 shrink-0 overflow-hidden rounded-lg border-2", i === active ? "border-primary" : "border-transparent")}>
                <img src={u} alt="" className="size-full object-cover" />
              </button>
            ))}
          </div>
        )}

        {l.description && (
          <section className="rounded-2xl ornate-border bg-card-gradient p-5">
            <h2 className="mb-2 text-lg font-bold text-primary">{t("details")}</h2>
            <p className="whitespace-pre-wrap leading-relaxed">{l.description}</p>
          </section>
        )}

        <section className="rounded-2xl ornate-border bg-card-gradient p-5">
          <h2 className="mb-3 text-lg font-bold text-primary">{t("heroes")}</h2>
          {l.listing_heroes.length === 0 && <p className="text-muted-foreground">—</p>}
          {HERO_TYPES.map((ht) => {
            const rows = l.listing_heroes.filter((h) => HERO_BY_KEY[h.hero_key]?.type === ht.type);
            if (!rows.length) return null;
            return (
              <div key={ht.type} className="mb-4">
                <h3 className="mb-2 text-sm font-bold text-muted-foreground">{pick(ht)}</h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  {rows.map((h) => (
                    <div key={h.id} className="flex items-center justify-between rounded-xl bg-muted/60 px-3 py-2">
                      <span className="font-bold">{pick(HERO_BY_KEY[h.hero_key])}</span>
                      <span className="flex gap-3 text-sm">
                        <span title={t("crescents")}>☾ {h.crescents}</span>
                        <span className="text-crescent-red" title={t("redCrescents")}>☾ {h.red_crescents}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </section>
      </div>

      <aside className="space-y-6">
        <div className="space-y-4 rounded-2xl ornate-border bg-card-gradient p-5 shadow-gold lg:sticky lg:top-20">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-sm text-muted-foreground">{t("level")} {l.castle_level}</div>
              <div className="text-4xl font-bold text-gold-gradient">${formatNum(l.price, lang)}</div>
            </div>
            <div className="flex items-center gap-2">
              {l.status !== "approved" && <StatusBadge status={l.status} />}
              <FavoriteButton listingId={l.id} />
            </div>
          </div>
          {l.status === "rejected" && l.rejection_reason && (
            <p className="rounded-lg bg-destructive/10 p-2 text-sm text-destructive">{l.rejection_reason}</p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Stat label={t("power")} value={formatNum(l.power, lang)} />
            <Stat label={t("science")} value={formatNum(l.science_power, lang)} />
            <Stat label={t("reserve")} value={formatNum(l.reserve, lang)} />
            <Stat label={t("server")} value={l.server} />
          </div>
          <Button variant="gold" size="xl" className="w-full" asChild>
            <a href={whatsappLink(l.whatsapp)} target="_blank" rel="noreferrer">
              <MessageCircle className="!size-5" /> {t("contact")}
            </a>
          </Button>
          {canManage && (
            <div className="flex gap-2">
              <Button variant="ornate" className="flex-1" asChild>
                <Link to="/edit/$id" params={{ id: l.id }}><Pencil /> {t("edit")}</Link>
              </Button>
              <Button variant="destructive" className="flex-1" onClick={del}><Trash2 /> {t("delete")}</Button>
            </div>
          )}
        </div>

        <section className="rounded-2xl ornate-border bg-card-gradient p-5">
          <h2 className="mb-3 text-lg font-bold text-primary">{t("equipment")}</h2>
          <div className="grid grid-cols-5 gap-2 text-center">
            {EQUIPMENT_TIERS.map((tier) => (
              <div key={tier.key} className="rounded-xl bg-muted/60 p-2">
                <span className={cn("mx-auto mb-1 block size-3 rounded-full", tier.color)} />
                <div className="text-xs text-muted-foreground">{pick(tier)}</div>
                <div className="font-bold">{l[tier.key]}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl ornate-border bg-card-gradient p-5">
          <h2 className="mb-3 text-lg font-bold text-primary">{t("links")}</h2>
          <div className="grid grid-cols-2 gap-2">
            {LINK_TYPES.map((lt) => (
              <div key={lt.key} className="flex items-center justify-between rounded-xl bg-muted/60 px-3 py-2">
                <span dir="ltr">{lt.label}</span>
                {l[lt.key] ? <Check className="size-5 text-success" /> : <X className="size-5 text-destructive" />}
              </div>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}
