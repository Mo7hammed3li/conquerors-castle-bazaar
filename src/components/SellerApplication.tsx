import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { marketplaceAction } from "@/lib/marketplace.functions";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export function SellerApplication() {
  const { user, loading } = useAuth();
  const { lang } = useI18n();
  const qc = useQueryClient();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const ar = lang === "ar";
  const { data: applications, isLoading } = useQuery({
    queryKey: ["my-seller-applications", user?.id],
    enabled: !!user && !loading,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("seller_applications")
        .select("id,status,message,reason,created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const pending = applications?.some((application) => application.status === "pending");

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = message.trim();
    if (trimmed.length < 1 || trimmed.length > 2000) {
      toast.error(ar ? "اكتب نبذة من 1 إلى 2000 حرف" : "Enter 1–2000 characters");
      return;
    }
    setBusy(true);
    try {
      await marketplaceAction({
        data: { action: "apply_seller", payload: { message: trimmed }, reason: "" },
      });
      setMessage("");
      await qc.invalidateQueries({ queryKey: ["my-seller-applications", user?.id] });
      toast.success(ar ? "تم إرسال طلب التاجر للمراجعة" : "Seller application submitted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : (ar ? "تعذر إرسال الطلب" : "Could not submit application"));
    } finally {
      setBusy(false);
    }
  };

  if (loading || isLoading) return <div className="mx-auto max-w-2xl py-16 text-center text-muted-foreground">{ar ? "جارٍ التحميل…" : "Loading…"}</div>;

  return (
    <section className="mx-auto max-w-2xl space-y-6 rounded-2xl ornate-border bg-card-gradient p-6 shadow-card">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-gold-gradient">{ar ? "طلب تفعيل حساب تاجر" : "Apply to become a seller"}</h1>
        <p className="text-sm leading-7 text-muted-foreground">
          {ar ? "التسجيل يبدأ كمشتري. اشرح لنا خبرتك وطريقة عرضك للقلاع، وسيُراجع الطلب قبل تفعيل صلاحية البيع." : "Every account starts as a buyer. Tell us about your trading experience and how you plan to list castles. Your application will be reviewed before selling is enabled."}
        </p>
      </div>

      {applications?.map((application) => (
        <div key={application.id} className="rounded-xl border border-border bg-background/60 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <strong>{ar ? "طلب تاجر" : "Seller application"}</strong>
            <span className="text-sm font-semibold">
              {application.status === "pending" ? (ar ? "قيد المراجعة" : "Pending")
                : application.status === "approved" ? (ar ? "تمت الموافقة" : "Approved")
                : (ar ? "مرفوض" : "Rejected")}
            </span>
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{application.message}</p>
          {application.reason && <p className="mt-2 text-sm text-destructive">{ar ? "ملاحظة الإدارة: " : "Moderator note: "}{application.reason}</p>}
        </div>
      ))}

      {pending ? (
        <p className="rounded-lg bg-muted p-4 text-sm">{ar ? "لديك طلب قيد المراجعة بالفعل. يمكنك إرسال طلب جديد بعد انتهاء المراجعة." : "You already have an application under review. You can apply again after it is reviewed."}</p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <label className="block space-y-2">
            <span className="text-sm font-semibold">{ar ? "عرّفنا بنفسك وخبرتك في البيع" : "Tell us about yourself and your trading experience"}</span>
            <Textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={5} maxLength={2000} required placeholder={ar ? "اكتب نبذة مختصرة…" : "Write a short introduction…"} />
            <span className="block text-end text-xs text-muted-foreground">{message.length}/2000</span>
          </label>
          <Button type="submit" variant="gold" className="w-full" disabled={busy || !message.trim()}>
            {busy ? (ar ? "جارٍ الإرسال…" : "Submitting…") : (ar ? "إرسال طلب التاجر" : "Submit application")}
          </Button>
        </form>
      )}
    </section>
  );
}
