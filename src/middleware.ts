import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  normalizeLanguageCode,
  resolveSiteLanguage,
  type SiteLanguageState,
} from "@/lib/site-i18n";
import type { SiteConfig } from "@/types/config";

const SITE_LANGUAGE_HEADER = "x-site-lang";
const LANGUAGE_COOKIE_NAME = "language";

function createFallbackSiteConfig(): SiteConfig {
  const configuredCodes = (process.env.SITE_LANGUAGE_CODES || "")
    .split(",")
    .map((value) => normalizeLanguageCode(value))
    .filter(Boolean);
  const languageCodes = Array.from(new Set(["en", ...configuredCodes]));
  const configuredDefaultLanguage = normalizeLanguageCode(
    process.env.SITE_DEFAULT_LANGUAGE || "en"
  );
  const defaultLanguage = languageCodes.includes(configuredDefaultLanguage)
    ? configuredDefaultLanguage
    : languageCodes[0];

  return {
    availableLanguages: languageCodes,
    companyName: "Site",
    defaultLanguage,
    description: "",
    languages: languageCodes.map((code) => ({
      code,
      name: code === "en" ? "English" : code.toUpperCase(),
    })),
    logo: {
      text: "",
      type: "text",
    },
    name: "Site",
    tagline: "",
  };
}

function buildKnownLanguageCodes(siteLanguageState: SiteLanguageState): string[] {
  return Array.from(
    new Set(
      ["en", ...siteLanguageState.languageCodes]
        .map((code) => normalizeLanguageCode(code))
        .filter(Boolean)
    )
  );
}

function isPathWithLanguagePrefix(
  pathname: string,
  languageCodes: string[]
): string | null {
  const firstSegment = pathname.split("/").filter(Boolean)[0];
  if (!firstSegment) {
    return null;
  }

  const normalizedSegment = normalizeLanguageCode(firstSegment);
  const languageCodeSet = new Set(
    languageCodes.map((languageCode) => normalizeLanguageCode(languageCode))
  );

  return languageCodeSet.has(normalizedSegment) ? normalizedSegment : null;
}

function getLanguageRoutingState(): {
  knownLanguageCodes: string[];
  siteLanguageState: SiteLanguageState;
} {
  const fallbackConfig = createFallbackSiteConfig();
  const siteLanguageState = resolveSiteLanguage(fallbackConfig);
  const knownLanguageCodes = buildKnownLanguageCodes(siteLanguageState);

  return {
    knownLanguageCodes,
    siteLanguageState,
  };
}

export async function middleware(request: NextRequest) {
  const { knownLanguageCodes, siteLanguageState } = getLanguageRoutingState();
  const { pathname } = request.nextUrl;
  const isPrefetchRequest =
    request.headers.get("next-router-prefetch") === "1" ||
    request.headers.get("purpose")?.toLowerCase() === "prefetch";
  const preferredLanguageCookie = normalizeLanguageCode(
    request.cookies.get(LANGUAGE_COOKIE_NAME)?.value || ""
  );
  const preferredLanguage = siteLanguageState.languageCodes.includes(
    preferredLanguageCookie
  )
    ? preferredLanguageCookie
    : siteLanguageState.defaultLanguageCode;
  const languageFromPath = isPathWithLanguagePrefix(
    pathname,
    siteLanguageState.languageCodes
  );

  if (languageFromPath) {
    const pathnameWithoutLanguage =
      pathname === `/${languageFromPath}`
        ? "/"
        : pathname.slice(languageFromPath.length + 1);
    const rewriteUrl = request.nextUrl.clone();
    const requestHeaders = new Headers(request.headers);

    rewriteUrl.pathname = pathnameWithoutLanguage || "/";
    rewriteUrl.searchParams.set("__site_lang", languageFromPath);
    requestHeaders.set(SITE_LANGUAGE_HEADER, languageFromPath);

    const response = NextResponse.rewrite(rewriteUrl, {
      request: {
        headers: requestHeaders,
      },
    });
    const currentCookieLanguage = normalizeLanguageCode(
      request.cookies.get(LANGUAGE_COOKIE_NAME)?.value || ""
    );
    if (!isPrefetchRequest && currentCookieLanguage !== languageFromPath) {
      response.cookies.set(LANGUAGE_COOKIE_NAME, languageFromPath, {
        maxAge: 60 * 60 * 24 * 365,
        path: "/",
        sameSite: "lax",
      });
    }
    return response;
  }

  const legacyLanguageFromPath = isPathWithLanguagePrefix(
    pathname,
    knownLanguageCodes
  );
  if (legacyLanguageFromPath) {
    const pathnameWithoutLanguage =
      pathname === `/${legacyLanguageFromPath}`
        ? "/"
        : pathname.slice(legacyLanguageFromPath.length + 1);
    const redirectUrl = request.nextUrl.clone();

    redirectUrl.pathname =
      pathnameWithoutLanguage === "/"
        ? `/${preferredLanguage}`
        : `/${preferredLanguage}${pathnameWithoutLanguage}`;

    return NextResponse.redirect(redirectUrl);
  }

  const redirectUrl = request.nextUrl.clone();

  redirectUrl.pathname =
    pathname === "/" ? `/${preferredLanguage}` : `/${preferredLanguage}${pathname}`;

  return NextResponse.redirect(redirectUrl);
}

export const config = {
  matcher: ["/((?!admin|api|_next|.*\\..*).*)"],
};
