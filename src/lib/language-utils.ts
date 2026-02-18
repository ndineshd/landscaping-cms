import type { DataItem } from "@/types/cms";

export const DEFAULT_LANGUAGE_CODE = "en";

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

const NON_TRANSLATABLE_TEXT_KEYS = new Set<string>([
  "id",
  "image",
  "icon",
  "slug",
  "path",
  "email",
  "phone",
  "number",
  "code",
  "url",
  "link",
  "desktop",
  "mobile",
  "sortorder",
]);

const NON_TRANSLATABLE_SUFFIXES = [
  "id",
  "url",
  "image",
  "images",
  "icon",
  "slug",
  "path",
  "email",
  "phone",
  "number",
  "date",
];

export interface LanguageOption {
  name: string;
  code: string;
}

export interface LanguageConfigState {
  defaultLanguage: string;
  languageCodes: string[];
  activeLanguageCodes: string[];
  languages: LanguageOption[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function normalizeLanguageCode(code: string): string {
  return code.trim().toLowerCase();
}

export function createLanguageLabel(code: string): string {
  const normalized = normalizeLanguageCode(code);
  if (LANGUAGE_NAME_MAP[normalized]) {
    return LANGUAGE_NAME_MAP[normalized];
  }
  if (!normalized) {
    return "Language";
  }
  return normalized.toUpperCase();
}

export function normalizeLanguageConfig(
  languages: LanguageOption[],
  defaultLanguage: string,
  activeLanguageCodesInput?: string[]
): LanguageConfigState {
  const normalizedDefault = normalizeLanguageCode(defaultLanguage || DEFAULT_LANGUAGE_CODE);
  const languageMap = new Map<string, LanguageOption>();
  const orderedCodes: string[] = [];

  const register = (codeInput: string, nameInput?: string) => {
    const code = normalizeLanguageCode(codeInput);
    if (!code) return;

    if (!languageMap.has(code)) {
      orderedCodes.push(code);
    }

    const fallbackName = createLanguageLabel(code);
    const existing = languageMap.get(code);
    const nextName = (nameInput || "").trim() || existing?.name || fallbackName;
    languageMap.set(code, { code, name: nextName });
  };

  register(DEFAULT_LANGUAGE_CODE, "English");
  register(normalizedDefault);

  languages.forEach((language) => {
    if (!language) return;
    register(language.code, language.name);
  });

  const languageCodes = orderedCodes.filter(Boolean);
  const safeDefault = languageCodes.includes(normalizedDefault)
    ? normalizedDefault
    : DEFAULT_LANGUAGE_CODE;

  const normalizedLanguages = languageCodes.map((code) => {
    return (
      languageMap.get(code) || {
        code,
        name: createLanguageLabel(code),
      }
    );
  });

  const requestedActiveCodes = Array.isArray(activeLanguageCodesInput)
    ? activeLanguageCodesInput.map((code) => normalizeLanguageCode(code)).filter(Boolean)
    : [];

  const activeLanguageCodes = Array.from(
    new Set(
      (
        requestedActiveCodes.length > 0
          ? requestedActiveCodes
          : languageCodes
      ).filter((code) => languageCodes.includes(code))
    )
  );

  if (!activeLanguageCodes.includes(safeDefault)) {
    activeLanguageCodes.push(safeDefault);
  }
  if (
    languageCodes.includes(DEFAULT_LANGUAGE_CODE) &&
    !activeLanguageCodes.includes(DEFAULT_LANGUAGE_CODE)
  ) {
    activeLanguageCodes.push(DEFAULT_LANGUAGE_CODE);
  }

  return {
    defaultLanguage: safeDefault,
    languageCodes,
    activeLanguageCodes,
    languages: normalizedLanguages,
  };
}

export function extractLanguageConfig(
  adminConfig: Record<string, unknown>
): LanguageConfigState {
  const site = isRecord(adminConfig.site)
    ? adminConfig.site
    : ({} as Record<string, unknown>);

  const fromLanguages: LanguageOption[] = Array.isArray(site.languages)
    ? site.languages
        .map((entry) => {
          if (!isRecord(entry)) return null;
          const code = typeof entry.code === "string" ? entry.code : "";
          if (!code) return null;
          const name =
            typeof entry.name === "string"
              ? entry.name
              : createLanguageLabel(code);
          return {
            code: normalizeLanguageCode(code),
            name: name.trim() || createLanguageLabel(code),
          };
        })
        .filter((entry): entry is LanguageOption => Boolean(entry))
    : [];

  const fromAvailableCodes: string[] = Array.isArray(site.availableLanguages)
    ? site.availableLanguages
        .filter((code): code is string => typeof code === "string")
        .map((code) => normalizeLanguageCode(code))
    : [];

  const defaultLanguage =
    typeof site.defaultLanguage === "string"
      ? site.defaultLanguage
      : DEFAULT_LANGUAGE_CODE;

  return normalizeLanguageConfig(
    fromLanguages,
    defaultLanguage,
    fromAvailableCodes
  );
}

export function applyLanguageConfigToAdminConfig(
  adminConfig: Record<string, unknown>,
  languageConfigInput?: LanguageConfigState
): {
  adminConfig: Record<string, unknown>;
  languageConfig: LanguageConfigState;
  changed: boolean;
} {
  const languageConfig =
    languageConfigInput || extractLanguageConfig(adminConfig);
  const site = isRecord(adminConfig.site)
    ? adminConfig.site
    : ({} as Record<string, unknown>);

  const nextSite: Record<string, unknown> = {
    ...site,
    defaultLanguage: languageConfig.defaultLanguage,
    availableLanguages: [...languageConfig.activeLanguageCodes],
    languages: languageConfig.languages.map((language) => ({
      code: language.code,
      name: language.name,
    })),
  };

  const changed =
    JSON.stringify(site.defaultLanguage) !==
      JSON.stringify(nextSite.defaultLanguage) ||
    JSON.stringify(site.availableLanguages) !==
      JSON.stringify(nextSite.availableLanguages) ||
    JSON.stringify(site.languages) !== JSON.stringify(nextSite.languages);

  return {
    adminConfig: {
      ...adminConfig,
      site: nextSite,
    },
    languageConfig,
    changed,
  };
}

export function buildLocalizedFieldKey(
  baseKey: string,
  languageCode: string
): string {
  return `${baseKey}_${normalizeLanguageCode(languageCode)}`;
}

export function isLanguageVariantKey(
  key: string,
  languageCodes: string[]
): boolean {
  const normalizedKey = key.toLowerCase();
  return languageCodes.some((code) =>
    normalizedKey.endsWith(`_${normalizeLanguageCode(code)}`)
  );
}

export function isTranslatableTextField(
  fieldName: string,
  value: unknown,
  languageCodes: string[]
): boolean {
  if (typeof value !== "string") return false;

  const normalizedField = fieldName.trim().toLowerCase();
  if (!normalizedField) return false;
  if (isLanguageVariantKey(normalizedField, languageCodes)) return false;
  if (NON_TRANSLATABLE_TEXT_KEYS.has(normalizedField)) return false;

  if (
    NON_TRANSLATABLE_SUFFIXES.some((suffix) =>
      normalizedField.endsWith(suffix)
    )
  ) {
    return false;
  }

  return true;
}

function ensureLocalizedNode(
  value: unknown,
  languageCodes: string[],
  defaultLanguage: string
): { value: unknown; changed: boolean } {
  if (Array.isArray(value)) {
    let changed = false;
    const nextArray = value.map((entry) => {
      const normalized = ensureLocalizedNode(entry, languageCodes, defaultLanguage);
      if (normalized.changed) changed = true;
      return normalized.value;
    });
    return { value: nextArray, changed };
  }

  if (!isRecord(value)) {
    return { value, changed: false };
  }

  const nextRecord: Record<string, unknown> = { ...value };
  const entries = Object.entries(value);
  const activeLanguageCodes = new Set(
    languageCodes.map((code) => normalizeLanguageCode(code))
  );
  let changed = false;

  const parseLanguageVariant = (
    key: string
  ): { languageCode: string } | null => {
    const separatorIndex = key.lastIndexOf("_");
    if (separatorIndex <= 0 || separatorIndex === key.length - 1) {
      return null;
    }

    const baseKey = key.slice(0, separatorIndex);
    const suffix = normalizeLanguageCode(key.slice(separatorIndex + 1));

    if (!/^[a-z]{2,8}$/.test(suffix)) {
      return null;
    }
    if (
      NON_TRANSLATABLE_SUFFIXES.includes(suffix) ||
      NON_TRANSLATABLE_TEXT_KEYS.has(suffix)
    ) {
      return null;
    }
    if (!Object.prototype.hasOwnProperty.call(nextRecord, baseKey)) {
      return null;
    }

    const baseValue = nextRecord[baseKey];
    if (!isTranslatableTextField(baseKey, baseValue, [...languageCodes, suffix])) {
      return null;
    }

    return { languageCode: suffix };
  };

  entries.forEach(([key, entryValue]) => {
    const normalizedEntry = ensureLocalizedNode(
      entryValue,
      languageCodes,
      defaultLanguage
    );
    if (normalizedEntry.changed) {
      changed = true;
      nextRecord[key] = normalizedEntry.value;
    }
  });

  entries.forEach(([key]) => {
    const languageVariant = parseLanguageVariant(key);
    if (!languageVariant) return;
    if (activeLanguageCodes.has(languageVariant.languageCode)) return;

    delete nextRecord[key];
    changed = true;
  });

  entries.forEach(([key, entryValue]) => {
    if (parseLanguageVariant(key)) {
      return;
    }

    if (!isTranslatableTextField(key, entryValue, languageCodes)) {
      return;
    }

    languageCodes.forEach((code) => {
      if (code === defaultLanguage) return;
      const localizedKey = buildLocalizedFieldKey(key, code);
      if (Object.prototype.hasOwnProperty.call(nextRecord, localizedKey)) {
        return;
      }
      nextRecord[localizedKey] = entryValue;
      changed = true;
    });
  });

  return { value: nextRecord, changed };
}

export function ensureLocalizedContentItems(
  items: DataItem[],
  languageCodes: string[],
  defaultLanguage: string
): { items: DataItem[]; changed: boolean } {
  let changed = false;

  const normalizedItems = items.map((item) => {
    const normalized = ensureLocalizedNode(item, languageCodes, defaultLanguage);
    if (normalized.changed) changed = true;
    return normalized.value as DataItem;
  });

  return { items: normalizedItems, changed };
}
