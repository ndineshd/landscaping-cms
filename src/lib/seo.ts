import type { Metadata } from "next";

import { createLocalizedPath } from "@/lib/site-i18n";

const BASE_URL_ENV_KEYS = [
  "NEXT_PUBLIC_SITE_URL",
  "SITE_URL",
  "VERCEL_PROJECT_PRODUCTION_URL",
  "VERCEL_URL",
  "NEXT_PUBLIC_API_URL",
] as const;

function normalizeBaseUrl(value: string): string {
  const trimmed = value.trim();

  if (!trimmed) return "";

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

/**
 * Resolves the metadata base URL from environment variables with safe fallback.
 */
export function resolveMetadataBase(): URL {
  for (const envKey of BASE_URL_ENV_KEYS) {
    const rawValue = process.env[envKey];

    if (!rawValue) continue;

    const candidate = normalizeBaseUrl(rawValue);

    if (!candidate) continue;

    try {
      const url = new URL(candidate);
      return new URL(`${url.protocol}//${url.host}`);
    } catch {
      continue;
    }
  }

  return new URL("http://localhost:3000");
}

/**
 * Converts a relative path (or passthrough absolute URL) into an absolute URL string.
 */
export function toAbsoluteUrl(pathOrUrl: string, metadataBase: URL): string {
  if (!pathOrUrl) {
    return metadataBase.toString();
  }

  if (/^https?:\/\//i.test(pathOrUrl)) {
    return pathOrUrl;
  }

  const normalizedPath = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return new URL(normalizedPath, metadataBase).toString();
}

/**
 * Splits and normalizes comma-separated keywords.
 */
export function parseKeywords(value: string | undefined): string[] | undefined {
  if (!value) return undefined;

  const keywords = value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  return keywords.length > 0 ? keywords : undefined;
}

/**
 * Builds canonical and alternate URLs for a localized route.
 */
export function buildPageAlternates(
  routePath: string,
  currentLanguageCode: string,
  languageCodes: string[],
  metadataBase: URL
): NonNullable<Metadata["alternates"]> {
  const safeLanguageCodes = languageCodes.length > 0 ? languageCodes : [currentLanguageCode];
  const languages: Record<string, string> = {};

  safeLanguageCodes.forEach((languageCode) => {
    languages[languageCode] = toAbsoluteUrl(
      createLocalizedPath(routePath, languageCode, safeLanguageCodes),
      metadataBase
    );
  });

  const canonicalPath = createLocalizedPath(
    routePath,
    currentLanguageCode,
    safeLanguageCodes
  );
  languages["x-default"] = toAbsoluteUrl(
    createLocalizedPath(routePath, safeLanguageCodes[0], safeLanguageCodes),
    metadataBase
  );

  return {
    canonical: toAbsoluteUrl(canonicalPath, metadataBase),
    languages,
  };
}
