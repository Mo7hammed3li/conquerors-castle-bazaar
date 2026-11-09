import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "تعيين كلمة مرور جديدة — Mo7hammed Store" },
      { name: "description", content: "عيّن كلمة مرور جديدة لحسابك." },
      { property: "og:title", content: "تعيين كلمة مرور جديدة — Mo7hammed Store" },
      { property: "og:description", content: "عيّن كلمة مرور جديدة لحسابك." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Reset,
});

function Reset() {
  const [pw, setPw] = useState("");
  const navigate = useNavigate();
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) { toast.error(error.message); return; }
    toast.success("تم تحديث كلمة المرور");
    navigate({ to: "/account" });
  };
  return (
    <form onSubmit={submit} className="mx-auto max-w-md space-y-4 rounded-2xl ornate-border bg-card-gradient p-6 py-10">
      <h1 className="text-2xl font-bold">كلمة مرور جديدة</h1>
      <Label htmlFor="pw">كلمة المرور</Label>
      <Input id="pw" type="password" dir="ltr" minLength={6} required value={pw} onChange={(e) => setPw(e.target.value)} />
      <Button type="submit" variant="gold" className="w-full">حفظ</Button>
    </form>
  );
}
