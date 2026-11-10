export type Permission = { permission: string; scope_user_id: string | null };

export function accessFor(roles: string[], permissions: Permission[], banned = false) {
  const isOwner = roles.includes("owner");
  const isHeadModerator = roles.includes("head_moderator");
  const can = (permission: string, target?: string) =>
    !banned &&
    (isOwner ||
      (isHeadModerator && ["listings.review", "sellers.review"].includes(permission)) ||
      permissions.some(
        (p) =>
          p.permission === permission &&
          (p.scope_user_id === null || p.scope_user_id === target),
      ));

  const hasStaffPermission = permissions.some((p) =>
    ["listings.review", "sellers.review", "accounts.suspend"].includes(p.permission),
  );

  return {
    isOwner,
    canSell: !banned && (isOwner || roles.includes("seller")),
    can,
    isStaff: !banned && (isOwner || isHeadModerator || hasStaffPermission),
  };
}
