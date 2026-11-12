import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, Loader2, Trash2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserAvatar, Handle } from "@/components/UserAvatar";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { checkUsername, removeAvatar, replaceAvatar } from "@/lib/profiles";
import { avatarFileError, normalizeUsername } from "@/lib/username";
import { supabase } from "@/integrations/supabase/client";

export function ProfileEditor() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const { user, profile, refresh } = useAuth();
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState<"" | "name" | "user" | "img">("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setName(profile?.display_name ?? "");
  }, [profile?.display_name]);

  if (!user) return null;

  const saveUsername = async () => {
    setBusy("user");
    try {
      const r = await checkUsername(username);
      if (r !== "ok") {
        toast.error(r === "taken" ? (ar ? "اسم المستخدم محجوز" : "Username taken") : (ar ? "استخدم 3–20 حرفًا إنجليزيًا صغيرًا أو أرقامًا أو _" : "Use 3–20 lowercase letters, digits or _"));
        return;
      }
      const { error } = await supabase.from("profiles").update({ username: normalizeUsername(username) }).eq("id", user.id);
      if (error) {
        toast.error(error.code === "23505" ? (ar ? "اسم المستخدم محجوز" : "Username taken") : (ar ? "تعذر حفظ اسم المستخدم" : "Could not save username"));
        return;
      }
      toast.success(ar ? "تم حفظ اسم المستخدم" : "Username saved");
      setUsername("");
      await refresh();
    } catch (error) {
      console.error("save username failed", error);
      toast.error(ar ? "حدث خطأ أثناء التحقق من اسم المستخدم" : "Could not validate username");
    } finally {
      setBusy("");
    }
  };

  const saveName = async () => {
    const trimmed = name.trim();
    if (trimmed.length < 1 || trimmed.length > 40) {
      toast.error(ar ? "الاسم يجب أن يكون من 1 إلى 40 حرفًا" : "Name must be 1–40 characters");
      return;
    }
    setBusy("name");
    try {
      const { error } = await supabase.from("profiles").update({ display_name: trimmed }).eq("id", user.id);
      if (error) throw error;
      toast.success(ar ? "تم حفظ الاسم" : "Name saved");
      await refresh();
    } catch (error) {
      console.error("save display name failed", error);
      toast.error(ar ? "تعذر حفظ الاسم، حاول مرة أخرى" : "Could not save name. Try again.");
    } finally {
      setBusy("");
    }
  };

  const pick = async (file: File | undefined) => {
    if (!file) return;
    const e = avatarFileError(file);
    if (e) {
      toast.error(e === "size" ? (ar ? "الحد الأقصى 2 ميجابايت" : "Max 2 MB") : (ar ? "JPG أو PNG أو WEBP فقط" : "JPG, PNG or WEBP only"));
      return;
    }
    const local = URL.createObjectURL(file);
    setPreview(local);
    setBusy("img");
    try {
      await replaceAvatar(user.id, file, profile?.avatar_path ?? null);
      toast.success(ar ? "تم تحديث الصورة" : "Photo updated");
      await refresh();
    } catch (error) {
      console.error("avatar upload failed", error);
      toast.error(ar ? "فشل رفع الصورة؛ لم تتغير صورتك" : "Upload failed; your photo was not changed");
    } finally {
      setBusy("");
      setPreview(null);
      URL.revokeObjectURL(local);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const clear = async () => {
    setBusy("img");
    try {
      await removeAvatar(user.id, profile?.avatar_path ?? null);
      toast.success(ar ? "تمت إزالة الصورة" : "Photo removed");
      await refresh();
    } catch (error) {
      console.error("avatar removal failed", error);
      toast.error(ar ? "تعذر إزالة الصورة" : "Could not remove photo");
    } finally {
      setBusy("");
    }
  };

  return (
    <section className="space-y-5 rounded-2xl ornate-border bg-card-gradient p-6">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="text-primary" />
        <h2 className="text-xl font-bold">{ar ? "بيانات الملف الشخصي" : "Profile details"}</h2>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <UserAvatar path={profile?.avatar_path} src={preview} className="size-20" />
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
        <Button variant="ornate" size="sm" disabled={!!busy} onClick={() => fileRef.current?.click()}>
          {busy === "img" ? <Loader2 className="animate-spin" /> : <Camera />}
          {profile?.avatar_path ? (ar ? "تغيير الصورة" : "Change photo") : (ar ? "رفع صورة شخصية" : "Upload avatar")}
        </Button>
        {profile?.avatar_path && <Button variant="ghost" size="sm" disabled={!!busy} onClick={clear}><Trash2 /> {ar ? "إزالة الصورة" : "Remove photo"}</Button>}
      </div>
      <div className="space-y-2">
        <Label>{ar ? "اسم المستخدم العام" : "Public username"}</Label>
        {profile?.username ? (
          <div className="flex flex-wrap items-center gap-2">
            <Handle username={profile.username} className="text-base font-bold" />
            <span className="text-xs text-muted-foreground">{ar ? "اسم ثابت لا يمكن تغييره بعد اختياره" : "Permanent after selection"}</span>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input dir="ltr" autoComplete="off" placeholder="username_123" value={username} maxLength={20} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))} />
              <Button variant="gold" disabled={!!busy || username.length < 3} onClick={saveUsername}>
                {busy === "user" && <Loader2 className="animate-spin" />}
                {ar ? "تأكيد اسم المستخدم" : "Save username"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">{ar ? "من 3 إلى 20 حرفًا: حروف إنجليزية صغيرة أو أرقام أو _ فقط. لا يمكن تغييره لاحقًا." : "3–20 lowercase letters, numbers or underscores. This cannot be changed later."}</p>
          </>
        )}
      </div>
      <div className="space-y-2">
        <Label>{ar ? "الاسم الظاهر" : "Display name"}</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder={ar ? "الاسم الذي سيظهر للآخرين" : "Name shown to others"} />
          <Button variant="ornate" disabled={!!busy || !name.trim() || name.trim() === (profile?.display_name ?? "")} onClick={saveName}>
            {busy === "name" && <Loader2 className="animate-spin" />}
            {ar ? "حفظ الاسم" : "Save name"}
          </Button>
        </div>
      </div>
    </section>
  );
}

export function UsernameReminder() {
  const { user, profile, loading } = useAuth();
  const { lang } = useI18n();
  if (loading || !user || !profile || profile.username) return null;
  return (
    <a href="/account" className="block bg-primary/15 px-4 py-2 text-center text-sm text-primary">
      {lang === "ar" ? "أكمل حسابك: اختر اسم مستخدم عام من صفحة حسابي" : "Finish your account: choose a public username in My account"}
    </a>
  );
}
