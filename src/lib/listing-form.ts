import { z } from "zod";
import type { EquipKey, LinkKey } from "./heroes";

export interface HeroEntry {
  hero_key: string;
  crescents: number;
  red_crescents: number;
}

export interface ListingFormValues {
  castle_level: number | "";
  power: number | "";
  description: string;
  science_power: number | "";
  reserve: number | "";
  server: string;
  price: number | "";
  whatsapp: string;
  images: string[];
  equipment: Record<EquipKey, number>;
  links: Record<LinkKey, boolean>;
  /** One independent entry per selected hero, keyed by hero_key */
  heroes: HeroEntry[];
}

export const emptyForm = (): ListingFormValues => ({
  castle_level: "",
  power: "",
  description: "",
  science_power: "",
  reserve: "",
  server: "",
  price: "",
  whatsapp: "",
  images: [],
  equipment: { equip_normal: 0, equip_green: 0, equip_blue: 0, equip_purple: 0, equip_gold: 0 },
  links: {
    link_igg: false,
    link_google: false,
    link_facebook: false,
    link_icloud: false,
    link_gamecenter: false,
    link_device: false,
  },
  heroes: [],
});

/** Update one hero's value without touching any other hero. */
export function setHeroValue(
  heroes: HeroEntry[],
  key: string,
  field: "crescents" | "red_crescents",
  value: number,
): HeroEntry[] {
  return heroes.map((h) => (h.hero_key === key ? { ...h, [field]: Math.max(0, Math.floor(value) || 0) } : h));
}

export function toggleHero(heroes: HeroEntry[], key: string): HeroEntry[] {
  if (heroes.some((h) => h.hero_key === key)) return heroes.filter((h) => h.hero_key !== key);
  return [...heroes, { hero_key: key, crescents: 0, red_crescents: 0 }];
}

const nonNeg = z.coerce.number().int().min(0);

export const listingSchema = z.object({
  castle_level: z.coerce.number().int().min(1).max(100),
  power: nonNeg,
  description: z.string().trim().max(3000),
  science_power: nonNeg,
  reserve: nonNeg,
  server: z.string().trim().min(1).max(30),
  price: z.coerce.number().min(0).max(10_000_000),
  whatsapp: z
    .string()
    .trim()
    .regex(/^\+?[0-9]{8,15}$/),
});

export type ValidationErrorKey = keyof z.infer<typeof listingSchema>;

export function validateListing(v: ListingFormValues) {
  const r = listingSchema.safeParse({
    ...v,
    castle_level: v.castle_level === "" ? undefined : v.castle_level,
    power: v.power === "" ? undefined : v.power,
    science_power: v.science_power === "" ? 0 : v.science_power,
    reserve: v.reserve === "" ? 0 : v.reserve,
    price: v.price === "" ? undefined : v.price,
  });
  if (r.success) return { ok: true as const, data: r.data };
  const fields = new Set(r.error.issues.map((i) => i.path[0] as ValidationErrorKey));
  return { ok: false as const, fields };
}

export function whatsappLink(num: string) {
  return `https://wa.me/${num.replace(/[^0-9]/g, "")}`;
}
