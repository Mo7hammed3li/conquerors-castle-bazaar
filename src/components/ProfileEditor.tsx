import { useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, Loader2, Trash2 } from "lucide-react";
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
  const [name, setName] = useState(profile?.display_name ?? "");
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState<"" | "name" | "user" | "img">("");
  const fileRef = useRef<HTMLInputElement>(null);
  if (!user) return null;

  const saveUsername = async () => {
    setBusy("user");
    try {
      const r = await checkUsername(username);
      if (r !== "ok") { toast.error(r === "taken" ? (ar ? "اسم المستخدم محجوز" : "Username taken") : (ar ? "3–20 حرفًا إنجليزيًا صغيرًا أو أرقام أو _" : "3–20 lowercase letters, digits or _")); return; }
      const { error } = await supabase.from("profiles").update({ username: normalizeUsername(username) }).eq("id", user.id);
      if (error) { toast.error(error.code === "23505" ? (ar ? "اسم المستخدم محجوز" : "Username taken") : (ar ? "تعذر الحفظ" : "Could not save")); return; }
      toast.success(ar ? "تم حفظ اسم المستخدم" : "Username saved");
      await refresh();
    } finally { setBusy(""); }
  };
  const saveName = async () => {
    setBusy("name");
    const { error } = await supabase.from("profiles").update({ display_name: name.trim() }).eq("id", user.id);
    setBusy("");
    if (error) toast.error(ar ? "الاسم بين 1 و40 حرفًا" : "Name must be 1–40 characters");
    else { toast.success(ar ? "تم الحفظ" : "Saved"); await refresh(); }
  };
  const pick = async (file: File | undefined) => {
    if (!file) return;
    const e = avatarFileError(file);
    if (e) { toast.error(e === "size" ? (ar ? "الحد الأقصى 2 ميجابايت" : "Max 2 MB") : (ar ? "JPG أو PNG أو WEBP فقط" : "JPG, PNG or WEBP only")); return; }
    const local = URL.createObjectURL(file);
    setPreview(local); setBusy("img");
    try { await replaceAvatar(user.id, file, profile?.avatar_path ?? null); toast.success(ar ? "تم تحديث الصورة" : "Photo updated"); await refresh(); }
    catch { toast.error(ar ? "فشل رفع الصورة؛ لم تتغير صورتك" : "Upload failed; your photo was not changed"); }
    finally { setBusy(""); setPreview(null); URL.revokeObjectURL(local); if (fileRef.current) fileRef.current.value = ""; }
  };
  const clear = async () => {
    setBusy("img");
    try { await removeAvatar(user.id, profile?.avatar_path ?? null); await refresh(); }
    catch { toast.error(ar ? "تعذر إزالة الصورة" : "Could not remove photo"); }
    finally { setBusy(""); }
  };

  return (
    <section className="space-y-5 rounded-2xl ornate-border bg-card-gradient p-6">
      <h2 className="text-xl font-bold">{ar ? "الملف الشخصي" : "Profile"}</h2>
      <div className="flex flex-wrap items-center gap-4">
        <UserAvatar path={profile?.avatar_path} src={preview} className="size-20" />
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
        <Button variant="ornate" size="sm" disabled={!!busy} onClick={() => fileRef.current?.click()}>
          {busy === "img" ? <Loader2 className="animate-spin" /> : <Camera />} {profile?.avatar_path ? (ar ? "تغيير الصورة" : "Change photo") : (ar ? "رفع صورة" : "Upload photo")}
        </Button>
        {profile?.avatar_path && <Button variant="ghost" size="sm" disabled={!!busy} onClick={clear}><Trash2 /> {ar ? "إزالة" : "Remove"}</Button>}
      </div>
      <div className="space-y-1.5">
        <Label>{ar ? "اسم المستخدم" : "Username"}</Label>
        {profile?.username ? (
          <p><Handle username={profile.username} className="text-base font-bold" /> <span className="text-xs text-muted-foreground">{ar ? "(ثابت)" : "(permanent)"}</span></p>
        ) : (
          <div className="flex gap-2">
            <Input dir="ltr" placeholder="username" value={username} maxLength={21} onChange={(e) => setUsername(e.target.value)} />
            <Button variant="gold" disabled={!!busy || !username} onClick={saveUsername}>{busy === "user" && <Loader2 className="animate-spin" />}{ar ? "حفظ" : "Save"}</Button>
          </div>
        )}
      </div>
      <div className="space-y-1.5">
        <Label>{ar ? "الاسم الظاهر" : "Display name"}</Label>
        <div className="flex gap-2">
          <Input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
          <Button variant="ornate" disabled={!!busy || !name.trim() || name === profile?.display_name} onClick={saveName}>{ar ? "حفظ" : "Save"}</Button>
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
