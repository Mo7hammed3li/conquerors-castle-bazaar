import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ListingForm } from "@/components/ListingForm";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { emptyForm } from "@/lib/listing-form";
import { saveListing } from "@/lib/listings";

export const Route = createFileRoute("/_authenticated/new")({
  head: () => ({
    meta: [
      { title: "أضف قلعتك — Mo7hammed Store" },
      { name: "description", content: "انشر إعلان قلعتك في لعبة الفاتحون." },
      { property: "og:title", content: "أضف قلعتك — Mo7hammed Store" },
      { property: "og:description", content: "انشر إعلان قلعتك في لعبة الفاتحون." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NewListing,
});

function NewListing() {
  const { t } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="text-3xl font-bold text-gold-gradient">{t("addListing")}</h1>
      <ListingForm
        initial={emptyForm()}
        userId={user.id}
        submitLabel={t("publish")}
        onSubmit={async (v) => {
          const id = await saveListing(user.id, v);
          toast.success(t("saved"));
          navigate({ to: "/listings/$id", params: { id } });
        }}
      />
    </div>
  );
}
