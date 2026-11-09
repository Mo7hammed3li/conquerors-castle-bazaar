import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Crown, Heart, LogOut, Plus, Shield, User as UserIcon, Menu } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

export function SiteHeader() {
  const { t, lang, setLang } = useI18n();
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const links = (
    <>
      <Link to="/listings" className="text-sm text-muted-foreground hover:text-primary" activeProps={{ className: "text-primary" }}>
        {t("browse")}
      </Link>
      {user && (
        <>
          <Link to="/favorites" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
            <Heart className="size-4" /> {t("favorites")}
          </Link>
          <Link to="/account" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
            <UserIcon className="size-4" /> {t("account")}
          </Link>
        </>
      )}
      {isAdmin && (
        <Link to="/admin" className="flex items-center gap-1 text-sm text-primary">
          <Shield className="size-4" /> {t("admin")}
        </Link>
      )}
    </>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4">
        <Link to="/" className="flex items-center gap-2">
          <Crown className="size-6 text-primary" />
          <span className="font-display text-xl font-bold text-gold-gradient">Mo7hammed Store</span>
        </Link>
        <nav className="hidden items-center gap-5 md:flex">{links}</nav>
        <div className="ms-auto flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setLang(lang === "ar" ? "en" : "ar")}>
            {lang === "ar" ? "EN" : "عربي"}
          </Button>
          <Button variant="gold" size="sm" asChild>
            <Link to="/new">
              <Plus /> <span className="hidden sm:inline">{t("addListing")}</span>
            </Link>
          </Button>
          {user ? (
            <Button variant="ghost" size="icon" onClick={signOut} aria-label={t("signOut")} className="hidden md:inline-flex">
              <LogOut />
            </Button>
          ) : (
            <Button variant="ornate" size="sm" asChild>
              <Link to="/auth">{t("signIn")}</Link>
            </Button>
          )}
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setOpen(!open)} aria-label="menu">
            <Menu />
          </Button>
        </div>
      </div>
      {open && (
        <nav className="flex flex-col gap-4 border-t border-border/60 px-4 py-4 md:hidden" onClick={() => setOpen(false)}>
          {links}
          {user && (
            <button onClick={signOut} className="flex items-center gap-1 text-sm text-destructive">
              <LogOut className="size-4" /> {t("signOut")}
            </button>
          )}
        </nav>
      )}
    </header>
  );
}
