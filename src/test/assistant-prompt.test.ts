import { describe, expect, it } from "vitest";
import { buildSystemPrompt, createLimiter, parseSearchHints } from "@/lib/assistant-prompt";

describe("assistant prompt", () => {
  it("states no-data instead of listings when none are allowed", () => {
    const p = buildSystemPrompt({ isStaff: false, listings: [] });
    expect(p).toContain("لا توجد بيانات إعلانات مطابقة");
    expect(p).not.toContain("id=");
  });
  it("includes only supplied listings", () => {
    const p = buildSystemPrompt({
      isStaff: false,
      listings: [{ id: "a1", castle_level: 25, power: 100, price: 50, server: "S1" }],
    });
    expect(p).toContain("id=a1");
    expect(p.match(/id=/g)).toHaveLength(1);
  });
  it("parses level hints", () => expect(parseSearchHints("قلعة مستوى 25").level).toBe(25));
});

describe("limiter", () => {
  it("blocks the 6th message within a minute", () => {
    let t = 0;
    const lim = createLimiter(() => t);
    for (let i = 0; i < 5; i++) {
      expect(lim("u", 30)).toBe("ok");
      t += 1000;
    }
    expect(lim("u", 30)).toBe("burst");
  });
  it("blocks after the daily limit of 30", () => {
    let t = 0;
    const lim = createLimiter(() => t);
    for (let i = 0; i < 30; i++) {
      expect(lim("u", 30)).toBe("ok");
      t += 61_000;
    }
    expect(lim("u", 30)).toBe("daily");
  });
});
