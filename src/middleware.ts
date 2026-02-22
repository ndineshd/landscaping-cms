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
const LANGUAGE_STATE_CACHE_TTL_MS = 30_000;
const GITHUB_CONTENTS_BASE_URL = "https://api.github.com/repos";
const ADMIN_CONFIG_PATH = "src/data/content/admin.config.json";

interface GitHubFileResponse {
  content?: string;
}

interface CachedLanguageRoutingState {
  expiresAt: number;
  knownLanguageCodes: string[];
  siteLanguageState: SiteLanguageState;
}

let cachedLanguageRoutingState: CachedLanguageRoutingState | null = null;

function createFallbackSiteConfig(): SiteConfig {
  return {
    name: "Site",
    companyName: "Site",
    tagline: "",
    description: "",
    logo: {
      type: "text",
      text: "",
    },
    defaultLanguage: "en",
    languages: [{ name: "English", code: "en" }],
    availableLanguages: ["en"],
  };
}

function decodeGitHubBase64(content: string): string {
  const normalized = content.replace(/\n/g, "");
  const binary = atob(normalized);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function buildKnownLanguageCodes(
  siteConfig: SiteConfig,
  siteLanguageState: SiteLanguageState
): string[] {
  return Array.from(
    new Set(
      [
        "en",
        ...siteLanguageState.languageCodes,
        siteConfig.defaultLanguage,
        ...(Array.isArray(siteConfig.availableLanguages)
          ? siteConfig.availableLanguages
          : []),
        ...(Array.isArray(siteConfig.languages)
          ? siteConfig.languages.map((language) => language?.code)
          : []),
      ]
        .filter((code): code is string => typeof code === "string")
        .map((code) => normalizeLanguageCode(code))
        .filter(Boolean)
    )
  );
}

async function loadSiteConfigFromGitHub(): Promise<SiteConfig | null> {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH || "main";

  if (!token || !owner || !repo) {
    return null;
  }

  const apiUrl =
    `${GITHUB_CONTENTS_BASE_URL}/${owner}/${repo}/contents/` +
    `${ADMIN_CONFIG_PATH}?ref=${encodeURIComponent(branch)}`;
  const response = await fetch(apiUrl, {
    headers: {
      Accept: "application/vnd.github.v3+json",
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as GitHubFileResponse;
  if (!data.content) {
    return null;
  }

  const decoded = decodeGitHubBase64(data.content);
  const parsed = JSON.parse(decoded) as { site?: unknown };

  if (!parsed.site || typeof parsed.site !== "object") {
    return null;
  }

  return parsed.site as SiteConfig;
}

async function getLanguageRoutingState(): Promise<{
  knownLanguageCodes: string[];
  siteLanguageState: SiteLanguageState;
}> {
  if (
    cachedLanguageRoutingState &&
    cachedLanguageRoutingState.expiresAt > Date.now()
  ) {
    return {
      knownLanguageCodes: cachedLanguageRoutingState.knownLanguageCodes,
      siteLanguageState: cachedLanguageRoutingState.siteLanguageState,
    };
  }

  const fallbackConfig = createFallbackSiteConfig();
  let resolvedSiteConfig: SiteConfig = fallbackConfig;

  try {
    const remoteConfig = await loadSiteConfigFromGitHub();
    if (remoteConfig) {
      resolvedSiteConfig = remoteConfig;
    }
  } catch (error) {
    console.warn("Failed to load site language config in middleware:", error);
  }

  const siteLanguageState = resolveSiteLanguage(resolvedSiteConfig);
  const knownLanguageCodes = buildKnownLanguageCodes(
    resolvedSiteConfig,
    siteLanguageState
  );

  cachedLanguageRoutingState = {
    expiresAt: Date.now() + LANGUAGE_STATE_CACHE_TTL_MS,
    knownLanguageCodes,
    siteLanguageState,
  };

  return {
    knownLanguageCodes,
    siteLanguageState,
  };
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

export async function middleware(request: NextRequest) {
  const { knownLanguageCodes, siteLanguageState } = await getLanguageRoutingState();
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
