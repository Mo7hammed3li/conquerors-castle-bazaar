import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Store, ShieldCheck } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/sellers/")({
  head: () => ({
    meta: [
      { title: "التجار المعتمدون — Mo7hammed Store" },
      { name: "description", content: "تصفح ملفات التجار المعتمدين وإعلاناتهم." },
    ],
  }),
  component: SellersDirectory,
});

function SellersDirectory() {
  const { lang } = useI18n();
  const { data: sellers, isLoading, isError } = useQuery({
    queryKey: ["seller-directory"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("seller_directory")
        .select("seller_id, display_name, created_at, approved_listings")
        .order("approved_listings", { ascending: false })
        .order("display_name", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-6">
      <div className="rounded-2xl ornate-border bg-card-gradient p-6">
        <div className="flex items-center gap-3">
          <Store className="size-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">{lang === "ar" ? "التجار المعتمدون" : "Verified sellers"}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{lang === "ar" ? "حسابات التجار المعتمدين وإعلاناتهم المنشورة فقط" : "Approved seller accounts and their published listings only"}</p>
          </div>
        </div>
      </div>

      {isLoading && <p className="py-12 text-center text-muted-foreground">…</p>}
      {isError && <p className="py-12 text-center text-destructive">{lang === "ar" ? "تعذر تحميل قائمة التجار." : "Could not load sellers."}</p>}
      {!isLoading && !isError && sellers?.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <Store className="mx-auto mb-3 size-9 text-muted-foreground" />
          <h2 className="font-bold">{lang === "ar" ? "لسه مفيش تجار معتمدين" : "No approved sellers yet"}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{lang === "ar" ? "هيظهر التاجر هنا بعد موافقة الإدارة على طلبه." : "Sellers will appear here after admin approval."}</p>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sellers?.map((seller) => (
          <Link
            key={seller.seller_id}
            to="/sellers/$id"
            params={{ id: seller.seller_id }}
            className="group rounded-2xl ornate-border bg-card-gradient p-5 transition hover:border-primary/70 hover:shadow-gold"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Store className="size-6" />
              </div>
              <ShieldCheck className="size-5 text-success" />
            </div>
            <h2 className="mt-4 text-lg font-bold group-hover:text-primary">{seller.display_name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {seller.approved_listings} {lang === "ar" ? "إعلان معتمد" : "approved listings"}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {lang === "ar" ? "عضو منذ " : "Member since "}
              {new Date(seller.created_at).toLocaleDateString(lang === "ar" ? "ar-EG" : "en-US")}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
