import { Link } from "@tanstack/react-router";
import { Castle, Server, Swords } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { formatNum, useImageUrls, type Listing } from "@/lib/listings";
import { FavoriteButton } from "./FavoriteButton";
import { StatusBadge } from "./StatusBadge";

export function ListingCard({ listing, showStatus }: { listing: Listing; showStatus?: boolean }) {
  const { t, lang } = useI18n();
  const { data: urls } = useImageUrls(listing.images.slice(0, 1));
  return (
    <div className="group relative overflow-hidden rounded-2xl ornate-border bg-card-gradient shadow-card transition hover:-translate-y-1 hover:shadow-gold">
      <Link to="/listings/$id" params={{ id: listing.id }} className="block">
        <div className="relative aspect-[16/10] overflow-hidden bg-muted">
          {urls?.[0] ? (
            <img src={urls[0]} alt="" className="size-full object-cover transition group-hover:scale-105" loading="lazy" />
          ) : (
            <div className="flex size-full items-center justify-center">
              <Castle className="size-14 text-primary/40" />
            </div>
          )}
          <div className="absolute start-3 top-3 rounded-full bg-background/80 px-3 py-1 text-xs font-bold text-primary backdrop-blur">
            {t("level")} {listing.castle_level}
          </div>
        </div>
        <div className="space-y-3 p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-2xl font-bold text-gold-gradient">${formatNum(listing.price, lang)}</span>
            {showStatus && <StatusBadge status={listing.status} />}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Swords className="size-4 text-primary" /> {formatNum(listing.power, lang)}
            </span>
            <span className="flex items-center gap-1">
              <Server className="size-4 text-primary" /> {t("server")} {listing.server}
            </span>
          </div>
          {listing.description && <p className="line-clamp-2 text-sm text-foreground/80">{listing.description}</p>}
        </div>
      </Link>
      <div className="absolute end-3 top-3">
        <FavoriteButton listingId={listing.id} />
      </div>
    </div>
  );
}
