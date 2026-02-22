import type { Metadata } from "next";
import type { CSSProperties, ReactNode } from "react";

import { SiteFooter } from "@/components/site/SiteFooter";
import { RouteLoadingOverlay } from "@/components/site/RouteLoadingOverlay";
import { SiteHeader } from "@/components/site/SiteHeader";
import { getActiveProjects, getActiveServices } from "@/lib/config-loader";
import { ROUTES } from "@/lib/constants";
import { getContactCollections } from "@/lib/contact-utils";
import { stripLanguagePrefixFromPath } from "@/lib/site-i18n";
import { getSiteCommonData } from "@/lib/site-data";
import type { ThemeConfig } from "@/types/config";

export const dynamic = "force-dynamic";

interface SiteLayoutProps {
  children: ReactNode;
}

interface SiteThemeStyle extends CSSProperties {
  "--site-color-accent": string;
  "--site-color-background": string;
  "--site-color-border": string;
  "--site-color-foreground": string;
  "--site-color-muted": string;
  "--site-color-muted-foreground": string;
  "--site-color-primary": string;
  "--site-color-primary-hover": string;
  "--site-color-secondary": string;
  "--site-font-body": string;
  "--site-font-heading": string;
}

function createThemeStyle(theme: ThemeConfig): SiteThemeStyle {
  return {
    "--site-color-accent": theme.colors.accent,
    "--site-color-background": theme.colors.background,
    "--site-color-border": theme.colors.border,
    "--site-color-foreground": theme.colors.foreground,
    "--site-color-muted": theme.colors.muted,
    "--site-color-muted-foreground": theme.colors.mutedForeground,
    "--site-color-primary": theme.colors.primary,
    "--site-color-primary-hover": theme.colors.primaryHover,
    "--site-color-secondary": theme.colors.secondary,
    "--site-font-body": theme.fonts.body,
    "--site-font-heading": theme.fonts.heading,
  };
}

function getLogoText(text?: string): string {
  if (text && text.trim().length > 0) {
    return text.trim();
  }
  return "GW";
}

export async function generateMetadata(): Promise<Metadata> {
  const { adminConfig } = await getSiteCommonData();
  const seo = adminConfig.seo;

  return {
    description: seo.description,
    icons: seo.favicon,
    keywords: seo.keywords,
    title: seo.title,
  };
}

export default async function SiteLayout({ children }: SiteLayoutProps) {
  const [commonData, projects, services] = await Promise.all([
    getSiteCommonData(),
    getActiveProjects(),
    getActiveServices(),
  ]);
  const { adminConfig, footerLabels, homeHref, language, navItems } = commonData;
  const commonCopy = commonData.translations.common || {};
  const hasProjects = projects.length > 0;
  const hasServices = services.length > 0;
  const logoText = getLogoText(adminConfig.site.logo.text);
  const resolvedNavItems = navItems.filter((item) => {
    const hrefWithoutLanguage = stripLanguagePrefixFromPath(
      item.href,
      language.languageCodes
    );
    const plainPath = hrefWithoutLanguage
      .split("?")[0]
      .split("#")[0];

    if (plainPath === ROUTES.SERVICES && !hasServices) {
      return false;
    }
    if (hrefWithoutLanguage.startsWith(`${ROUTES.HOME}#projects`) && !hasProjects) {
      return false;
    }
    return true;
  });
  const socialMedia = adminConfig.socialMedia.filter((social) => social.enabled);
  const contactCollections = getContactCollections(adminConfig.contact);
  const themeStyle = createThemeStyle(adminConfig.theme);

  return (
    <div className="site-theme min-h-screen" style={themeStyle}>
      {adminConfig.theme.customCss ? <style>{adminConfig.theme.customCss}</style> : null}
      <RouteLoadingOverlay />
      <SiteHeader
        companyName={adminConfig.site.companyName}
        currentLanguageCode={language.currentLanguageCode}
        languageCodes={language.languageCodes}
        languageSwitcherAriaLabel={commonCopy.chooseLanguage || "Choose language"}
        languages={language.languages}
        logo={adminConfig.site.logo}
        logoText={logoText}
        navItems={resolvedNavItems}
        siteName={adminConfig.site.name}
      />
      <div className="flex min-h-screen flex-col">
        <div className="flex-1">{children}</div>
        <SiteFooter
          addresses={contactCollections.addresses}
          companyName={adminConfig.site.companyName}
          contactTitle={footerLabels.contactTitle}
          copyright={footerLabels.copyright}
          emails={contactCollections.emails}
          followUsTitle={footerLabels.followUsTitle}
          homeHref={homeHref}
          logo={adminConfig.site.logo}
          logoText={logoText}
          phoneNumbers={contactCollections.phoneNumbers}
          siteDescription={adminConfig.site.description}
          siteName={adminConfig.site.name}
          socialMedia={socialMedia}
        />
      </div>
    </div>
  );
}
