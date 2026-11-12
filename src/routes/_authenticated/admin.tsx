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
type Kind = "all" | "members" | "sellers";
const ROLE_LABEL: Record<string, { ar: string; en: string }> = {
  owner: { ar: "المالك", en: "Owner" }, head_moderator: { ar: "مشرف رئيسي", en: "Head moderator" },
  seller: { ar: "تاجر", en: "Seller" }, customer: { ar: "عضو", en: "Member" },
};

function Admin() {
  const { t, lang } = useI18n();
  const ar = lang === "ar";
  const { user, isAdmin, isOwner, can, loading } = useAuth();
  const qc = useQueryClient();
  const act = useServerFn(marketplaceAction);
  const canSeeAccounts = isOwner || can("sellers.review");
  const [tab, setTab] = useState<"listings" | "users">("listings");
  const [filter, setFilter] = useState<Status>("pending");
  const [kind, setKind] = useState<Kind>("all");
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
  const { data: accounts, error: accErr } = useQuery({
    queryKey: ["admin-accounts"],
    enabled: canSeeAccounts && tab === "users",
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_accounts");
      if (error) throw error;
      return data;
    },
  });

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase().replace(/^@/, "");
    return (accounts ?? []).filter((a) => {
      const seller = a.roles.includes("seller") || a.roles.includes("owner");
      if (kind === "sellers" && !seller) return false;
      if (kind === "members" && seller) return false;
      if (!needle) return true;
      return [a.username, a.display_name, a.email].some((v) => v?.toLowerCase().includes(needle));
    });
  }, [accounts, kind, q]);
  const selected = accounts?.find((a) => a.id === openId);

  if (loading) return null;
  if (!isAdmin) return <p className="py-20 text-center text-muted-foreground">403</p>;

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

  const pill = (active: boolean) => cn("rounded-full px-4 py-1.5 text-sm font-bold", active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground");
  const roleText = (roles: string[]) => roles.filter((r) => r !== "customer" || roles.length === 1).map((r) => ROLE_LABEL[r]?.[lang] ?? r).join("، ");
  const date = (d: string) => new Date(d).toLocaleDateString(ar ? "ar-EG" : "en-US");

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gold-gradient">{t("admin")}</h1>
      <div className="flex gap-2">
        <button className={pill(tab === "listings")} onClick={() => setTab("listings")}>{t("listingsTab")}</button>
        {canSeeAccounts && <button className={pill(tab === "users")} onClick={() => setTab("users")}>{ar ? "الحسابات" : "Accounts"}</button>}
      </div>

      {tab === "listings" && (
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

      {tab === "users" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {([["all", ar ? "الكل" : "All"], ["members", ar ? "الأعضاء" : "Members"], ["sellers", ar ? "التجار" : "Sellers"]] as const).map(([k, label]) => (
              <button key={k} className={pill(kind === k)} onClick={() => setKind(k)}>{label}</button>
            ))}
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
