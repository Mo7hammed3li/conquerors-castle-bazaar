import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const marketplaceAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    action: z.enum(["apply_seller", "review_seller", "set_role", "set_permission", "suspend", "moderate_listing", "archive_listing"]),
    target: z.string().uuid().optional(),
    payload: z.record(z.union([z.string(), z.boolean(), z.null()])).default({}),
    reason: z.string().max(2000).default(""),
  }))
  .handler(async ({ data, context }) => {
    const { data: result, error } = await context.supabase.rpc("marketplace_action", {
      _action: data.action,
      ...(data.target ? { _target: data.target } : {}),
      _payload: data.payload,
      _reason: data.reason,
    });
    if (error) throw new Error("تعذر تنفيذ الطلب؛ تحقق من الصلاحيات والبيانات. / Request denied or invalid.");
    return result;
  });
