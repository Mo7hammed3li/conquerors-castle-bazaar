import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

export function StatusBadge({ status }: { status: "pending" | "approved" | "rejected" }) {
  const { t } = useI18n();
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-0.5 text-xs font-bold",
        status === "approved" && "bg-success/15 text-success",
        status === "pending" && "bg-warning/15 text-warning",
        status === "rejected" && "bg-destructive/15 text-destructive",
      )}
    >
      {t(status)}
    </span>
  );
}
