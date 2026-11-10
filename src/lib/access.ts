export type Permission = { permission: string; scope_user_id: string | null };
export function accessFor(roles: string[], permissions: Permission[], banned = false) {
  const isOwner = roles.includes("owner");
  const can = (permission: string, target?: string) => !banned && (isOwner || (roles.includes("head_moderator") && ["listings.review", "sellers.review"].includes(permission)) || permissions.some(p => p.permission === permission && (p.scope_user_id === null || p.scope_user_id === target)));
  return { isOwner, canSell: !banned && (isOwner || roles.includes("seller")), can, isStaff: !banned && (isOwner || roles.includes("head_moderator") || permissions.length > 0) };
}