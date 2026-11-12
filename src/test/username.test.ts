import { describe, expect, it } from "vitest";
import { avatarFileError, isValidUsername, normalizeUsername } from "@/lib/username";

describe("username rules", () => {
  it("normalizes case and leading @ so uniqueness is case-insensitive", () => {
    expect(normalizeUsername("  @Mo7ammed_X ")).toBe("mo7ammed_x");
  });
  it("accepts 3-20 lowercase letters, digits, underscore", () => {
    expect(isValidUsername("abc")).toBe(true);
    expect(isValidUsername("a".repeat(20))).toBe(true);
  });
  it("rejects too short, too long, symbols, spaces, arabic and edge underscores", () => {
    for (const u of ["ab", "a".repeat(21), "bad-name", "has space", "محمد", "_lead", "trail_"]) expect(isValidUsername(u)).toBe(false);
  });
});

describe("avatar files", () => {
  it("allows jpg/png/webp up to 2MB only", () => {
    expect(avatarFileError({ type: "image/png", size: 2 * 1024 * 1024 })).toBeNull();
    expect(avatarFileError({ type: "image/png", size: 2 * 1024 * 1024 + 1 })).toBe("size");
    expect(avatarFileError({ type: "image/gif", size: 10 })).toBe("type");
  });
});
