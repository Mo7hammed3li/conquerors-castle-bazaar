import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildSystemPrompt, createLimiter, DAILY_LIMIT, parseSearchHints } from "./assistant-prompt";

const limiter = createLimiter();

export const askAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    message: z.string().trim().min(1).max(1000),
    history: z.array(z.object({ role: z.enum(["user", "model"]), text: z.string().max(4000) })).max(10).default([]),
  }))
  .handler(async ({ data, context }) => {
    const apiKey = process.env["GEMINI_API_KEY"];
    if (!apiKey) return { ok: false as const, error: "not_configured" };
    const { supabase, userId } = context;
    const [profile, roles, perms] = await Promise.all([
      supabase.from("profiles").select("is_banned").eq("id", userId).maybeSingle(),
      supabase.from("account_roles").select("role").eq("user_id", userId),
      supabase.from("account_permissions").select("permission").eq("user_id", userId),
    ]);
    if (profile.error || !profile.data || profile.data.is_banned) return { ok: false as const, error: "forbidden" };
    const roleNames = (roles.data ?? []).map((r) => r.role as string);
    const isStaff = roleNames.some((r) => ["owner", "head_moderator", "moderator"].includes(r)) || (perms.data?.length ?? 0) > 0;
    const verdict = limiter(userId, isStaff ? DAILY_LIMIT.staff : DAILY_LIMIT.member);
    if (verdict !== "ok") return { ok: false as const, error: verdict === "burst" ? "burst" : "daily" };

    const hints = parseSearchHints(data.message);
    let q = supabase.from("listings").select("id,castle_level,power,price,server").eq("status", "approved").order("created_at", { ascending: false }).limit(10);
    if (hints.level) q = q.eq("castle_level", hints.level);
    if (hints.server) q = q.ilike("server", `%${hints.server.replace(/[%_]/g, "")}%`);
    const { data: listings } = await q;

    const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent", {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: buildSystemPrompt({ isStaff, listings: listings ?? [] }) }] },
        contents: [...data.history, { role: "user", text: data.message }].map((t) => ({ role: t.role, parts: [{ text: t.text }] })),
        generationConfig: { maxOutputTokens: 800, temperature: 0.4 },
      }),
    });
    if (!res.ok) { console.error("Gemini error", res.status); return { ok: false as const, error: res.status === 429 ? "provider_quota" : "provider" }; }
    const json = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim();
    if (!text) return { ok: false as const, error: "provider" };
    return { ok: true as const, text, grounded: (listings?.length ?? 0) > 0 };
  });
