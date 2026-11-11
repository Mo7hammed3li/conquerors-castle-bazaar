import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/StatusBadge";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { formatNum } from "@/lib/listings";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { marketplaceAction } from "@/lib/marketplace.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "لوحة الإدارة — Mo7hammed Store" }, { name: "description", content: "مراجعة الإعلانات وطلبات التجار وإدارة صلاحيات البيع." }] }),
  component: Admin,
});

type Status = "pending" | "approved" | "rejected";
type AdminTab = "listings" | "applications" | "manual";

function Admin() {
  const { t, lang } = useI18n();
  const { isAdmin, isOwner, loading, can } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<AdminTab>(() => (can("listings.review") ? "listings" : "applications"));
  const [filter, setFilter] = useState<Status>("pending");
  const [userSearch, setUserSearch] = useState("");
  const ar = lang === "ar";
  const normalizedSearch = userSearch.trim().replace(/[%_*]/g, "").slice(0, 80);
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalizedSearch);

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
  const { data: sellerCandidates, isLoading: candidatesLoading, isError: candidatesError } = useQuery({
    queryKey: ["admin-seller-candidates", normalizedSearch],
    enabled: isOwner && tab === "manual",
    queryFn: async () => {
      let query = supabase.from("profiles").select("id,display_name,is_banned").order("created_at", { ascending: false }).limit(30);
      if (normalizedSearch.length >= 2) {
        query = isUuid
          ? query.eq("id", normalizedSearch)
          : query.ilike("display_name", `%${normalizedSearch}%`);
      }
      const { data: profiles, error } = await query;
      if (error) throw error;
      const ids = (profiles ?? []).map((profile) => profile.id);
      if (!ids.length) return [];
      const { data: roles, error: rolesError } = await supabase.from("account_roles").select("user_id").eq("role", "seller").in("user_id", ids);
      if (rolesError) throw rolesError;
      const sellers = new Set((roles ?? []).map((role) => role.user_id));
      return (profiles ?? []).map((profile) => ({ ...profile, isSeller: sellers.has(profile.id) }));
    },
  });

  if (loading) return null;
  if (!isAdmin) return <p className="py-20 text-center text-muted-foreground">403</p>;

  const reviewListing = async (id: string, status: Status) => {
    const reason = status === "rejected"
      ? window.prompt(ar ? "اكتب سبب الرفض (مطلوب)" : "Enter rejection reason (required)")?.trim()
      : (ar ? "تمت الموافقة بعد المراجعة" : "Approved after review");
    if (!reason) return;
    try {
      await marketplaceAction({ data: { action: "moderate_listing", target: id, payload: { status }, reason } });
      await qc.invalidateQueries({ queryKey: ["admin-listings"] });
      toast.success(ar ? "تم تحديث حالة الإعلان" : "Listing status updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action failed");
    }
  };

  const archiveListing = async (id: string) => {
    const reason = window.prompt(ar ? "سبب أرشفة الإعلان" : "Reason for archiving")?.trim();
    if (!reason) return;
    try {
      await marketplaceAction({ data: { action: "archive_listing", target: id, payload: {}, reason } });
      await qc.invalidateQueries({ queryKey: ["admin-listings"] });
      toast.success(ar ? "تمت أرشفة الإعلان" : "Listing archived");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action failed");
    }
  };

  const reviewSeller = async (id: string, status: "approved" | "rejected") => {
    const reason = window.prompt(status === "approved"
      ? (ar ? "سبب/ملاحظة الموافقة" : "Approval note")
      : (ar ? "سبب الرفض (مطلوب)" : "Rejection reason (required)"))?.trim();
    if (!reason) return;
    try {
      await marketplaceAction({ data: { action: "review_seller", target: id, payload: { status }, reason } });
      await qc.invalidateQueries({ queryKey: ["admin-seller-applications"] });
      toast.success(ar ? "تمت مراجعة طلب التاجر" : "Seller application reviewed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action failed");
    }
  };

  const addSellerManually = async (userId: string) => {
    const reason = window.prompt(ar ? "اكتب سبب منح صلاحية التاجر يدويًا" : "Reason for manually granting seller access")?.trim();
    if (!reason) return;
    try {
      await marketplaceAction({ data: { action: "set_role", target: userId, payload: { role: "seller", enabled: true }, reason } });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["admin-seller-candidates"] }),
        qc.invalidateQueries({ queryKey: ["seller-directory"] }),
      ]);
      toast.success(ar ? "تم تفعيل صلاحية التاجر وإضافته للدليل" : "Seller access enabled and directory updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : (ar ? "تعذر تفعيل التاجر" : "Could not enable seller"));
    }
  };

  const tabBtn = (active: boolean) => cn("rounded-full px-4 py-2 text-sm font-bold", active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground");

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gold-gradient">{t("admin")}</h1>
      <div className="flex flex-wrap gap-2">
        {can("listings.review") && <button className={tabBtn(tab === "listings")} onClick={() => setTab("listings")}>{t("listingsTab")}</button>}
        {can("sellers.review") && <button className={tabBtn(tab === "applications")} onClick={() => setTab("applications")}>{ar ? "طلبات التجار" : "Seller applications"}</button>}
        {isOwner && <button className={tabBtn(tab === "manual")} onClick={() => setTab("manual")}>{ar ? "إضافة تاجر يدويًا" : "Add seller manually"}</button>}
      </div>

      {tab === "listings" && can("listings.review") && (
        <>
          <div className="flex flex-wrap gap-2">
            {(["pending", "approved", "rejected"] as const).map((status) => <button key={status} className={tabBtn(filter === status)} onClick={() => setFilter(status)}>{t(status)}</button>)}
          </div>
          {listingsLoading && <p className="text-sm text-muted-foreground">{ar ? "جارٍ تحميل الإعلانات…" : "Loading listings…"}</p>}
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
                <Button size="sm" variant="destructive" onClick={() => archiveListing(listing.id)}>{ar ? "أرشفة" : "Archive"}</Button>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === "applications" && can("sellers.review") && (
        <div className="space-y-3">
          {applicationsLoading && <p className="text-sm text-muted-foreground">{ar ? "جارٍ تحميل الطلبات…" : "Loading applications…"}</p>}
          {applications?.length === 0 && <p className="text-muted-foreground">{t("empty")}</p>}
          {applications?.map((application) => (
            <article key={application.id} className="space-y-3 rounded-xl ornate-border bg-card-gradient p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <strong>{ar ? "طلب تاجر جديد" : "New seller application"}</strong>
                <span className="text-xs text-muted-foreground">{new Date(application.created_at).toLocaleString(ar ? "ar-EG" : "en-US")}</span>
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

      {tab === "manual" && isOwner && (
        <section className="space-y-4 rounded-2xl ornate-border bg-card-gradient p-5">
          <div>
            <h2 className="text-xl font-bold">{ar ? "منح صلاحية التاجر" : "Grant seller access"}</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {ar ? "ابحث باسم الحساب أو بمعرّف المستخدم (UUID). هذه الخاصية للمالك فقط، وتُسجّل العملية في سجل الإدارة." : "Find an account by display name or user ID (UUID). Owner-only; every change is recorded in the admin audit log."}
            </p>
          </div>
          <Input
            value={userSearch}
            onChange={(event) => setUserSearch(event.target.value)}
            placeholder={ar ? "اسم الحساب أو UUID…" : "Display name or UUID…"}
            maxLength={100}
          />
          {candidatesLoading && <p className="text-sm text-muted-foreground">{ar ? "جارٍ البحث…" : "Searching…"}</p>}
          {candidatesError && <p className="text-sm text-destructive">{ar ? "تعذر تحميل الحسابات." : "Could not load accounts."}</p>}
          {!candidatesLoading && sellerCandidates?.length === 0 && <p className="text-sm text-muted-foreground">{ar ? "لا توجد حسابات مطابقة." : "No matching accounts."}</p>}
          <div className="space-y-2">
            {sellerCandidates?.map((candidate) => (
              <div key={candidate.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border/70 bg-background/50 p-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{candidate.display_name || (ar ? "مستخدم بدون اسم" : "Unnamed user")}</p>
                  <p className="break-all text-xs text-muted-foreground" dir="ltr">{candidate.id}</p>
                  {candidate.is_banned && <p className="mt-1 text-xs text-destructive">{ar ? "الحساب محظور" : "Account is banned"}</p>}
                </div>
                {candidate.isSeller ? (
                  <span className="text-sm font-semibold text-emerald-600">{ar ? "تاجر بالفعل" : "Already a seller"}</span>
                ) : (
                  <Button size="sm" variant="gold" disabled={candidate.is_banned} onClick={() => addSellerManually(candidate.id)}>
                    {ar ? "تفعيل كتاجر" : "Enable seller"}
                  </Button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
