import { describe, expect, it } from "vitest";
import { accessFor } from "@/lib/access";

describe("account access", () => {
  it("gives the owner platform-wide access and seller capability", () => {
    const access = accessFor(["owner"], []);
    expect(access.isOwner).toBe(true);
    expect(access.canSell).toBe(true);
    expect(access.isStaff).toBe(true);
    expect(access.can("listings.review")).toBe(true);
    expect(access.can("accounts.suspend", "another-user")).toBe(true);
  });

  it("limits head moderators to listing and seller review", () => {
    const access = accessFor(["head_moderator"], []);
    expect(access.can("listings.review")).toBe(true);
    expect(access.can("sellers.review")).toBe(true);
    expect(access.can("accounts.suspend", "another-user")).toBe(false);
    expect(access.can("listings.edit", "another-user")).toBe(false);
    expect(access.canSell).toBe(false);
    expect(access.isStaff).toBe(true);
  });

  it("enforces user-scoped permissions", () => {
    const access = accessFor(
      ["seller"],
      [{ permission: "listings.edit", scope_user_id: "seller-123" }],
    );
    expect(access.can("listings.edit", "seller-123")).toBe(true);
    expect(access.can("listings.edit", "seller-456")).toBe(false);
    expect(access.can("listings.edit")).toBe(false);
    expect(access.canSell).toBe(true);
    expect(access.isStaff).toBe(false);
  });

  it("treats a null scope as an unscoped permission", () => {
    const access = accessFor(
      [],
      [{ permission: "accounts.suspend", scope_user_id: null }],
    );
    expect(access.can("accounts.suspend", "user-a")).toBe(true);
    expect(access.can("accounts.suspend", "user-b")).toBe(true);
    expect(access.isStaff).toBe(true);
  });

  it("fails closed for banned accounts, including owner and seller roles", () => {
    const access = accessFor(
      ["owner", "seller", "head_moderator"],
      [{ permission: "accounts.suspend", scope_user_id: null }],
      true,
    );
    expect(access.isOwner).toBe(true);
    expect(access.canSell).toBe(false);
    expect(access.isStaff).toBe(false);
    expect(access.can("listings.review")).toBe(false);
    expect(access.can("accounts.suspend", "user-a")).toBe(false);
  });

  it("does not classify listing-edit-only accounts as staff", () => {
    const access = accessFor(
      [],
      [{ permission: "listings.edit", scope_user_id: "seller-123" }],
    );
    expect(access.can("listings.edit", "seller-123")).toBe(true);
    expect(access.isStaff).toBe(false);
  });
});
