import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/StatusBadge";
import { UserAvatar, Handle } from "@/components/UserAvatar";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { formatNum } from "@/lib/listings";
import { marketplaceAction } from "@/lib/marketplace.functions";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "لوحة الإدارة — Mo7hammed Store" },
      { name: "description", content: "مراجعة الإعلانات وإدارة جميع الحسابات." },
      { property: "og:title", content: "لوحة الإدارة — Mo7hammed Store" },
      { property: "og:description", content: "مراجعة الإعلانات وإدارة جميع الحسابات." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Admin,
});

type Status = "pending" | "approved" | "rejected";
type AccountTab = "listings" | "users" | "sellers" | "moderators" | "applications";
const ROLE_LABEL: Record<string, { ar: string; en: string }> = {
  owner: { ar: "المالك", en: "Owner" }, head_moderator: { ar: "كبير المشرفين", en: "Head moderator" },
  moderator: { ar: "مشرف", en: "Moderator" },
  seller: { ar: "تاجر", en: "Seller" }, customer: { ar: "عضو", en: "Member" },
};

function Admin() {
  const { t, lang } = useI18n();
  const ar = lang === "ar";
  const { user, isAdmin, isOwner, isHeadModerator, can, loading, loadedRoles, authIssue } = useAuth();
  const qc = useQueryClient();
  const act = useServerFn(marketplaceAction);
  // Use the role rows loaded for this exact session as the source of truth for account tabs.
  // This avoids a stale derived flag hiding owner-only navigation after auth hydration.
  const canSeeAccounts = isAdmin && (isOwner || isHeadModerator || loadedRoles.includes("owner") || (loadedRoles.includes("head_moderator") && !authIssue));
  const [tab, setTab] = useState<AccountTab>("listings");
  const [filter, setFilter] = useState<Status>("pending");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const { data: listings } = useQuery({
    queryKey: ["admin-listings", filter],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("listings").select("*").eq("status", filter).is("archived_at", null).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const { data: applications, error: appErr } = useQuery({
    queryKey: ["admin-seller-applications", user?.id],
    enabled: canSeeAccounts && tab === "applications",
    queryFn: async () => {
      const { data, error } = await supabase.from("seller_applications").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const { data: accounts, error: accErr } = useQuery({
    queryKey: ["admin-accounts", user?.id],
    enabled: canSeeAccounts && (tab === "users" || tab === "sellers" || tab === "moderators"),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_accounts");
      if (error) throw error;
      return data;
    },
  });

  const { data: accountPermissions } = useQuery({
    queryKey: ["admin-account-permissions", user?.id],
    enabled: canSeeAccounts && (tab === "users" || tab === "sellers" || tab === "moderators"),
    queryFn: async () => {
      const { data, error } = await supabase.from("account_permissions").select("user_id,permission,scope_user_id");
      if (error) throw error;
      return data;
    },
  });

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase().replace(/^@/, "");
    return (accounts ?? []).filter((a) => {
      const seller = a.roles.includes("seller");
      const staff = a.roles.includes("moderator") || a.roles.includes("head_moderator");
      if (tab === "users" && (seller || staff || a.roles.includes("owner"))) return false;
      if (tab === "sellers" && (!seller || a.roles.includes("owner"))) return false;
      if (tab === "moderators" && !staff) return false;
      if (!needle) return true;
      return [a.username, a.display_name, a.email].some((v) => v?.toLowerCase().includes(needle));
    });
  }, [accounts, tab, q]);
  const selected = accounts?.find((a) => a.id === openId);

  if (loading) return null;

  const run = async (input: Parameters<typeof act>[0]["data"], key: string) => {
    try { await act({ data: input }); qc.invalidateQueries({ queryKey: [key] }); return true; }
    catch (e) { toast.error((e as Error).message); return false; }
  };
  const setStatus = async (id: string, status: Status) => {
    const reason = prompt(status === "rejected" ? (ar ? "سبب الرفض" : "Rejection reason") : (ar ? "ملاحظة القرار" : "Decision note"), status === "approved" ? (ar ? "مطابق للشروط" : "Meets requirements") : "");
    if (!reason?.trim()) return;
    await run({ action: "moderate_listing", target: id, payload: { status }, reason }, "admin-listings");
  };
  const archive = async (id: string) => {
    const reason = prompt(ar ? "سبب الإزالة" : "Reason for removal");
    if (!reason?.trim()) return;
    await run({ action: "archive_listing", target: id, reason }, "admin-listings");
  };
  const setBan = async (id: string, enabled: boolean) => {
    const reason = prompt(ar ? "السبب" : "Reason");
    if (!reason?.trim()) return;
    await run({ action: "suspend", target: id, payload: { enabled }, reason }, "admin-accounts");
  };

  const togglePermission = async (id: string, permission: string) => {
    const enabled = !(accountPermissions ?? []).some((p) => p.user_id === id && p.permission === permission && p.scope_user_id === null);
    const reason = prompt(ar ? "سبب تغيير صلاحية المشرف" : "Reason for permission change");
    if (!reason?.trim()) return;
    const ok = await run({ action: "set_permission", target: id, payload: { permission, scope_user_id: "", enabled }, reason }, "admin-account-permissions");
    if (ok) qc.invalidateQueries({ queryKey: ["admin-accounts"] });
  };

  const pill = (active: boolean) => cn("rounded-full px-4 py-1.5 text-sm font-bold", active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground");
  const roleText = (roles: string[]) => roles.filter((r) => r !== "customer" || roles.length === 1).map((r) => ROLE_LABEL[r]?.[lang] ?? r).join("، ");
  const date = (d: string) => new Date(d).toLocaleDateString(ar ? "ar-EG" : "en-US");

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gold-gradient">{t("admin")}</h1>
      {!canSeeAccounts && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 text-sm" dir="rtl">
          <p className="font-bold">تشخيص صلاحيات الحساب</p>
          <p>الحساب الحالي: <span dir="ltr">{user?.email ?? "غير معروف"}</span></p>
          <p>الأدوار التي وصلت من قاعدة البيانات: {loadedRoles.length ? loadedRoles.join("، ") : "لم يصل أي دور"}</p>
          <p>{authIssue ?? "لم يتم التعرف على دور المالك أو كبير المشرفين في الجلسة الحالية."}</p>
          <p className="mt-2 text-muted-foreground">لن يتم تغيير أي صلاحية تلقائيًا. هذه المعلومات لتحديد سبب اختفاء تبويبات الأعضاء والتجار.</p>
        </div>
      )}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5" role="tablist" aria-label={ar ? "أقسام لوحة الإدارة" : "Admin sections"}>
        <button className={cn(pill(tab === "listings"), "w-full")} role="tab" aria-selected={tab === "listings"} onClick={() => setTab("listings")}>{t("listingsTab")}</button>
        <button className={cn(pill(tab === "users"), "w-full")} role="tab" aria-selected={tab === "users"} onClick={() => setTab("users")}>{ar ? "الأعضاء" : "Members"}</button>
        <button className={cn(pill(tab === "sellers"), "w-full")} role="tab" aria-selected={tab === "sellers"} onClick={() => setTab("sellers")}>{ar ? "التجار" : "Sellers"}</button>
        <button className={cn(pill(tab === "moderators"), "w-full")} role="tab" aria-selected={tab === "moderators"} onClick={() => setTab("moderators")}>{ar ? "فريق الإشراف" : "Moderators"}</button>
        <button className={cn(pill(tab === "applications"), "w-full")} role="tab" aria-selected={tab === "applications"} onClick={() => setTab("applications")}>{ar ? "طلبات التجار" : "Seller requests"}</button>
      </div>
      <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-3 text-xs" dir="rtl">
        <p className="font-bold">تشخيص صلاحيات الإدارة</p>
        <p>الحساب: <span dir="ltr">{user?.email ?? "غير معروف"}</span></p>
        <p>الأدوار المحمّلة: {loadedRoles.join("، ") || "لم تصل الأدوار"}</p>
        <p>isAdmin: {isAdmin ? "true" : "false"} · isOwner: {isOwner ? "true" : "false"} · head moderator: {isHeadModerator ? "true" : "false"}</p>
        <p>صلاحية إدارة الحسابات: {canSeeAccounts ? "متاحة" : "غير متاحة"}{authIssue ? ` · ${authIssue}` : ""}</p>
      </div>
      {!isAdmin && <div className="rounded-xl border border-destructive/40 p-3 text-sm" dir="rtl">الواجهة الإدارية ظاهرة للتشخيص فقط؛ بيانات الإدارة تظل محمية حتى تحميل صلاحيات موظف مخوّل.</div>}

      {tab === "listings" && !isAdmin && (
        <p className="text-sm text-muted-foreground" dir="rtl">لا يمكن تحميل الإعلانات الإدارية قبل التحقق من صلاحية الإدارة.</p>
      )}
      {tab === "listings" && isAdmin && (
        <>
          <div className="flex gap-2">
            {(["pending", "approved", "rejected"] as const).map((s) => (
              <button key={s} className={pill(filter === s)} onClick={() => setFilter(s)}>{t(s)}</button>
            ))}
          </div>
          {listings?.length === 0 && <p className="text-muted-foreground">{t("empty")}</p>}
          <div className="space-y-3">
            {listings?.map((l) => (
              <div key={l.id} className="flex flex-wrap items-center gap-3 rounded-xl ornate-border bg-card-gradient p-4">
                <Link to="/listings/$id" params={{ id: l.id }} className="min-w-0 flex-1">
                  <div className="font-bold">{t("level")} {l.castle_level} · {t("server")} {l.server} · ${formatNum(l.price, lang)}</div>
                  <div className="truncate text-sm text-muted-foreground">{l.description || "—"}</div>
                </Link>
                <StatusBadge status={l.status} />
                {can("listings.review", l.user_id) && <>
                  {l.status !== "approved" && <Button size="sm" variant="gold" onClick={() => setStatus(l.id, "approved")}>{t("approve")}</Button>}
                  {l.status !== "rejected" && <Button size="sm" variant="ornate" onClick={() => setStatus(l.id, "rejected")}>{t("reject")}</Button>}
                  <Button size="sm" variant="destructive" onClick={() => archive(l.id)}>{t("delete")}</Button>
                </>}
              </div>
            ))}
          </div>
        </>
      )}

      {(tab === "users" || tab === "sellers" || tab === "moderators") && !canSeeAccounts && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 text-sm" dir="rtl">
          <p className="font-bold">تعذر اعتماد صلاحية إدارة الحسابات</p>
          <p>الأدوار المحمّلة: {loadedRoles.join("، ") || "لا توجد أدوار"}</p>
          <p>{authIssue ?? "الحساب يحتاج دور المالك أو كبير المشرفين."}</p>
        </div>
      )}
      {(tab === "users" || tab === "sellers" || tab === "moderators") && canSeeAccounts && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">{tab === "sellers" ? (ar ? "حسابات التجار" : "Seller accounts") : tab === "moderators" ? (ar ? "فريق الإشراف" : "Moderators") : (ar ? "المستخدمون" : "Users")}</span>
            <div className="relative ms-auto w-full sm:w-72">
              <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="ps-9" placeholder={ar ? "بحث بالاسم أو @username أو البريد" : "Search name, @username, email"} value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </div>
          {accErr && <p className="text-destructive">{ar ? "لا تملك صلاحية عرض الحسابات" : "Not allowed to view accounts"}</p>}
          <p className="text-sm text-muted-foreground">{shown.length} {ar ? "حساب" : "accounts"}</p>
          <div className="space-y-3">
            {shown.map((a) => (
              <button key={a.id} onClick={() => setOpenId(a.id)} className="flex w-full flex-wrap items-center gap-3 rounded-xl ornate-border bg-card-gradient p-4 text-start">
                <UserAvatar path={a.avatar_path} className="size-11" />
                <div className="min-w-0 flex-1">
                  <div className="font-bold">{a.display_name || "—"}</div>
                  {a.username ? <Handle username={a.username} /> : <span className="text-xs text-muted-foreground">{ar ? "بلا اسم مستخدم" : "No username yet"}</span>}
                  {a.email && <div className="truncate text-xs text-muted-foreground" dir="ltr">{a.email}</div>}
                </div>
                <span className="rounded-full bg-muted px-3 py-1 text-xs">{roleText(a.roles)}</span>
                <span className="text-xs text-muted-foreground">{date(a.created_at)}</span>
                <span className={cn("text-xs font-bold", a.is_banned ? "text-destructive" : "text-success")}>{a.is_banned ? (ar ? "موقوف" : "Suspended") : (ar ? "نشط" : "Active")}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {tab === "applications" && !canSeeAccounts && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 text-sm" dir="rtl">
          <p className="font-bold">تعذر اعتماد صلاحية إدارة طلبات التجار</p>
          <p>الأدوار المحمّلة: {loadedRoles.join("، ") || "لا توجد أدوار"}</p>
          <p>{authIssue ?? "الحساب يحتاج دور المالك أو كبير المشرفين."}</p>
        </div>
      )}
      {tab === "applications" && canSeeAccounts && (
        <section className="space-y-3">
          {appErr && <p className="text-destructive">{ar ? "تعذر تحميل طلبات التجار" : "Could not load seller requests"}</p>}
          {!applications?.length && !appErr && <p className="text-muted-foreground">{ar ? "لا توجد طلبات تجار" : "No seller requests"}</p>}
          {applications?.map((app) => (
            <div key={app.id} className="space-y-3 rounded-xl ornate-border bg-card-gradient p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-bold">{ar ? "طلب تاجر" : "Seller request"}</div>
                <StatusBadge status={app.status as "approved" | "pending" | "rejected"} />
              </div>
              <p className="whitespace-pre-wrap text-sm">{app.message}</p>
              {app.reason && <p className="text-xs text-muted-foreground">{ar ? "السبب: " : "Reason: "}{app.reason}</p>}
              <p className="text-xs text-muted-foreground">{date(app.created_at)}</p>
              {app.status === "pending" && can("sellers.review", app.user_id) && (
                <div className="flex gap-2">
                  <Button size="sm" variant="gold" onClick={() => {
                    const reason = prompt(ar ? "ملاحظة الموافقة" : "Approval note", ar ? "تمت الموافقة" : "Approved");
                    if (reason?.trim()) void run({ action: "review_seller", target: app.id, payload: { status: "approved" }, reason }, "admin-seller-applications").then(() => qc.invalidateQueries({ queryKey: ["admin-accounts"] }));
                  }}>{ar ? "قبول" : "Approve"}</Button>
                  <Button size="sm" variant="destructive" onClick={() => {
                    const reason = prompt(ar ? "سبب الرفض" : "Rejection reason");
                    if (reason?.trim()) void run({ action: "review_seller", target: app.id, payload: { status: "rejected" }, reason }, "admin-seller-applications");
                  }}>{ar ? "رفض" : "Reject"}</Button>
                </div>
              )}
            </div>
          ))}
        </section>
      )}

      <Dialog open={!!selected} onOpenChange={(o) => !o && setOpenId(null)}>
        <DialogContent>
          {selected && <>
            <DialogHeader><DialogTitle>{ar ? "تفاصيل الحساب" : "Account details"}</DialogTitle></DialogHeader>
            <div className="flex items-center gap-4">
              <UserAvatar path={selected.avatar_path} className="size-16" />
              <div>
                <div className="text-lg font-bold">{selected.display_name || "—"}</div>
                <Handle username={selected.username} />
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <dt className="text-muted-foreground">{ar ? "البريد" : "Email"}</dt><dd dir="ltr">{selected.email ?? "—"}</dd>
              <dt className="text-muted-foreground">{ar ? "نوع الحساب" : "Account type"}</dt><dd>{roleText(selected.roles)}</dd>
              <dt className="text-muted-foreground">{ar ? "تاريخ الانضمام" : "Joined"}</dt><dd>{date(selected.created_at)}</dd>
              <dt className="text-muted-foreground">{ar ? "الحالة" : "Status"}</dt><dd>{selected.is_banned ? (ar ? "موقوف" : "Suspended") : (ar ? "نشط" : "Active")}</dd>
              <dt className="text-muted-foreground">{ar ? "الإعلانات" : "Listings"}</dt><dd>{selected.listings_count}</dd>
              <dt className="text-muted-foreground">{ar ? "طلب التاجر" : "Seller application"}</dt><dd>{selected.seller_application ?? "—"}</dd>
            </dl>
            {isOwner && selected.id !== user?.id && !selected.roles.includes("owner") && (
              <div className="space-y-2 border-t pt-4">
                <p className="text-sm font-bold">{ar ? "إدارة صلاحيات الحساب" : "Account roles"}</p>
                {(["seller", "moderator", "head_moderator"] as const).map((role) => {
                  const enabled = selected.roles.includes(role);
                  return <Button key={role} className="me-2" variant={enabled ? "destructive" : "ornate"} onClick={() => {
                    const reason = prompt(ar ? "سبب تغيير الصلاحية" : "Reason for role change");
                    if (!reason?.trim()) return;
                    void run({ action: "set_role", target: selected.id, payload: { role, enabled: !enabled }, reason }, "admin-accounts").then((ok) => { if (ok) setOpenId(null); });
                  }}>{enabled ? (role === "seller" ? (ar ? "إلغاء صفة التاجر" : "Remove seller") : role === "moderator" ? (ar ? "إلغاء صفة مشرف" : "Remove moderator") : (ar ? "إلغاء كبير المشرفين" : "Remove head moderator")) : (role === "seller" ? (ar ? "ترقية إلى تاجر" : "Promote to seller") : role === "moderator" ? (ar ? "تعيين مشرف" : "Promote to moderator") : (ar ? "ترقية إلى كبير المشرفين" : "Promote to head moderator"))}</Button>;
                })}
              </div>
            )}
            {isOwner && selected.id !== user?.id && !selected.roles.includes("owner") &&
              (selected.roles.includes("moderator") || selected.roles.includes("head_moderator") || selected.roles.includes("seller")) && (
              <div className="space-y-2 border-t pt-4">
                <p className="text-sm font-bold">{ar ? "صلاحيات الإشراف" : "Moderation permissions"}</p>
                {([
                  ["listings.review", ar ? "مراجعة الإعلانات" : "Review listings"],
                  ["listings.edit", ar ? "تعديل الإعلانات" : "Edit listings"],
                  ["sellers.review", ar ? "مراجعة طلبات التجار" : "Review seller applications"],
                  ["accounts.suspend", ar ? "إيقاف الحسابات" : "Suspend accounts"],
                ] as const).map(([permission, label]) => {
                  const enabled = (accountPermissions ?? []).some((p) => p.user_id === selected.id && p.permission === permission && p.scope_user_id === null);
                  return <Button key={permission} size="sm" className="me-2 mb-2" variant={enabled ? "gold" : "outline"} onClick={() => void togglePermission(selected.id, permission)}>
                    {enabled ? (ar ? "إلغاء: " : "Remove: ") : (ar ? "منح: " : "Grant: ")}{label}
                  </Button>;
                })}
              </div>
            )}
            {selected.id !== user?.id && !selected.roles.includes("owner") && can("accounts.suspend", selected.id) && (
              <Button variant={selected.is_banned ? "ornate" : "destructive"} onClick={() => setBan(selected.id, !selected.is_banned)}>
                {selected.is_banned ? t("unban") : t("ban")}
              </Button>
            )}
          </>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
