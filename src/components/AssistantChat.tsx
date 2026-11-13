import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Bot, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { askAssistant } from "@/lib/assistant.functions";
import type { AssistantTurn } from "@/lib/assistant-prompt";

const errors: Record<string, string> = {
  not_configured: "المساعد غير مُفعّل بعد: لم يُضف مفتاح GEMINI_API_KEY على السيرفر.",
  forbidden: "لا يمكن استخدام المساعد من هذا الحساب.",
  burst: "رسائل كثيرة خلال دقيقة، انتظر قليلًا.",
  daily: "وصلت إلى الحد اليومي للمساعد.",
  provider_quota: "انتهت الحصة المجانية لخدمة Gemini مؤقتًا.",
  provider: "تعذر الحصول على رد الآن، حاول لاحقًا.",
};

function renderText(text: string) {
  return text.split(/(\/listings\/[0-9a-f-]{36})/g).map((part, i) => {
    const m = part.match(/^\/listings\/([0-9a-f-]{36})$/);
    return m ? (
      <Link key={i} to="/listings/$id" params={{ id: m[1]! }} className="text-primary underline">
        عرض الإعلان
      </Link>
    ) : (
      <span key={i}>{part}</span>
    );
  });
}

export function AssistantChat() {
  const { user, isAdmin } = useAuth();
  const ask = useServerFn(askAssistant);
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<AssistantTurn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const suggestions = isAdmin
    ? ["كيف أراجع إعلانًا معلقًا؟", "ما خطوات طلب البائع؟"]
    : ["كيف أضيف قلعتي؟", "ابحث عن قلعة مستوى 25"];

  const send = async (text: string) => {
    if (!text.trim() || busy) return;
    const history = msgs.slice(-10);
    setMsgs([...msgs, { role: "user", text }]);
    setInput("");
    setErr(null);
    setBusy(true);
    try {
      const r = await ask({ data: { message: text, history } });
      if (r.ok) setMsgs((m) => [...m, { role: "model", text: r.text }]);
      else setErr(errors[r.error] ?? errors["provider"]!);
    } catch {
      setErr(errors["provider"]!);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button
        variant="gold"
        size="icon"
        className="fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] end-5 z-[60] size-14 rounded-full shadow-lg"
        onClick={() => setOpen(!open)}
        aria-label="مساعد Mo7hammed AI"
      >
        {open ? <X /> : <Bot className="!size-6" />}
      </Button>
      {open && (
        <div
          dir="rtl"
          className="fixed inset-x-3 bottom-[calc(6rem+env(safe-area-inset-bottom))] z-[60] flex max-h-[70vh] flex-col rounded-2xl ornate-border bg-card shadow-xl sm:inset-x-auto sm:end-5 sm:w-96"
        >
          <div className="border-b border-border/60 p-3">
            <p className="font-bold text-gold-gradient">
              Mo7hammed AI <span className="text-xs text-muted-foreground">(ذكاء اصطناعي)</span>
            </p>
            <p className="text-xs text-muted-foreground">
              الردود مساعدة فقط وقد تخطئ. لا تعتمد عليها في الأسعار أو البيانات إلا ما يعرضه التطبيق
              من الإعلانات المعتمدة. المساعد لا ينفذ أي إجراء.
            </p>
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto p-3 text-sm">
            {!user ? (
              <p className="text-muted-foreground">
                سجّل الدخول لاستخدام المساعد.{" "}
                <Link to="/auth" className="text-primary underline">
                  تسجيل الدخول
                </Link>
              </p>
            ) : msgs.length === 0 ? (
              <div className="flex flex-wrap gap-2">
                {suggestions.map((s) => (
                  <Button key={s} variant="outline" size="sm" onClick={() => send(s)}>
                    {s}
                  </Button>
                ))}
              </div>
            ) : (
              msgs.map((m, i) => (
                <div
                  key={i}
                  className={`whitespace-pre-wrap rounded-xl p-2 ${m.role === "user" ? "ms-8 bg-primary/15" : "me-8 bg-muted"}`}
                >
                  {m.role === "model" ? renderText(m.text) : m.text}
                </div>
              ))
            )}
            {busy && <p className="text-muted-foreground">يكتب…</p>}
            {err && <p className="text-destructive">{err}</p>}
          </div>
          {user && (
            <form
              className="flex gap-2 border-t border-border/60 p-3"
              onSubmit={(e) => {
                e.preventDefault();
                void send(input);
              }}
            >
              <Input
                value={input}
                maxLength={1000}
                onChange={(e) => setInput(e.target.value)}
                placeholder="اكتب سؤالك…"
              />
              <Button type="submit" variant="gold" size="icon" disabled={busy} aria-label="إرسال">
                <Send />
              </Button>
            </form>
          )}
        </div>
      )}
    </>
  );
}
