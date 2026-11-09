export type HeroType = "infantry" | "chariots" | "cavalry" | "archers";

export interface Hero {
  key: string;
  ar: string;
  en: string;
  type: HeroType;
  /** Every hero in the game list has index 5 */
  index: 5;
}

const h = (key: string, ar: string, en: string, type: HeroType): Hero => ({ key, ar, en, type, index: 5 });

export const HERO_TYPES: { type: HeroType; ar: string; en: string }[] = [
  { type: "infantry", ar: "المشاة", en: "Infantry" },
  { type: "chariots", ar: "العجلات", en: "Chariots" },
  { type: "cavalry", ar: "الفرسان", en: "Cavalry" },
  { type: "archers", ar: "الرماة", en: "Archers" },
];

export const HEROES: Hero[] = [
  h("mukhtar", "مختار", "Mukhtar", "infantry"),
  h("fatih", "فاتح", "Fatih", "infantry"),
  h("ertugrul", "أرطغرل", "Ertugrul", "infantry"),
  h("qalawun", "قلاوون", "Qalawun", "infantry"),
  h("mawiya", "ماوية", "Mawiya", "infantry"),
  h("zainab", "زينب", "Zainab", "infantry"),

  h("saladin", "صلاح", "Saladin", "chariots"),
  h("qutuz", "قطز", "Qutuz", "chariots"),
  h("malik", "مالك", "Malik", "chariots"),
  h("barquq", "برقوق", "Barquq", "chariots"),
  h("zubaida", "زبيدة", "Zubaida", "chariots"),
  h("nefertiti", "نفرتيتي", "Nefertiti", "chariots"),
  h("kafur", "كافور الأخشيدي", "Kafur al-Ikhshidi", "chariots"),

  h("baron", "بارون", "Baron", "cavalry"),
  h("harun", "هارون", "Harun", "cavalry"),
  h("burak", "بوراك", "Burak", "cavalry"),
  h("iskandar", "إسكندر", "Iskandar", "cavalry"),
  h("abdulrahman", "عبد الرحمن", "Abd al-Rahman", "cavalry"),
  h("jawhar", "جوهر الصقلي", "Jawhar al-Siqilli", "cavalry"),
  h("salih_ali", "الصالح علي", "Al-Salih Ali", "cavalry"),

  h("halima", "حليمة", "Halima", "archers"),
  h("zarqa", "زرقاء", "Zarqa", "archers"),
  h("barbarossa", "بربروس", "Barbarossa", "archers"),
  h("qaitbay", "قايتباي", "Qaitbay", "archers"),
  h("kosem", "كوسم", "Kösem", "archers"),
  h("orhan", "أورخان", "Orhan", "archers"),
  h("attila", "أتيلا الهوني", "Attila the Hun", "archers"),
];

export const HERO_BY_KEY = Object.fromEntries(HEROES.map((x) => [x.key, x])) as Record<string, Hero>;

export const EQUIPMENT_TIERS = [
  { key: "equip_normal", ar: "عادي", en: "Normal", color: "bg-tier-normal" },
  { key: "equip_green", ar: "أخضر", en: "Green", color: "bg-tier-green" },
  { key: "equip_blue", ar: "أزرق", en: "Blue", color: "bg-tier-blue" },
  { key: "equip_purple", ar: "بنفسجي", en: "Purple", color: "bg-tier-purple" },
  { key: "equip_gold", ar: "ذهبي", en: "Gold", color: "bg-tier-gold" },
] as const;

export const LINK_TYPES = [
  { key: "link_igg", label: "IGG" },
  { key: "link_google", label: "Google" },
  { key: "link_facebook", label: "Facebook" },
  { key: "link_icloud", label: "iCloud" },
  { key: "link_gamecenter", label: "Game Center" },
  { key: "link_device", label: "Device" },
] as const;

export type EquipKey = (typeof EQUIPMENT_TIERS)[number]["key"];
export type LinkKey = (typeof LINK_TYPES)[number]["key"];
