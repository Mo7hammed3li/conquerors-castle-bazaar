export type AssistantListing = {
  id: string;
  castle_level: number;
  power: number;
  price: number;
  server: string;
};
export type AssistantTurn = { role: "user" | "model"; text: string };

export const DAILY_LIMIT = { member: 30, staff: 100 } as const;
export const BURST_LIMIT = 5; // messages per minute

/** Pulls an optional castle level / server hint from a free-text question. */
export function parseSearchHints(message: string) {
  const level = message.match(/(?:مستوى|level|lv)\s*(\d{1,2})/i);
  const server = message.match(/(?:سيرفر|server)\s*([\w\u0600-\u06FF-]{1,20})/i);
  return { level: level ? Number(level[1]) : undefined, server: server?.[1] };
}

export function buildSystemPrompt(opts: { isStaff: boolean; listings: AssistantListing[] }) {
  const data = opts.listings.length
    ? opts.listings
        .map(
          (l) =>
            `- id=${l.id} | مستوى ${l.castle_level} | قوة ${l.power} | سيرفر ${l.server} | سعر معروض $${l.price}`,
        )
        .join("\n")
    : "لا توجد بيانات إعلانات مطابقة متاحة لهذا السؤال.";
  return [
    "أنت مساعد Mo7hammed Store لسوق قلاع وحسابات لعبة الفاتحون. أجب بالعربية افتراضيًا وباختصار.",
    "ليست لديك أي أدوات ولا تستطيع تنفيذ أي إجراء أو تعديل بيانات أو عمليات إدارية؛ وجّه المستخدم للصفحة المناسبة بدلًا من ذلك.",
    "استخدم فقط بيانات الإعلانات أدناه عند الحديث عن إعلانات أو أسعار. لا تخترع إعلانات أو أسعارًا أو إحصاءات. الأسعار المعروضة أسعار طلب وليست أسعار بيع مؤكدة.",
    "عند ذكر إعلان اكتب رابطه بصيغة /listings/<id>.",
    opts.isStaff
      ? "المستخدم من فريق الإدارة: قدّم إرشادات تشغيلية عامة فقط دون تنفيذ أي شيء."
      : "المستخدم عضو: ساعده في فهم استخدام المتجر والبحث عن القلاع.",
    `بيانات الإعلانات المعتمدة المسموح بها:\n${data}`,
  ].join("\n\n");
}

/** In-memory per-isolate limiter. Not shared across server instances; resets on restart. */
export function createLimiter(now: () => number = Date.now) {
  const hits = new Map<string, number[]>();
  return (key: string, dailyLimit: number): "ok" | "burst" | "daily" => {
    const t = now();
    const list = (hits.get(key) ?? []).filter((x) => t - x < 86_400_000);
    if (list.length >= dailyLimit) {
      hits.set(key, list);
      return "daily";
    }
    if (list.filter((x) => t - x < 60_000).length >= BURST_LIMIT) {
      hits.set(key, list);
      return "burst";
    }
    list.push(t);
    hits.set(key, list);
    return "ok";
  };
}
