import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { formatNum } from "@/lib/listings";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { marketplaceAction } from "@/lib/marketplace.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "لوحة الإدارة — Mo7hammed Store" }, { name: "description", content: "مراجعة الإعلانات وطلبات التجار." }] }),
  component: Admin,
});

type Status = "pending" | "approved" | "rejected";
type AdminTab = "listings" | "applications";

function Admin() {
  const { t, lang } = useI18n();
  const { isAdmin, loading, can } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<AdminTab>("listings");
  const [filter, setFilter] = useState<Status>("pending");

  const { data: listings, isLoading: listingsLoading } = useQuery({
    queryKey: ["admin-listings", filter],
    enabled: isAdmin && can("listings.review"),
    queryFn: async () => {
      const { data, error } = await supabase.from("listings").select("*").eq("status", filter).is("archived_at", null).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const { data: applications, isLoading: applicationsLoading } = useQuery({
    queryKey: ["admin-seller-applications"],
    enabled: isAdmin && can("sellers.review"),
    queryFn: async () => {
      const { data, error } = await supabase.from("seller_applications").select("id,user_id,message,status,created_at").eq("status", "pending").order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  if (loading) return null;
  if (!isAdmin) return <p className="py-20 text-center text-muted-foreground">403</p>;

  const reviewListing = async (id: string, status: Status) => {
    const reason = status === "rejected"
      ? window.prompt(lang === "ar" ? "اكتب سبب الرفض (مطلوب)" : "Enter rejection reason (required)")?.trim()
      : (lang === "ar" ? "تمت الموافقة بعد المراجعة" : "Approved after review");
    if (!reason) return;
    try {
      await marketplaceAction({ data: { action: "moderate_listing", target: id, payload: { status }, reason } });
      await qc.invalidateQueries({ queryKey: ["admin-listings"] });
      toast.success(lang === "ar" ? "تم تحديث حالة الإعلان" : "Listing status updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action failed");
    }
  };

  const archiveListing = async (id: string) => {
    const reason = window.prompt(lang === "ar" ? "سبب أرشفة الإعلان" : "Reason for archiving")?.trim();
    if (!reason) return;
    try {
      await marketplaceAction({ data: { action: "archive_listing", target: id, payload: {}, reason } });
      await qc.invalidateQueries({ queryKey: ["admin-listings"] });
      toast.success(lang === "ar" ? "تمت أرشفة الإعلان" : "Listing archived");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action failed");
    }
  };

  const reviewSeller = async (id: string, status: "approved" | "rejected") => {
    const reason = window.prompt(status === "approved"
      ? (lang === "ar" ? "سبب/ملاحظة الموافقة" : "Approval note")
      : (lang === "ar" ? "سبب الرفض (مطلوب)" : "Rejection reason (required)"))?.trim();
    if (!reason) return;
    try {
      await marketplaceAction({ data: { action: "review_seller", target: id, payload: { status }, reason } });
      await qc.invalidateQueries({ queryKey: ["admin-seller-applications"] });
      toast.success(lang === "ar" ? "تمت مراجعة طلب التاجر" : "Seller application reviewed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action failed");
    }
  };

  const tabBtn = (active: boolean) => cn("rounded-full px-4 py-2 text-sm font-bold", active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground");

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gold-gradient">{t("admin")}</h1>
      <div className="flex flex-wrap gap-2">
        {can("listings.review") && <button className={tabBtn(tab === "listings")} onClick={() => setTab("listings")}>{t("listingsTab")}</button>}
        {can("sellers.review") && <button className={tabBtn(tab === "applications")} onClick={() => setTab("applications")}>{lang === "ar" ? "طلبات التجار" : "Seller applications"}</button>}
      </div>
      {tab === "listings" && can("listings.review") && (
        <>
          <div className="flex flex-wrap gap-2">
            {(["pending", "approved", "rejected"] as const).map((status) => <button key={status} className={tabBtn(filter === status)} onClick={() => setFilter(status)}>{t(status)}</button>)}
          </div>
          {listingsLoading && <p className="text-sm text-muted-foreground">{lang === "ar" ? "جارٍ تحميل الإعلانات…" : "Loading listings…"}</p>}
          {listings?.length === 0 && <p className="text-muted-foreground">{t("empty")}</p>}
          <div className="space-y-3">
            {listings?.map((listing) => (
              <div key={listing.id} className="flex flex-wrap items-center gap-3 rounded-xl ornate-border bg-card-gradient p-4">
                <div className="min-w-0 flex-1">
                  <div className="font-bold">{t("level")} {listing.castle_level} · {t("server")} {listing.server} · ${formatNum(listing.price, lang)}</div>
                  <div className="truncate text-sm text-muted-foreground">{listing.description || "—"}</div>
                  <div className="text-xs text-muted-foreground" dir="ltr">{listing.user_id}</div>
                </div>
                <StatusBadge status={listing.status} />
                {listing.status !== "approved" && <Button size="sm" variant="gold" onClick={() => reviewListing(listing.id, "approved")}>{t("approve")}</Button>}
                {listing.status !== "rejected" && <Button size="sm" variant="ornate" onClick={() => reviewListing(listing.id, "rejected")}>{t("reject")}</Button>}
                <Button size="sm" variant="destructive" onClick={() => archiveListing(listing.id)}>{lang === "ar" ? "أرشفة" : "Archive"}</Button>
              </div>
            ))}
          </div>
        </>
      )}
      {tab === "applications" && can("sellers.review") && (
        <div className="space-y-3">
          {applicationsLoading && <p className="text-sm text-muted-foreground">{lang === "ar" ? "جارٍ تحميل الطلبات…" : "Loading applications…"}</p>}
          {applications?.length === 0 && <p className="text-muted-foreground">{t("empty")}</p>}
          {applications?.map((application) => (
            <article key={application.id} className="space-y-3 rounded-xl ornate-border bg-card-gradient p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <strong>{lang === "ar" ? "طلب تاجر جديد" : "New seller application"}</strong>
                <span className="text-xs text-muted-foreground">{new Date(application.created_at).toLocaleString(lang === "ar" ? "ar-EG" : "en-US")}</span>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-7">{application.message}</p>
              <div className="text-xs text-muted-foreground" dir="ltr">{application.user_id}</div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="gold" onClick={() => reviewSeller(application.id, "approved")}>{t("approve")}</Button>
                <Button size="sm" variant="destructive" onClick={() => reviewSeller(application.id, "rejected")}>{t("reject")}</Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
