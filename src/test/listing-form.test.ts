import { describe, expect, it } from "vitest";
import { HEROES } from "@/lib/heroes";
import { setHeroValue, toggleHero, validateListing, emptyForm } from "@/lib/listing-form";

describe("heroes", () => {
  it("has exactly 27 heroes, all index 5", () => {
    expect(HEROES).toHaveLength(27);
    expect(HEROES.every((h) => h.index === 5)).toBe(true);
    expect(HEROES.filter((h) => h.type === "infantry")).toHaveLength(6);
    expect(HEROES.filter((h) => h.type === "chariots")).toHaveLength(7);
    expect(HEROES.filter((h) => h.type === "cavalry")).toHaveLength(7);
    expect(HEROES.filter((h) => h.type === "archers")).toHaveLength(7);
  });

  it("changing one hero's crescents never affects another hero", () => {
    let heroes = toggleHero([], "saladin");
    heroes = toggleHero(heroes, "qutuz");
    heroes = setHeroValue(heroes, "saladin", "crescents", 4);
    heroes = setHeroValue(heroes, "saladin", "red_crescents", 2);
    heroes = setHeroValue(heroes, "qutuz", "red_crescents", 7);
    expect(heroes.find((h) => h.hero_key === "saladin")).toEqual({ hero_key: "saladin", crescents: 4, red_crescents: 2 });
    expect(heroes.find((h) => h.hero_key === "qutuz")).toEqual({ hero_key: "qutuz", crescents: 0, red_crescents: 7 });
  });
});

describe("listing validation", () => {
  it("requires castle level, power, server, price and whatsapp", () => {
    const r = validateListing(emptyForm());
    expect(r.ok).toBe(false);
    if (!r.ok) for (const f of ["castle_level", "power", "server", "price", "whatsapp"]) expect(r.fields.has(f as never)).toBe(true);
  });
  it("accepts a complete listing", () => {
    const r = validateListing({ ...emptyForm(), castle_level: 30, power: 5000000, server: "123", price: 150, whatsapp: "+201000000000" });
    expect(r.ok).toBe(true);
  });
});
