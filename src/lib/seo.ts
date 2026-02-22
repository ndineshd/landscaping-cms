import type { Metadata } from "next";

import { createLocalizedPath } from "@/lib/site-i18n";

const BASE_URL_ENV_KEYS = [
  "NEXT_PUBLIC_SITE_URL",
  "SITE_URL",
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

export function parseKeywords(value: string | undefined): string[] | undefined {
  if (!value) return undefined;
  const keywords = value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  return keywords.length > 0 ? keywords : undefined;
}

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
