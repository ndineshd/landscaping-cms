/**
 * Configuration loader utilities
 * Provides type-safe access to all application configuration files
 */

import { readFile } from "fs/promises";
import { join } from "path";

import type {
  AdminConfig,
  AdminSettings,
  SiteConfig,
  LanguageConfig,
  ThemeConfig,
  ContactConfig,
  SEOConfig,
} from "@/types/config";
import type { Project, Service, Translations } from "@/types/content";
import { createGitHubAPI, type GitHubAPI } from "@/lib/github-api";

function normalizeLanguageCode(code: string): string {
  return code.trim().toLowerCase();
}

function createLanguageLabel(code: string): string {
  if (code === "en") return "English";
  return code.toUpperCase();
}

function deepMerge(base: unknown, override: unknown): unknown {
  if (override === undefined || override === null) {
    return base;
  }

  if (
    typeof base === "object" &&
    base !== null &&
    !Array.isArray(base) &&
    typeof override === "object" &&
    override !== null &&
    !Array.isArray(override)
  ) {
    const merged: Record<string, unknown> = {
      ...(base as Record<string, unknown>),
    };

    Object.entries(override as Record<string, unknown>).forEach(
      ([key, value]) => {
        merged[key] = deepMerge(merged[key], value);
      }
    );

    return merged;
  }

  return override;
}

function normalizeSiteConfig(site: SiteConfig): SiteConfig {
  const normalizedDefault = normalizeLanguageCode(site.defaultLanguage || "en");
  const normalizedLanguages =
    (site.languages || [])
      .filter((lang) => Boolean(lang?.code))
      .map((lang) => ({
        name: lang.name?.trim() || createLanguageLabel(normalizeLanguageCode(lang.code)),
        code: normalizeLanguageCode(lang.code),
      })) || [];

  const fromAvailable =
    (site.availableLanguages || [])
      .filter(Boolean)
      .map((code) => normalizeLanguageCode(code)) || [];

  const allLanguageCodes = Array.from(
    new Set<string>([
      "en",
      normalizedDefault,
      ...normalizedLanguages.map((lang) => lang.code),
    ].filter(Boolean))
  );

  const languageMap = new Map<string, LanguageConfig>();
  normalizedLanguages.forEach((lang) => {
    languageMap.set(lang.code, lang);
  });

  const languages = allLanguageCodes.map((code) => {
    return (
      languageMap.get(code) || {
        name: createLanguageLabel(code),
        code,
      }
    );
  });

  const defaultLanguage = allLanguageCodes.includes(normalizedDefault)
    ? normalizedDefault
    : "en";
  const activeLanguageCodes = Array.from(
    new Set<string>(
      (fromAvailable.length > 0 ? fromAvailable : allLanguageCodes).filter((code) =>
        allLanguageCodes.includes(code)
      )
    )
  );

  if (!activeLanguageCodes.includes(defaultLanguage)) {
    activeLanguageCodes.push(defaultLanguage);
  }
  if (!activeLanguageCodes.includes("en")) {
    activeLanguageCodes.push("en");
  }

  return {
    ...site,
    defaultLanguage,
    languages,
    availableLanguages: activeLanguageCodes,
  };
}

function normalizeAdminConfig(config: AdminConfig): AdminConfig {
  return {
    ...config,
    site: normalizeSiteConfig(config.site),
  };
}

function ensureTranslationsForLanguages(
  translations: Translations,
  languageCodes: string[],
  fallbackLanguageCode: string
): Translations {
  const normalizedCodes = Array.from(
    new Set(languageCodes.map((code) => normalizeLanguageCode(code)).filter(Boolean))
  );
  const normalizedFallbackCode = normalizeLanguageCode(fallbackLanguageCode);
  const sanitizedTranslations: Translations = {};

  Object.entries(translations).forEach(([code, value]) => {
    const normalizedCode = normalizeLanguageCode(code);
    if (!normalizedCodes.includes(normalizedCode)) return;
    sanitizedTranslations[normalizedCode] = value;
  });

  const firstLanguageCode = Object.keys(sanitizedTranslations)[0];
  const fallbackCode = normalizedCodes.includes(normalizedFallbackCode)
    ? normalizedFallbackCode
    : "en";
  const fallbackTranslations =
    sanitizedTranslations[fallbackCode] ||
    sanitizedTranslations.en ||
    (firstLanguageCode ? sanitizedTranslations[firstLanguageCode] : {});

  const normalizedTranslations: Translations = {};
  normalizedCodes.forEach((code) => {
    normalizedTranslations[code] = deepMerge(
      fallbackTranslations,
      sanitizedTranslations[code]
    ) as Translations[string];
  });

  return normalizedTranslations;
}

/**
 * Loads and caches JSON configuration files
 * Uses server-side import to read JSON files at build time or runtime
 */
class ConfigLoader {
  /** Cache for loaded configurations */
  private cache: Map<string, { value: unknown; expiresAt: number }> = new Map();
  private githubAPI: GitHubAPI | null = null;

  private getContentCacheTTLMS(): number {
    const rawValue = process.env.CONTENT_CACHE_TTL_SECONDS;
    const parsedValue = Number(rawValue);
    if (Number.isFinite(parsedValue) && parsedValue >= 0) {
      return parsedValue * 1000;
    }
    return 30_000;
  }

  private shouldUseContentCache(): boolean {
    return process.env.NODE_ENV !== "development" && this.getContentCacheTTLMS() > 0;
  }

  private getCachedValue<T>(cacheKey: string): T | null {
    const cachedEntry = this.cache.get(cacheKey);
    if (!cachedEntry) {
      return null;
    }

    if (cachedEntry.expiresAt <= Date.now()) {
      this.cache.delete(cacheKey);
      return null;
    }

    return cachedEntry.value as T;
  }

  private setCachedValue(cacheKey: string, value: unknown): void {
    if (!this.shouldUseContentCache()) {
      return;
    }

    const ttlMS = this.getContentCacheTTLMS();
    this.cache.set(cacheKey, {
      value,
      expiresAt: Date.now() + ttlMS,
    });
  }

  private canUseGitHubContentSource(): boolean {
    return Boolean(
      process.env.GITHUB_TOKEN &&
        process.env.GITHUB_OWNER &&
        process.env.GITHUB_REPO
    );
  }

  private getGitHubAPI(): GitHubAPI {
    if (!this.githubAPI) {
      this.githubAPI = createGitHubAPI();
    }
    return this.githubAPI;
  }

  private async loadContentJSON<T>(
    relativePath: string,
    importer: () => Promise<{ default: unknown }>
  ): Promise<T> {
    if (process.env.NODE_ENV === "development") {
      const fullPath = join(process.cwd(), relativePath);
      const raw = await readFile(fullPath, "utf-8");
      return JSON.parse(raw) as T;
    }

    if (this.canUseGitHubContentSource()) {
      try {
        const github = this.getGitHubAPI();
        const fileData = await github.getFile(relativePath);
        if (!fileData.content) {
          throw new Error(`GitHub response did not include file content: ${relativePath}`);
        }
        const decodedContent = Buffer.from(fileData.content, "base64").toString("utf-8");
        return JSON.parse(decodedContent) as T;
      } catch (error) {
        console.warn(
          `Falling back to bundled content for ${relativePath} because GitHub source failed`,
          error
        );
      }
    }

    const module = await importer();
    return module.default as T;
  }

  /**
   * Load admin settings (PIN, session timeout)
   * @returns Admin settings configuration
   */
  async loadAdminSettings(): Promise<AdminSettings> {
    const cacheKey = "admin-settings";
    const cachedValue = this.getCachedValue<AdminSettings>(cacheKey);
    if (cachedValue) {
      return cachedValue;
    }

    try {
      const settings = await import("@/data/defaults/admin.json");
      const typedSettings = settings.default as AdminSettings;
      this.setCachedValue(cacheKey, typedSettings);
      return typedSettings;
    } catch (error) {
      console.error("Failed to load admin settings:", error);
      throw new Error("Could not load admin settings configuration");
    }
  }

  /**
   * Load main admin/site configuration
   * @returns Complete admin configuration
   */
  async loadAdminConfig(): Promise<AdminConfig> {
    const cacheKey = "admin-config";
    const cachedValue = this.getCachedValue<AdminConfig>(cacheKey);
    if (cachedValue) {
      return cachedValue;
    }

    try {
      const config = await this.loadContentJSON<AdminConfig>(
        "src/data/content/admin.config.json",
        () => import("@/data/content/admin.config.json")
      );
      const typedConfig = normalizeAdminConfig(config);
      this.setCachedValue(cacheKey, typedConfig);
      return typedConfig;
    } catch (error) {
      console.error("Failed to load admin config:", error);
      throw new Error("Could not load admin configuration");
    }
  }

  /**
   * Load site configuration
   * @returns Site configuration object
   */
  async loadSiteConfig(): Promise<SiteConfig> {
    const adminConfig = await this.loadAdminConfig();
    return adminConfig.site;
  }

  /**
   * Load SEO configuration
   * @returns SEO configuration object
   */
  async loadSEOConfig(): Promise<SEOConfig> {
    const adminConfig = await this.loadAdminConfig();
    return adminConfig.seo;
  }

  /**
   * Load theme configuration
   * @returns Theme configuration object
   */
  async loadThemeConfig(): Promise<ThemeConfig> {
    const adminConfig = await this.loadAdminConfig();
    return adminConfig.theme;
  }

  /**
   * Load contact configuration
   * @returns Contact configuration object
   */
  async loadContactConfig(): Promise<ContactConfig> {
    const adminConfig = await this.loadAdminConfig();
    return adminConfig.contact;
  }

  /**
   * Load all projects
   * @returns Array of all enabled projects
   */
  async loadProjects(): Promise<Project[]> {
    const cacheKey = "projects";
    const cachedValue = this.getCachedValue<Project[]>(cacheKey);
    if (cachedValue) {
      return cachedValue;
    }

    try {
      const projects = await this.loadContentJSON<Project[]>(
        "src/data/content/projects.json",
        () => import("@/data/content/projects.json")
      );
      const typedProjects = projects.filter(
        (p) => p.enabled
      );
      this.setCachedValue(cacheKey, typedProjects);
      return typedProjects;
    } catch (error) {
      console.error("Failed to load projects:", error);
      throw new Error("Could not load projects configuration");
    }
  }

  /**
   * Load a single project by ID
   * @param id - Project ID
   * @returns Project object or undefined if not found
   */
  async loadProjectById(id: string): Promise<Project | undefined> {
    const projects = await this.loadProjects();
    return projects.find((p) => p.id === id);
  }

  /**
   * Load all services
   * @returns Array of all enabled services
   */
  async loadServices(): Promise<Service[]> {
    const cacheKey = "services";
    const cachedValue = this.getCachedValue<Service[]>(cacheKey);
    if (cachedValue) {
      return cachedValue;
    }

    try {
      const services = await this.loadContentJSON<Service[]>(
        "src/data/content/services.json",
        () => import("@/data/content/services.json")
      );
      const typedServices = services.filter(
        (s) => s.enabled
      );
      this.setCachedValue(cacheKey, typedServices);
      return typedServices;
    } catch (error) {
      console.error("Failed to load services:", error);
      throw new Error("Could not load services configuration");
    }
  }

  /**
   * Load a single service by ID
   * @param id - Service ID
   * @returns Service object or undefined if not found
   */
  async loadServiceById(id: string): Promise<Service | undefined> {
    const services = await this.loadServices();
    return services.find((s) => s.id === id);
  }

  /**
   * Load translations for all languages
   * @returns All translations object
   */
  async loadTranslations(): Promise<Translations> {
    const cacheKey = "translations";
    const cachedValue = this.getCachedValue<Translations>(cacheKey);
    if (cachedValue) {
      return cachedValue;
    }

    try {
      const adminConfig = await this.loadAdminConfig();
      const typedTranslations = await this.loadContentJSON<Translations>(
        "src/data/content/translations.json",
        () => import("@/data/content/translations.json")
      );
      const configuredLanguageCodes =
        (adminConfig.site.availableLanguages &&
        adminConfig.site.availableLanguages.length > 0
          ? adminConfig.site.availableLanguages
          : adminConfig.site.languages?.map((lang) => lang.code)) || ["en"];
      const normalizedTranslations = ensureTranslationsForLanguages(
        typedTranslations,
        configuredLanguageCodes,
        adminConfig.site.defaultLanguage || "en"
      );
      this.setCachedValue(cacheKey, normalizedTranslations);
      return normalizedTranslations;
    } catch (error) {
      console.error("Failed to load translations:", error);
      throw new Error("Could not load translations");
    }
  }

  /**
   * Load translations for a specific language
   * @param languageCode - Language code (e.g., 'en', 'fr')
   * @returns Translations for the specified language
   */
  async loadLanguageTranslations(languageCode: string) {
    const normalizedLanguageCode = normalizeLanguageCode(languageCode);
    const allTranslations = await this.loadTranslations();
    const adminConfig = await this.loadAdminConfig();
    const fallbackCode = normalizeLanguageCode(
      adminConfig.site.defaultLanguage || "en"
    );
    const firstLanguageCode = Object.keys(allTranslations)[0];
    const fallbackTranslations =
      allTranslations[fallbackCode] ||
      allTranslations.en ||
      (firstLanguageCode ? allTranslations[firstLanguageCode] : {});
    const translations = allTranslations[normalizedLanguageCode];

    if (!translations) {
      console.warn(
        `Translations for language '${normalizedLanguageCode}' not found, using fallback '${fallbackCode}'`
      );
      return fallbackTranslations;
    }

    return deepMerge(fallbackTranslations, translations) as Translations[string];
  }

  /**
   * Clear the configuration cache
   * Useful for development or when configurations are updated
   */
  clearCache(): void {
    this.cache.clear();
  }
}

/** Singleton instance of ConfigLoader */
export const configLoader = new ConfigLoader();

/**
 * Get a translation string by key
 * @param key - Translation key (can use dot notation for nested keys, e.g., 'nav.home')
 * @param languageCode - Language code
 * @returns Translated string or key if not found
 */
export async function getTranslation(
  key: string,
  languageCode: string = "en"
): Promise<string> {
  try {
    const translations = await configLoader.loadLanguageTranslations(
      languageCode
    );
    const keys = key.split(".");
    let value: unknown = translations;

    for (const k of keys) {
      if (typeof value === "object" && value !== null && k in value) {
        value = (value as Record<string, unknown>)[k];
      } else {
        return key;
      }
    }

    return typeof value === "string" ? value : key;
  } catch (error) {
    console.error(`Failed to get translation for key '${key}':`, error);
    return key;
  }
}

/**
 * Export utility for getting all active projects sorted by sortOrder
 */
export async function getActiveProjects(): Promise<Project[]> {
  const projects = await configLoader.loadProjects();
  return projects.sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * Export utility for getting all active services sorted by sortOrder
 */
export async function getActiveServices(): Promise<Service[]> {
  const services = await configLoader.loadServices();
  return services.sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * Export utility for getting projects by category
 */
export async function getProjectsByCategory(category: string): Promise<Project[]> {
  const projects = await getActiveProjects();
  return projects.filter((p) => p.category === category);
}
