import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "ar" | "en";

const dict = {
  brand: { ar: "Mo7hammed Store", en: "Mo7hammed Store" },
  home: { ar: "الرئيسية", en: "Home" },
  browse: { ar: "تصفح القلاع", en: "Browse castles" },
  addListing: { ar: "أضف قلعتك", en: "Add your castle" },
  favorites: { ar: "المفضلة", en: "Favorites" },
  account: { ar: "حسابي", en: "My account" },
  admin: { ar: "لوحة الإدارة", en: "Admin" },
  signIn: { ar: "تسجيل الدخول", en: "Sign in" },
  signOut: { ar: "تسجيل الخروج", en: "Sign out" },
  heroTitle: { ar: "سوق قلاع الفاتحون الفاخر", en: "The premium Conquerors castle market" },
  heroSub: {
    ar: "بِع واشترِ قلاع لعبة الفاتحون بثقة. كل إعلان يُراجع من الإدارة قبل نشره.",
    en: "Buy and sell Conquerors castles with confidence. Every listing is reviewed before it goes live.",
  },
  latest: { ar: "أحدث القلاع", en: "Latest castles" },
  viewAll: { ar: "عرض الكل", en: "View all" },
  search: { ar: "ابحث في التفاصيل أو السيرفر…", en: "Search details or server…" },
  level: { ar: "مستوى القلعة", en: "Castle level" },
  power: { ar: "القوة", en: "Power" },
  science: { ar: "قوة العلوم", en: "Science power" },
  reserve: { ar: "الاحتياط", en: "Reserve" },
  server: { ar: "السيرفر", en: "Server" },
  price: { ar: "السعر ($)", en: "Price ($)" },
  whatsapp: { ar: "رقم واتساب", en: "WhatsApp number" },
  details: { ar: "تفاصيل الإعلان", en: "Listing details" },
  images: { ar: "الصور", en: "Images" },
  equipment: { ar: "العتاد", en: "Equipment" },
  heroes: { ar: "الأبطال", en: "Heroes" },
  links: { ar: "الروابط", en: "Linked accounts" },
  linked: { ar: "مرتبط", en: "Linked" },
  notLinked: { ar: "غير مرتبط", en: "Not linked" },
  crescents: { ar: "هلالات عادية", en: "Crescents" },
  redCrescents: { ar: "هلالات حمراء", en: "Red crescents" },
  index: { ar: "المؤشر", en: "Index" },
  publish: { ar: "إرسال للمراجعة", en: "Submit for review" },
  save: { ar: "حفظ التعديلات", en: "Save changes" },
  noResults: { ar: "لا توجد إعلانات مطابقة", en: "No matching listings" },
  minLevel: { ar: "أدنى مستوى", en: "Min level" },
  maxPrice: { ar: "أعلى سعر", en: "Max price" },
  minPower: { ar: "أدنى قوة", en: "Min power" },
  sort: { ar: "الترتيب", en: "Sort" },
  newest: { ar: "الأحدث", en: "Newest" },
  priceLow: { ar: "السعر: الأقل", en: "Price: low" },
  priceHigh: { ar: "السعر: الأعلى", en: "Price: high" },
  powerHigh: { ar: "القوة: الأعلى", en: "Power: high" },
  contact: { ar: "تواصل عبر واتساب", en: "Contact on WhatsApp" },
  addFav: { ar: "أضف للمفضلة", en: "Add to favorites" },
  removeFav: { ar: "إزالة من المفضلة", en: "Remove favorite" },
  pending: { ar: "قيد المراجعة", en: "Pending" },
  approved: { ar: "منشور", en: "Approved" },
  rejected: { ar: "مرفوض", en: "Rejected" },
  edit: { ar: "تعديل", en: "Edit" },
  delete: { ar: "حذف", en: "Delete" },
  approve: { ar: "قبول", en: "Approve" },
  reject: { ar: "رفض", en: "Reject" },
  users: { ar: "المستخدمون", en: "Users" },
  listingsTab: { ar: "الإعلانات", en: "Listings" },
  ban: { ar: "حظر", en: "Ban" },
  unban: { ar: "إلغاء الحظر", en: "Unban" },
  makeAdmin: { ar: "جعله مشرفًا", en: "Make admin" },
  removeAdmin: { ar: "إزالة الإشراف", en: "Remove admin" },
  myListings: { ar: "إعلاناتي", en: "My listings" },
  empty: { ar: "لا يوجد شيء هنا بعد", en: "Nothing here yet" },
  selectHeroes: { ar: "اختر الأبطال الموجودين في القلعة", en: "Pick the heroes in this castle" },
  uploadImages: { ar: "رفع صور", en: "Upload images" },
  invalid: { ar: "تحقق من الحقول المظللة", en: "Check the highlighted fields" },
  saved: { ar: "تم الحفظ وأُرسل الإعلان للمراجعة", en: "Saved and sent for review" },
  signInToFav: { ar: "سجّل الدخول لحفظ المفضلة", en: "Sign in to save favorites" },
  banned: { ar: "حسابك محظور من النشر", en: "Your account is banned from posting" },
  all: { ar: "الكل", en: "All" },
} as const;

export type DictKey = keyof typeof dict;

interface I18n {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (k: DictKey) => string;
  pick: (o: { ar: string; en: string }) => string;
}

const Ctx = createContext<I18n | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("ar");
  useEffect(() => {
    const saved = localStorage.getItem("lang");
    if (saved === "en" || saved === "ar") setLangState(saved);
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);
  const setLang = (l: Lang) => {
    localStorage.setItem("lang", l);
    setLangState(l);
  };
  const value: I18n = {
    lang,
    setLang,
    t: (k) => dict[k][lang],
    pick: (o) => o[lang],
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useI18n outside provider");
  return c;
}
