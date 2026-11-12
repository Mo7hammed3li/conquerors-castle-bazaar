import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { avatarFileError, isValidUsername, normalizeUsername } from "./username";

export const AVATAR_BUCKET = "avatars";
export type PublicProfile = { id: string; username: string | null; display_name: string | null; avatar_path: string | null; is_seller: boolean };

export function useAvatarUrl(path: string | null | undefined) {
  return useQuery({
    queryKey: ["avatar", path],
    enabled: !!path,
    staleTime: 30 * 60 * 1000,
    queryFn: async () => (await supabase.storage.from(AVATAR_BUCKET).createSignedUrl(path!, 3600)).data?.signedUrl ?? null,
  });
}

export function usePublicProfile(id: string | undefined) {
  return useQuery({
    queryKey: ["public-profile", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("public_profiles", { _ids: [id!] });
      if (error) throw error;
      return (data?.[0] ?? null) as PublicProfile | null;
    },
  });
}

export async function checkUsername(raw: string): Promise<"invalid" | "taken" | "ok"> {
  const u = normalizeUsername(raw);
  if (!isValidUsername(u)) return "invalid";
  const { data, error } = await supabase.rpc("username_available", { _u: u });
  if (error) throw error;
  return data ? "ok" : "taken";
}

/** Upload new avatar, point profile at it, then remove the old file. Old file is kept if anything fails. */
export async function replaceAvatar(userId: string, file: File, oldPath: string | null) {
  const err = avatarFileError(file);
  if (err) throw new Error(err);
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${userId}/${Date.now()}.${ext}`;
  const up = await supabase.storage.from(AVATAR_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  if (up.error) throw up.error;
  const { error } = await supabase.from("profiles").update({ avatar_path: path }).eq("id", userId);
  if (error) {
    await supabase.storage.from(AVATAR_BUCKET).remove([path]);
    throw error;
  }
  if (oldPath) await supabase.storage.from(AVATAR_BUCKET).remove([oldPath]);
  return path;
}

export async function removeAvatar(userId: string, oldPath: string | null) {
  const { error } = await supabase.from("profiles").update({ avatar_path: null }).eq("id", userId);
  if (error) throw error;
  if (oldPath) await supabase.storage.from(AVATAR_BUCKET).remove([oldPath]);
}
