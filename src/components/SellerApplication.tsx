import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { marketplaceAction } from "@/lib/marketplace.functions";

export function SellerApplication() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const { user } = useAuth();
  const [status, setStatus] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("seller_applications").select("status").eq("user_id", user.id)
      .order("created_at", { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => setStatus(data?.status ?? null));
  }, [user]);

  const apply = async () => {
    setBusy(true);
    try {
      await marketplaceAction({ data: { action: "apply_seller", payload: { message }, reason: message } });
      setStatus("pending");
      toast.success(ar ? "تم إرسال الطلب" : "Request sent");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg space-y-4 rounded-2xl ornate-border bg-card-gradient p-6">
      <h1 className="text-2xl font-bold text-gold-gradient">{ar ? "طلب صلاحية بائع" : "Seller access request"}</h1>
      <p className="text-sm text-muted-foreground">
        {ar ? "حسابك حاليًا حساب عميل. لنشر الإعلانات، أرسل طلبًا ليراجعه المالك أو المشرف." : "Your account is a customer account. Send a request to be reviewed before publishing."}
      </p>
      {status === "pending" ? (
        <p className="font-medium">{ar ? "طلبك قيد المراجعة." : "Your request is under review."}</p>
      ) : (
        <>
          {status === "rejected" && <p className="text-sm text-destructive">{ar ? "رُفض طلبك السابق، يمكنك إعادة التقديم." : "Your previous request was rejected; you may reapply."}</p>}
          <Textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={1000} placeholder={ar ? "نبذة قصيرة (اختياري)" : "Short note (optional)"} />
          <Button variant="gold" onClick={apply} disabled={busy}>{ar ? "إرسال الطلب" : "Send request"}</Button>
        </>
      )}
    </div>
  );
}
