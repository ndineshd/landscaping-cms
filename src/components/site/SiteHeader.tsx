"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Check, ChevronDown, Languages, Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { ROUTES } from "@/lib/constants";
import { createLocalizedPath, normalizeLanguageCode, stripLanguagePrefixFromPath } from "@/lib/site-i18n";
import type { LanguageConfig, LogoConfig } from "@/types/config";
import type { SiteNavItem } from "@/types/site";

import { SiteLogo } from "./SiteLogo";

interface SiteHeaderProps {
  companyName: string;
  currentLanguageCode: string;
  languageCodes: string[];
  languageSwitcherAriaLabel?: string;
  languages: LanguageConfig[];
  logo: LogoConfig;
  logoText: string;
  navItems: SiteNavItem[];
  siteName: string;
}

interface HeaderLanguageOption {
  code: string;
  name: string;
}

interface LanguageSwitcherProps {
  activeLanguageCode: string;
  isTransparent: boolean;
  languageOptions: HeaderLanguageOption[];
  languageSwitcherAriaLabel: string;
  onChange: (languageCode: string) => void;
  size: "desktop" | "mobile";
}

function normalizePath(value: string): string {
  if (!value) return ROUTES.HOME;
  if (value === ROUTES.HOME) return ROUTES.HOME;
  const normalized = value.replace(/\/+$/, "");
  return normalized || ROUTES.HOME;
}

function isNavItemActive(
  href: string,
  pathname: string,
  languageCodes: string[]
): boolean {
  const hrefWithoutLanguage = stripLanguagePrefixFromPath(href, languageCodes);
  const pathnameWithoutLanguage = stripLanguagePrefixFromPath(pathname, languageCodes);
  const hrefPath = normalizePath(
    hrefWithoutLanguage.split("?")[0].split("#")[0] || ROUTES.HOME
  );
  const pathnameOnly = normalizePath(
    pathnameWithoutLanguage.split("?")[0].split("#")[0] || ROUTES.HOME
  );

  if (hrefPath === ROUTES.HOME) {
    return pathnameOnly === ROUTES.HOME;
  }
  return pathnameOnly === hrefPath || pathnameOnly.startsWith(`${hrefPath}/`);
}

function setLanguagePreference(languageCode: string): void {
  if (typeof document === "undefined") return;
  document.cookie = `language=${languageCode}; path=/; max-age=31536000; samesite=lax`;
}

function createLanguageHref(
  pathname: string,
  searchParamsString: string,
  nextLanguageCode: string,
  languageCodes: string[]
): string {
  const basePath = stripLanguagePrefixFromPath(pathname, languageCodes)
    .split("?")[0]
    .split("#")[0] || ROUTES.HOME;
  const localizedPath = createLocalizedPath(basePath, nextLanguageCode, languageCodes);
  return searchParamsString ? `${localizedPath}?${searchParamsString}` : localizedPath;
}

function LanguageSwitcher({
  activeLanguageCode,
  isTransparent,
  languageOptions,
  languageSwitcherAriaLabel,
  onChange,
  size,
}: LanguageSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const activeLanguageName =
    languageOptions.find((language) => language.code === activeLanguageCode)?.name ||
    activeLanguageCode.toUpperCase();
  const isMobile = size === "mobile";

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (containerRef.current?.contains(target)) return;
      setIsOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  useEffect(() => {
    setIsOpen(false);
  }, [activeLanguageCode]);

  return (
    <div className={cn("relative", isMobile ? "w-full" : "")} ref={containerRef}>
      <button
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={languageSwitcherAriaLabel}
        className={cn(
          "inline-flex items-center justify-between gap-2 rounded-[5px] border transition-colors duration-200",
          isMobile
            ? "h-10 w-full px-3 text-sm font-medium"
            : "h-9 min-w-[132px] px-3 text-xs font-semibold",
          !isMobile && isTransparent
            ? "border-white/40 bg-white/15 text-white hover:bg-white/25"
            : "border-[var(--site-color-border)] bg-white text-[var(--site-color-foreground)] hover:border-[var(--site-color-primary)]"
        )}
        onClick={() => setIsOpen((previousValue) => !previousValue)}
        type="button"
      >
        <span className="inline-flex min-w-0 items-center gap-2">
          <Languages className={cn("shrink-0", isMobile ? "h-4 w-4" : "h-3.5 w-3.5")} />
          <span className="truncate">{activeLanguageName}</span>
        </span>
        <ChevronDown
          className={cn(
            "shrink-0 transition-transform duration-200",
            isOpen ? "rotate-180" : "",
            isMobile ? "h-4 w-4" : "h-3.5 w-3.5"
          )}
        />
      </button>
      {isOpen ? (
        <div
          className={cn(
            "absolute z-[80] mt-2 overflow-hidden rounded-[8px] border border-[var(--site-color-border)] bg-white shadow-lg",
            isMobile ? "left-0 right-0" : "right-0 w-48"
          )}
          role="listbox"
        >
          <ul className="max-h-72 overflow-y-auto py-1">
            {languageOptions.map((language) => {
              const isActive = language.code === activeLanguageCode;
              return (
                <li key={language.code}>
                  <button
                    aria-selected={isActive}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors",
                      isActive
                        ? "bg-[var(--site-color-accent)] font-medium text-[var(--site-color-primary)]"
                        : "text-[var(--site-color-foreground)] hover:bg-[var(--site-color-muted)]"
                    )}
                    onClick={() => {
                      setIsOpen(false);
                      if (!isActive) {
                        onChange(language.code);
                      }
                    }}
                    role="option"
                    type="button"
                  >
                    <span className="inline-flex min-w-0 items-center gap-2">
                      <Languages className="h-3.5 w-3.5 shrink-0 text-[var(--site-color-primary)]" />
                      <span className="truncate">{language.name}</span>
                    </span>
                    {isActive ? <Check className="h-3.5 w-3.5 shrink-0" /> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Fixed header with desktop and mobile navigation.
 */
export function SiteHeader({
  companyName,
  currentLanguageCode,
  languageCodes,
  languageSwitcherAriaLabel = "Choose language",
  languages,
  logo,
  logoText,
  navItems,
  siteName,
}: SiteHeaderProps) {
  const scrollAnimationFrameIdRef = useRef<number | null>(null);
  const languageRefreshTimerRef = useRef<number | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const normalizedLanguageCodes = Array.from(
    new Set(languageCodes.map((code) => normalizeLanguageCode(code)).filter(Boolean))
  );
  const languageNameMap = new Map(
    languages.map((language) => [
      normalizeLanguageCode(language.code),
      (language.name || "").trim() || normalizeLanguageCode(language.code).toUpperCase(),
    ])
  );
  const languageOptions = normalizedLanguageCodes.map((code) => {
    return {
      code,
      name: languageNameMap.get(code) || code.toUpperCase(),
    };
  });
  const normalizedCurrentLanguageCode = normalizeLanguageCode(currentLanguageCode);
  const resolvedLanguageCode = languageOptions.some(
    (language) => language.code === normalizedCurrentLanguageCode
  )
    ? normalizedCurrentLanguageCode
    : languageOptions[0]?.code || normalizedCurrentLanguageCode || "en";
  const activeLanguageCode = resolvedLanguageCode;
  const searchParamsString = searchParams.toString();
  const sitePathname = stripLanguagePrefixFromPath(pathname, normalizedLanguageCodes)
    .split("?")[0]
    .split("#")[0] || ROUTES.HOME;
  const isLandingStylePage =
    sitePathname === ROUTES.HOME ||
    sitePathname === ROUTES.CONTACT ||
    sitePathname === ROUTES.SERVICES ||
    sitePathname.startsWith(`${ROUTES.SERVICES}/`);

  useEffect(() => {
    const updateScrollState = () => {
      setIsScrolled((previousValue) => {
        const scrollY = window.scrollY;
        // Hysteresis prevents rapid toggling/flicker around the threshold.
        return previousValue ? scrollY > 14 : scrollY > 30;
      });
    };

    const onScroll = () => {
      if (scrollAnimationFrameIdRef.current !== null) return;
      scrollAnimationFrameIdRef.current = window.requestAnimationFrame(() => {
        scrollAnimationFrameIdRef.current = null;
        updateScrollState();
      });
    };

    updateScrollState();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      if (scrollAnimationFrameIdRef.current !== null) {
        window.cancelAnimationFrame(scrollAnimationFrameIdRef.current);
      }
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  useEffect(() => {
    setIsMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    return () => {
      if (languageRefreshTimerRef.current !== null) {
        window.clearTimeout(languageRefreshTimerRef.current);
      }
    };
  }, []);

  const isTransparent = isLandingStylePage && !isScrolled;
  const startNavigation = () => {
    setIsMenuOpen(false);
  };
  const showLanguageSwitcher = languageOptions.length > 1;
  const homeHref = createLocalizedPath(
    ROUTES.HOME,
    activeLanguageCode,
    normalizedLanguageCodes
  );
  const handleLanguageChange = (nextLanguageCode: string) => {
    const normalizedNextLanguageCode = normalizeLanguageCode(nextLanguageCode);
    if (!normalizedNextLanguageCode || normalizedNextLanguageCode === activeLanguageCode) {
      return;
    }
    const nextHref = createLanguageHref(
      pathname,
      searchParamsString,
      normalizedNextLanguageCode,
      normalizedLanguageCodes
    );

    setLanguagePreference(normalizedNextLanguageCode);
    startNavigation();
    router.push(nextHref);

    if (languageRefreshTimerRef.current !== null) {
      window.clearTimeout(languageRefreshTimerRef.current);
    }
    languageRefreshTimerRef.current = window.setTimeout(() => {
      router.refresh();
      languageRefreshTimerRef.current = null;
    }, 80);
  };

  return (
    <>
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-50 w-full border-b transition-colors duration-300",
          isTransparent
            ? "border-transparent"
            : "border-[var(--site-color-border)] bg-white/95 text-[var(--site-color-foreground)] shadow-sm backdrop-blur"
        )}
      >
        <div className="mx-auto flex h-[76px] w-full max-w-[1280px] items-center justify-between px-4 md:px-8">
          <div className="md:hidden">
            <SiteLogo
              companyName={companyName}
              homeHref={homeHref}
              logo={logo}
              logoText={logoText}
              siteName={siteName}
            />
          </div>
          <div className="hidden md:block">
            <SiteLogo
              companyName={companyName}
              homeHref={homeHref}
              logo={logo}
              logoText={logoText}
              siteName={siteName}
            />
          </div>
          <button
            aria-controls="mobile-nav"
            aria-expanded={isMenuOpen}
            aria-label="Toggle navigation menu"
            className={cn(
              "inline-flex h-10 w-10 items-center justify-center rounded-[5px] border transition-colors md:hidden",
              isTransparent
                ? "border-white/50 text-white hover:bg-white/15"
                : "border-[var(--site-color-border)] text-[var(--site-color-foreground)] hover:bg-[var(--site-color-muted)]"
            )}
            onClick={() => setIsMenuOpen((prev) => !prev)}
            type="button"
          >
            {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          <nav className="hidden md:block">
            <ul className="flex items-center gap-4">
              {navItems.map((item) => {
                const active = isNavItemActive(
                  item.href,
                  pathname,
                  normalizedLanguageCodes
                );
                return (
                  <li key={item.href}>
                    <Link
                      className={cn(
                        "relative rounded-[5px] px-4 py-2 text-sm font-medium transition-all duration-200",
                        isTransparent ? "text-white hover:bg-white/20" : "text-[var(--site-color-foreground)] hover:bg-[var(--site-color-muted)]",
                        active
                          && "bg-[var(--site-color-accent)] text-[var(--site-color-primary)]"
                      )}
                      href={item.href}
                      onClick={startNavigation}
                    >
                      {item.label}
                      <span
                        className={cn(
                          "absolute inset-x-4 bottom-1 h-0.5 rounded-full bg-[var(--site-color-primary)] transition-opacity duration-200",
                          active ? "opacity-100" : "opacity-0"
                        )}
                      />
                    </Link>
                  </li>
                );
              })}
              {showLanguageSwitcher ? (
                <li>
                  <LanguageSwitcher
                    activeLanguageCode={activeLanguageCode}
                    isTransparent={isTransparent}
                    languageOptions={languageOptions}
                    languageSwitcherAriaLabel={languageSwitcherAriaLabel}
                    onChange={handleLanguageChange}
                    size="desktop"
                  />
                </li>
              ) : null}
            </ul>
          </nav>
        </div>

        {isMenuOpen ? (
          <nav
            className="border-t border-[var(--site-color-border)] bg-white px-4 pb-4 pt-3 text-[var(--site-color-foreground)] md:hidden"
            id="mobile-nav"
          >
            <ul className="space-y-1">
              {navItems.map((item) => {
                const active = isNavItemActive(
                  item.href,
                  pathname,
                  normalizedLanguageCodes
                );
                return (
                  <li key={item.href}>
                    <Link
                      className={cn(
                        "block rounded-[5px] px-3 py-2 text-sm font-medium transition-colors duration-200",
                        active
                          ? "bg-[var(--site-color-accent)] text-[var(--site-color-primary)]"
                          : "text-[var(--site-color-foreground)] hover:bg-[var(--site-color-muted)]"
                      )}
                      href={item.href}
                      onClick={startNavigation}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
              {showLanguageSwitcher ? (
                <li className="pt-3">
                  <LanguageSwitcher
                    activeLanguageCode={activeLanguageCode}
                    isTransparent={false}
                    languageOptions={languageOptions}
                    languageSwitcherAriaLabel={languageSwitcherAriaLabel}
                    onChange={handleLanguageChange}
                    size="mobile"
                  />
                </li>
              ) : null}
            </ul>
          </nav>
        ) : null}
      </header>
    </>
  );
}
