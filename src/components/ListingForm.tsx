import { useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { useI18n, type DictKey } from "@/lib/i18n";
import { EQUIPMENT_TIERS, HEROES, HERO_BY_KEY, HERO_TYPES, LINK_TYPES } from "@/lib/heroes";
import {
  setHeroValue,
  toggleHero,
  validateListing,
  type ListingFormValues,
  type ValidationErrorKey,
} from "@/lib/listing-form";
import { BUCKET, useImageUrls } from "@/lib/listings";
import { supabase } from "@/integrations/supabase/client";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-2xl ornate-border bg-card-gradient p-5 shadow-card">
      <h2 className="text-lg font-bold text-primary">{title}</h2>
      {children}
    </section>
  );
}

export function ListingForm({
  initial,
  userId,
  submitLabel,
  onSubmit,
}: {
  initial: ListingFormValues;
  userId: string;
  submitLabel: string;
  onSubmit: (v: ListingFormValues) => Promise<void>;
}) {
  const { t, pick } = useI18n();
  const [v, setV] = useState<ListingFormValues>(initial);
  const [errors, setErrors] = useState<Set<ValidationErrorKey>>(new Set());
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { data: previews } = useImageUrls(v.images);

  const set = <K extends keyof ListingFormValues>(k: K, val: ListingFormValues[K]) => setV((p) => ({ ...p, [k]: val }));
  const num = (s: string) => (s === "" ? "" : Math.max(0, Number(s)));

  const field = (k: ValidationErrorKey, label: DictKey, props: React.ComponentProps<typeof Input> = {}) => (
    <div className="space-y-1.5">
      <Label htmlFor={k}>{t(label)}</Label>
      <Input
        id={k}
        name={k}
        value={v[k] as string | number}
        onChange={(e) => set(k, (props.type === "number" ? num(e.target.value) : e.target.value) as never)}
        className={cn(errors.has(k) && "border-destructive")}
        {...props}
      />
    </div>
  );

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    const paths: string[] = [];
    for (const f of Array.from(files).slice(0, 10 - v.images.length)) {
      if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) {
        toast.error("نوع الصورة غير مدعوم. استخدم JPG أو PNG أو WebP.");
        continue;
      }
      if (f.size > 5 * 1024 * 1024) {
        toast.error("الحد الأقصى لحجم الصورة 5 ميجابايت.");
        continue;
      }
      const extension = f.type === "image/jpeg" ? "jpg" : f.type.split("/")[1];
      const path = `${userId}/${crypto.randomUUID()}.${extension}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, f, { contentType: f.type });
      if (error) toast.error(error.message);
      else paths.push(path);
    }
    setV((p) => ({ ...p, images: [...p.images, ...paths] }));
    setUploading(false);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = validateListing(v);
    if (!r.ok) {
      setErrors(r.fields);
      toast.error(t("invalid"));
      return;
    }
    setErrors(new Set());
    setBusy(true);
    try {
      await onSubmit(v);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const selectedKeys = new Set(v.heroes.map((h) => h.hero_key));

  return (
    <form onSubmit={submit} className="space-y-6">
      <Section title={t("details")}>
        <div className="grid gap-4 sm:grid-cols-2">
          {field("castle_level", "level", { type: "number", min: 1, max: 100, inputMode: "numeric" })}
          {field("power", "power", { type: "number", min: 0, inputMode: "numeric" })}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="description">{t("details")}</Label>
          <Textarea
            id="description"
            rows={5}
            value={v.description}
            onChange={(e) => set("description", e.target.value)}
            maxLength={3000}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {field("science_power", "science", { type: "number", min: 0, inputMode: "numeric" })}
          {field("reserve", "reserve", { type: "number", min: 0, inputMode: "numeric" })}
          {field("server", "server", { maxLength: 30 })}
          {field("price", "price", { type: "number", min: 0, step: "any", inputMode: "decimal" })}
          {field("whatsapp", "whatsapp", { type: "tel", dir: "ltr", placeholder: "+9665XXXXXXXX" })}
        </div>
      </Section>

      <Section title={t("images")}>
        <div className="flex flex-wrap gap-3">
          {v.images.map((p, i) => (
            <div key={p} className="relative size-24 overflow-hidden rounded-xl ornate-border bg-muted">
              {previews?.[i] && <img src={previews[i]} alt="" className="size-full object-cover" />}
              <button
                type="button"
                onClick={() => set("images", v.images.filter((x) => x !== p))}
                className="absolute end-1 top-1 rounded-full bg-background/80 p-1"
                aria-label="remove"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
          {v.images.length < 10 && (
            <label className="flex size-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border text-xs text-muted-foreground hover:border-primary">
              {uploading ? <Loader2 className="size-5 animate-spin" /> : <ImagePlus className="size-5" />}
              {t("uploadImages")}
              <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(e) => upload(e.target.files)} />
            </label>
          )}
        </div>
      </Section>

      <Section title={t("equipment")}>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          {EQUIPMENT_TIERS.map((tier) => (
            <div key={tier.key} className="space-y-1.5">
              <Label htmlFor={tier.key} className="flex items-center gap-2">
                <span className={cn("size-3 rounded-full", tier.color)} /> {pick(tier)}
              </Label>
              <Input
                id={tier.key}
                type="number"
                min={0}
                inputMode="numeric"
                value={v.equipment[tier.key]}
                onChange={(e) =>
                  set("equipment", { ...v.equipment, [tier.key]: Math.max(0, Number(e.target.value) || 0) })
                }
              />
            </div>
          ))}
        </div>
      </Section>

      <Section title={t("heroes")}>
        <div className="space-y-1.5">
          <Label htmlFor="hero-picker">{t("selectHeroes")}</Label>
          <select
            id="hero-picker"
            value=""
            onChange={(e) => e.target.value && set("heroes", toggleHero(v.heroes, e.target.value))}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">— {t("selectHeroes")} —</option>
            {HERO_TYPES.map((ht) => (
              <optgroup key={ht.type} label={pick(ht)}>
                {HEROES.filter((h) => h.type === ht.type && !selectedKeys.has(h.key)).map((h) => (
                  <option key={h.key} value={h.key}>
                    {pick(h)} ({t("index")} {h.index})
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        {HERO_TYPES.map((ht) => {
          const rows = v.heroes.filter((h) => HERO_BY_KEY[h.hero_key]?.type === ht.type);
          if (!rows.length) return null;
          return (
            <div key={ht.type} className="space-y-2">
              <h3 className="text-sm font-bold text-muted-foreground">{pick(ht)}</h3>
              {rows.map((row) => {
                const hero = HERO_BY_KEY[row.hero_key];
                return (
                  <div
                    key={row.hero_key}
                    data-hero={row.hero_key}
                    className="grid grid-cols-[1fr_auto] items-end gap-3 rounded-xl bg-muted/60 p-3 sm:grid-cols-[1fr_8rem_8rem_auto]"
                  >
                    <div className="col-span-2 font-bold sm:col-span-1">
                      {pick(hero)} <span className="text-xs font-normal text-muted-foreground">({t("index")} 5)</span>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`${row.hero_key}-c`} className="text-xs">{t("crescents")}</Label>
                      <Input
                        id={`${row.hero_key}-c`}
                        type="number"
                        min={0}
                        inputMode="numeric"
                        value={row.crescents === 0 ? "" : row.crescents}
                        onChange={(e) =>
                          setV((p) => ({ ...p, heroes: setHeroValue(p.heroes, row.hero_key, "crescents", Number(e.target.value)) }))
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`${row.hero_key}-r`} className="text-xs text-crescent-red">{t("redCrescents")}</Label>
                      <Input
                        id={`${row.hero_key}-r`}
                        type="number"
                        min={0}
                        inputMode="numeric"
                        value={row.red_crescents === 0 ? "" : row.red_crescents}
                        onChange={(e) =>
                          setV((p) => ({ ...p, heroes: setHeroValue(p.heroes, row.hero_key, "red_crescents", Number(e.target.value)) }))
                        }
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => set("heroes", toggleHero(v.heroes, row.hero_key))}
                      aria-label="remove hero"
                    >
                      <X />
                    </Button>
                  </div>
                );
              })}
            </div>
          );
        })}
      </Section>

      <Section title={t("links")}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {LINK_TYPES.map((l) => (
            <label
              key={l.key}
              htmlFor={l.key}
              className="flex cursor-pointer items-center justify-between gap-2 rounded-xl bg-muted/60 p-3"
            >
              <span className="font-bold" dir="ltr">{l.label}</span>
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                {v.links[l.key] ? t("linked") : t("notLinked")}
                <Checkbox
                  id={l.key}
                  checked={v.links[l.key]}
                  onCheckedChange={(c) => set("links", { ...v.links, [l.key]: c === true })}
                />
              </span>
            </label>
          ))}
        </div>
      </Section>

      <Button type="submit" variant="gold" size="xl" className="w-full" disabled={busy || uploading}>
        {busy && <Loader2 className="animate-spin" />} {submitLabel}
      </Button>
    </form>
  );
}
