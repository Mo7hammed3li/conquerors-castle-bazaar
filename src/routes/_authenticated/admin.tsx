import { createFileRoute, Link } from "@tanstack/react-router";
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

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "لوحة الإدارة — Mo7hammed Store" },
      { name: "description", content: "مراجعة الإعلانات وإدارة المستخدمين." },
      { property: "og:title", content: "لوحة الإدارة — Mo7hammed Store" },
      { property: "og:description", content: "مراجعة الإعلانات وإدارة المستخدمين." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Admin,
});

type Status = "pending" | "approved" | "rejected";

function Admin() {
  const { t, lang } = useI18n();
  const { user, isAdmin, loading } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"listings" | "users">("listings");
  const [filter, setFilter] = useState<Status>("pending");

  const { data: listings } = useQuery({
    queryKey: ["admin-listings", filter],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listings")
        .select("*")
        .eq("status", filter)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const { data: users } = useQuery({
    queryKey: ["admin-users"],
    enabled: isAdmin && tab === "users",
    queryFn: async () => {
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role").eq("role", "admin"),
      ]);
      const admins = new Set(roles?.map((r) => r.user_id));
      return (profiles ?? []).map((p) => ({ ...p, admin: admins.has(p.id) }));
    },
  });

  if (loading) return null;
  if (!isAdmin) return <p className="py-20 text-center text-muted-foreground">403</p>;

  const setStatus = async (id: string, status: Status) => {
    const reason = status === "rejected" ? prompt(lang === "ar" ? "سبب الرفض (اختياري)" : "Reason (optional)") : null;
    const { error } = await supabase.from("listings").update({ status, rejection_reason: reason || null }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["admin-listings"] });
  };
  const del = async (id: string) => {
    if (!confirm(t("delete") + "?")) return;
    const { error } = await supabase.from("listings").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["admin-listings"] });
  };
  const setBan = async (id: string, is_banned: boolean) => {
    const { error } = await supabase.from("profiles").update({ is_banned }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["admin-users"] });
  };
  const setAdmin = async (id: string, make: boolean) => {
    const { error } = make
      ? await supabase.from("user_roles").insert({ user_id: id, role: "admin" })
      : await supabase.from("user_roles").delete().eq("user_id", id).eq("role", "admin");
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["admin-users"] });
  };

  const tabBtn = (active: boolean) =>
    cn("rounded-full px-4 py-1.5 text-sm font-bold", active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground");

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gold-gradient">{t("admin")}</h1>
      <div className="flex gap-2">
        <button className={tabBtn(tab === "listings")} onClick={() => setTab("listings")}>{t("listingsTab")}</button>
        <button className={tabBtn(tab === "users")} onClick={() => setTab("users")}>{t("users")}</button>
      </div>

      {tab === "listings" && (
        <>
          <div className="flex gap-2">
            {(["pending", "approved", "rejected"] as const).map((s) => (
              <button key={s} className={tabBtn(filter === s)} onClick={() => setFilter(s)}>{t(s)}</button>
            ))}
          </div>
          {listings?.length === 0 && <p className="text-muted-foreground">{t("empty")}</p>}
          <div className="space-y-3">
            {listings?.map((l) => (
              <div key={l.id} className="flex flex-wrap items-center gap-3 rounded-xl ornate-border bg-card-gradient p-4">
                <Link to="/listings/$id" params={{ id: l.id }} className="min-w-0 flex-1">
                  <div className="font-bold">
                    {t("level")} {l.castle_level} · {t("server")} {l.server} · ${formatNum(l.price, lang)}
                  </div>
                  <div className="truncate text-sm text-muted-foreground">{l.description || "—"}</div>
                </Link>
                <StatusBadge status={l.status} />
                {l.status !== "approved" && <Button size="sm" variant="gold" onClick={() => setStatus(l.id, "approved")}>{t("approve")}</Button>}
                {l.status !== "rejected" && <Button size="sm" variant="ornate" onClick={() => setStatus(l.id, "rejected")}>{t("reject")}</Button>}
                <Button size="sm" variant="destructive" onClick={() => del(l.id)}>{t("delete")}</Button>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === "users" && (
        <div className="space-y-3">
          {users?.map((u) => (
            <div key={u.id} className="flex flex-wrap items-center gap-3 rounded-xl ornate-border bg-card-gradient p-4">
              <div className="min-w-0 flex-1">
                <div className="font-bold">{u.display_name || "—"} {u.admin && <span className="text-xs text-primary">(admin)</span>}</div>
                <div className="truncate text-xs text-muted-foreground" dir="ltr">{u.id}</div>
              </div>
              {u.is_banned && <span className="text-xs font-bold text-destructive">{t("ban")}</span>}
              {u.id !== user?.id && (
                <>
                  <Button size="sm" variant={u.is_banned ? "ornate" : "destructive"} onClick={() => setBan(u.id, !u.is_banned)}>
                    {u.is_banned ? t("unban") : t("ban")}
                  </Button>
                  <Button size="sm" variant="ornate" onClick={() => setAdmin(u.id, !u.admin)}>
                    {u.admin ? t("removeAdmin") : t("makeAdmin")}
                  </Button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
