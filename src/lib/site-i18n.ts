import type { LanguageConfig, SiteConfig } from "@/types/config";

const LANGUAGE_NAME_MAP: Record<string, string> = {
  en: "English",
  tel: "Telugu",
  te: "Telugu",
  hi: "Hindi",
  ta: "Tamil",
  kn: "Kannada",
  ml: "Malayalam",
  mr: "Marathi",
  bn: "Bengali",
  gu: "Gujarati",
};

interface PathParts {
  hash: string;
  pathname: string;
  search: string;
}

export interface SiteLanguageState {
  currentLanguageCode: string;
  defaultLanguageCode: string;
  languageCodes: string[];
  languages: LanguageConfig[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function splitPath(path: string): PathParts {
  const hashIndex = path.indexOf("#");
  const hash = hashIndex >= 0 ? path.slice(hashIndex) : "";
  const withoutHash = hashIndex >= 0 ? path.slice(0, hashIndex) : path;
  const searchIndex = withoutHash.indexOf("?");
  const search = searchIndex >= 0 ? withoutHash.slice(searchIndex) : "";
  const pathname = searchIndex >= 0 ? withoutHash.slice(0, searchIndex) : withoutHash;

  return {
    hash,
    pathname,
    search,
  };
}

function fallbackLanguageName(code: string): string {
  const normalizedCode = normalizeLanguageCode(code);
  if (LANGUAGE_NAME_MAP[normalizedCode]) {
    return LANGUAGE_NAME_MAP[normalizedCode];
  }
  if (!normalizedCode) {
    return "Language";
  }
  return normalizedCode.toUpperCase();
}

function parseLanguageVariantKey(
  key: string,
  languageCodeSet: Set<string>
): { baseKey: string; languageCode: string } | null {
  const separatorIndex = key.lastIndexOf("_");
  if (separatorIndex <= 0 || separatorIndex === key.length - 1) {
    return null;
  }

  const baseKey = key.slice(0, separatorIndex);
  const languageCode = normalizeLanguageCode(key.slice(separatorIndex + 1));
  if (!baseKey || !languageCodeSet.has(languageCode)) {
    return null;
  }

  return { baseKey, languageCode };
}

function localizeNode(
  value: unknown,
  languageCode: string,
  languageCodeSet: Set<string>
): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => localizeNode(entry, languageCode, languageCodeSet));
  }

  if (!isRecord(value)) {
    return value;
  }

  const baseEntries = new Map<string, unknown>();
  const languageVariants = new Map<string, Map<string, unknown>>();

  Object.entries(value).forEach(([key, entryValue]) => {
    const variantMeta = parseLanguageVariantKey(key, languageCodeSet);
    if (!variantMeta) {
      baseEntries.set(key, entryValue);
      return;
    }

    if (!languageVariants.has(variantMeta.baseKey)) {
      languageVariants.set(variantMeta.baseKey, new Map<string, unknown>());
    }
    languageVariants.get(variantMeta.baseKey)?.set(variantMeta.languageCode, entryValue);
  });

  const localizedRecord: Record<string, unknown> = {};

  baseEntries.forEach((baseValue, key) => {
    const variants = languageVariants.get(key);
    const selectedValue =
      variants && variants.has(languageCode) ? variants.get(languageCode) : baseValue;
    localizedRecord[key] = localizeNode(selectedValue, languageCode, languageCodeSet);
  });

  languageVariants.forEach((variants, baseKey) => {
    if (baseEntries.has(baseKey)) return;
    const selectedValue = variants.get(languageCode) ?? variants.values().next().value;
    localizedRecord[baseKey] = localizeNode(selectedValue, languageCode, languageCodeSet);
  });

  return localizedRecord;
}

export function normalizeLanguageCode(code: string): string {
  return code.trim().toLowerCase();
}

export function resolveSiteLanguage(
  siteConfig: SiteConfig,
  requestedLanguageCode?: string
): SiteLanguageState {
  const normalizedDefaultLanguage = normalizeLanguageCode(
    siteConfig.defaultLanguage || "en"
  );
  const normalizedConfiguredLanguages = Array.isArray(siteConfig.languages)
    ? siteConfig.languages
        .map((language) => {
          const code = normalizeLanguageCode(language?.code || "");
          if (!code) return null;
          return {
            code,
            name: (language.name || "").trim() || fallbackLanguageName(code),
          };
        })
        .filter((language): language is LanguageConfig => Boolean(language))
    : [];
  const normalizedAvailableLanguages = Array.isArray(siteConfig.availableLanguages)
    ? siteConfig.availableLanguages
        .map((code) => normalizeLanguageCode(code || ""))
        .filter(Boolean)
    : [];
  const allKnownLanguageCodes = Array.from(
    new Set<string>([
      "en",
      normalizedDefaultLanguage || "en",
      ...normalizedConfiguredLanguages.map((language) => language.code),
      ...normalizedAvailableLanguages,
    ])
  );
  const activeLanguageCodes = Array.from(
    new Set<string>(
      (
        normalizedAvailableLanguages.length > 0
          ? normalizedAvailableLanguages
          : allKnownLanguageCodes
      ).filter((code) => allKnownLanguageCodes.includes(code))
    )
  );
  if (!activeLanguageCodes.includes(normalizedDefaultLanguage)) {
    activeLanguageCodes.push(normalizedDefaultLanguage);
  }
  if (!activeLanguageCodes.includes("en")) {
    activeLanguageCodes.push("en");
  }

  const safeDefaultLanguage = activeLanguageCodes.includes(normalizedDefaultLanguage)
    ? normalizedDefaultLanguage
    : "en";
  const requestedCode = normalizeLanguageCode(requestedLanguageCode || "");
  const currentLanguageCode = activeLanguageCodes.includes(requestedCode)
    ? requestedCode
    : safeDefaultLanguage;
  const languageByCode = new Map<string, LanguageConfig>();

  normalizedConfiguredLanguages.forEach((language) => {
    languageByCode.set(language.code, language);
  });

  return {
    currentLanguageCode,
    defaultLanguageCode: safeDefaultLanguage,
    languageCodes: activeLanguageCodes,
    languages: activeLanguageCodes.map((code) => {
      return (
        languageByCode.get(code) || {
          code,
          name: fallbackLanguageName(code),
        }
      );
    }),
  };
}

export function getLanguageFromPathname(
  pathname: string,
  languageCodes: string[]
): string | null {
  const normalizedPathname = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const [firstSegment] = normalizedPathname.split("/").filter(Boolean);
  if (!firstSegment) {
    return null;
  }

  const normalizedFirstSegment = normalizeLanguageCode(firstSegment);
  const normalizedLanguageCodes = new Set(
    languageCodes.map((code) => normalizeLanguageCode(code))
  );

  return normalizedLanguageCodes.has(normalizedFirstSegment)
    ? normalizedFirstSegment
    : null;
}

export function stripLanguagePrefixFromPath(
  path: string,
  languageCodes: string[]
): string {
  const { hash, pathname, search } = splitPath(path || "/");
  const normalizedPathname = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const segments = normalizedPathname.split("/").filter(Boolean);
  const firstSegment = segments[0] ? normalizeLanguageCode(segments[0]) : "";
  const normalizedLanguageCodes = new Set(
    languageCodes.map((code) => normalizeLanguageCode(code))
  );

  if (!firstSegment || !normalizedLanguageCodes.has(firstSegment)) {
    return `${normalizedPathname}${search}${hash}`;
  }

  const strippedPathname = segments.length > 1 ? `/${segments.slice(1).join("/")}` : "/";
  return `${strippedPathname}${search}${hash}`;
}

export function createLocalizedPath(
  path: string,
  languageCode: string,
  languageCodes: string[]
): string {
  if (!path) {
    return `/${normalizeLanguageCode(languageCode)}`;
  }

  if (path.startsWith("#") || path.startsWith("?")) {
    return path;
  }
  if (/^[a-z][a-z0-9+\-.]*:/i.test(path) || path.startsWith("//")) {
    return path;
  }

  const { hash, pathname, search } = splitPath(path);
  const normalizedPathname = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const pathWithoutLanguage = stripLanguagePrefixFromPath(
    normalizedPathname,
    languageCodes
  );
  const targetLanguageCode = normalizeLanguageCode(languageCode || "en");
  const localizedPathname =
    pathWithoutLanguage === "/"
      ? `/${targetLanguageCode}`
      : `/${targetLanguageCode}${pathWithoutLanguage}`;

  return `${localizedPathname}${search}${hash}`;
}

export function localizeContentByLanguage<T>(
  value: T,
  languageCode: string,
  languageCodes: string[]
): T {
  const normalizedLanguageCode = normalizeLanguageCode(languageCode);
  const normalizedLanguageCodes = Array.from(
    new Set(languageCodes.map((code) => normalizeLanguageCode(code)).filter(Boolean))
  );
  const effectiveLanguageCodes = normalizedLanguageCodes.includes(normalizedLanguageCode)
    ? normalizedLanguageCodes
    : Array.from(new Set([...normalizedLanguageCodes, normalizedLanguageCode]));

  return localizeNode(
    value,
    normalizedLanguageCode,
    new Set(effectiveLanguageCodes)
  ) as T;
}
