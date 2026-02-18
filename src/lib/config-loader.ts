/**
 * Configuration loader utilities
 * Provides type-safe access to all application configuration files
 */

import type {
  AdminConfig,
  AdminSettings,
  SiteConfig,
  ThemeConfig,
  ContactConfig,
  SEOConfig,
} from "@/types/config";
import type { Project, Service, Translations } from "@/types/content";

/**
 * Loads and caches JSON configuration files
 * Uses server-side import to read JSON files at build time or runtime
 */
class ConfigLoader {
  /** Cache for loaded configurations */
  private cache: Map<string, unknown> = new Map();

  /**
   * Load admin settings (PIN, session timeout)
   * @returns Admin settings configuration
   */
  async loadAdminSettings(): Promise<AdminSettings> {
    const cacheKey = "admin-settings";
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey) as AdminSettings;
    }

    try {
      const settings = await import("@/data/defaults/admin.json");
      const typedSettings = settings.default as AdminSettings;
      this.cache.set(cacheKey, typedSettings);
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
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey) as AdminConfig;
    }

    try {
      const config = await import("@/data/content/admin.config.json");
      const typedConfig = config.default as AdminConfig;
      this.cache.set(cacheKey, typedConfig);
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
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey) as Project[];
    }

    try {
      const projects = await import("@/data/content/projects.json");
      const typedProjects = (projects.default as Project[]).filter(
        (p) => p.enabled
      );
      this.cache.set(cacheKey, typedProjects);
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
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey) as Service[];
    }

    try {
      const services = await import("@/data/content/services.json");
      const typedServices = (services.default as Service[]).filter(
        (s) => s.enabled
      );
      this.cache.set(cacheKey, typedServices);
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
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey) as Translations;
    }

    try {
      const translations = await import("@/data/content/translations.json");
      const typedTranslations = translations.default as Translations;
      this.cache.set(cacheKey, typedTranslations);
      return typedTranslations;
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
    const allTranslations = await this.loadTranslations();
    const translations = allTranslations[languageCode];

    if (!translations) {
      console.warn(`Translations for language '${languageCode}' not found`);
      return allTranslations[Object.keys(allTranslations)[0]];
    }

    return translations;
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
