/** Public handle rules — mirrored by public.valid_username in the database (the real gate). */
export const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
export function normalizeUsername(raw: string) {
  return raw.trim().replace(/^@/, "").toLowerCase();
}
export function isValidUsername(u: string) {
  return USERNAME_RE.test(u) && !u.startsWith("_") && !u.endsWith("_");
}
export const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export function avatarFileError(file: { type: string; size: number }): "type" | "size" | null {
  if (!(AVATAR_TYPES as readonly string[]).includes(file.type)) return "type";
  if (file.size > AVATAR_MAX_BYTES) return "size";
  return null;
}
