import { configLoader, getActiveProjects, getActiveServices } from "@/lib/config-loader";
import { ROUTES } from "@/lib/constants";
import {
  createLocalizedPath,
  localizeContentByLanguage,
  normalizeLanguageCode,
  resolveSiteLanguage,
  type SiteLanguageState,
} from "@/lib/site-i18n";
import type { AdminConfig } from "@/types/config";
import type { LanguageTranslations, Project, Service } from "@/types/content";
import type { SiteFooterLabels, SiteNavItem } from "@/types/site";
import { headers } from "next/headers";

/**
 * Shared site data used by layout and pages.
 */
export interface SiteCommonData {
  adminConfig: AdminConfig;
  footerLabels: SiteFooterLabels;
  homeHref: string;
  language: SiteLanguageState;
  navItems: SiteNavItem[];
  translations: LanguageTranslations;
}

/**
 * Homepage data including services and projects.
 */
export interface SiteHomeData extends SiteCommonData {
  projects: Project[];
  services: Service[];
}

function getLabel(copy: Record<string, string>, fallback: string, key: string): string {
  return copy[key] || fallback;
}

function mapFooterLabels(copy: Record<string, string>): SiteFooterLabels {
  return {
    contactTitle: getLabel(copy, "Contact", "contactTitle"),
    copyright: getLabel(copy, "(c) 2026 GrowWell Landscapes Pvt Ltd. All rights reserved.", "copyright"),
    followUsTitle: getLabel(copy, "Follow Us", "followUsTitle"),
    privacyPolicy: getLabel(copy, "Privacy Policy", "privacyPolicy"),
    termsOfService: getLabel(copy, "Terms of Service", "termsOfService"),
  };
}

function mapNavigationItems(
  copy: Record<string, string>,
  language: SiteLanguageState
): SiteNavItem[] {
  return [
    {
      href: createLocalizedPath(
        ROUTES.HOME,
        language.currentLanguageCode,
        language.languageCodes
      ),
      label: getLabel(copy, "Home", "home"),
    },
    {
      href: createLocalizedPath(
        ROUTES.SERVICES,
        language.currentLanguageCode,
        language.languageCodes
      ),
      label: getLabel(copy, "Services", "services"),
    },
    {
      href: createLocalizedPath(
        ROUTES.CONTACT,
        language.currentLanguageCode,
        language.languageCodes
      ),
      label: getLabel(copy, "Contact Us", "contact"),
    },
  ];
}

function getRequestedLanguageFromHeaders(): string {
  try {
    const languageFromHeader = headers().get("x-site-lang");
    return normalizeLanguageCode(languageFromHeader || "");
  } catch {
    return "";
  }
}

export function localizeSiteContent<T>(
  value: T,
  language: SiteLanguageState
): T {
  return localizeContentByLanguage(
    value,
    language.currentLanguageCode,
    language.languageCodes
  );
}

/**
 * Loads data shared by all website pages.
 */
export async function getSiteCommonData(
  requestedLanguageCode?: string
): Promise<SiteCommonData> {
  const adminConfigRaw = await configLoader.loadAdminConfig();
  const language = resolveSiteLanguage(
    adminConfigRaw.site,
    requestedLanguageCode || getRequestedLanguageFromHeaders()
  );
  const adminConfig = localizeSiteContent(adminConfigRaw, language) as AdminConfig;
  const translations = await configLoader.loadLanguageTranslations(
    language.currentLanguageCode
  );
  const footerCopy = translations.footer || {};
  const navCopy = translations.nav || {};

  return {
    adminConfig,
    footerLabels: mapFooterLabels(footerCopy),
    homeHref: createLocalizedPath(
      ROUTES.HOME,
      language.currentLanguageCode,
      language.languageCodes
    ),
    language,
    navItems: mapNavigationItems(navCopy, language),
    translations,
  };
}

/**
 * Loads data for the homepage.
 */
export async function getSiteHomeData(): Promise<SiteHomeData> {
  const [commonData, projectsRaw, servicesRaw] = await Promise.all([
    getSiteCommonData(),
    getActiveProjects(),
    getActiveServices(),
  ]);
  const projects = localizeSiteContent(projectsRaw, commonData.language) as Project[];
  const services = localizeSiteContent(servicesRaw, commonData.language) as Service[];

  return {
    ...commonData,
    projects,
    services,
  };
}
