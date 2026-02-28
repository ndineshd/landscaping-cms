import type { Metadata } from "next";

import { AboutSection } from "@/components/site/AboutSection";
import { FloatingWhatsApp } from "@/components/site/FloatingWhatsApp";
import { HeroSection } from "@/components/site/HeroSection";
import { ProjectsSection } from "@/components/site/ProjectsSection";
import { ServicesSection } from "@/components/site/ServicesSection";
import { ROUTES } from "@/lib/constants";
import {
  buildPageAlternates,
  parseKeywords,
  resolveMetadataBase,
  toAbsoluteUrl,
} from "@/lib/seo";
import { createLocalizedPath } from "@/lib/site-i18n";
import { getSiteCommonData, getSiteHomeData } from "@/lib/site-data";

export async function generateMetadata(): Promise<Metadata> {
  const siteData = await getSiteCommonData();
  const { adminConfig, language } = siteData;
  const metadataBase = resolveMetadataBase();
  const alternates = buildPageAlternates(
    ROUTES.HOME,
    language.currentLanguageCode,
    language.languageCodes,
    metadataBase,
    language.defaultLanguageCode
  );
  const title = adminConfig.seo.title;
  const description = adminConfig.site.description || adminConfig.seo.description;
  const keywords = parseKeywords(adminConfig.seo.keywords);
  const ogImage = adminConfig.seo.ogImage
    ? toAbsoluteUrl(adminConfig.seo.ogImage, metadataBase)
    : undefined;
  const canonicalUrl = String(alternates.canonical || "");

  return {
    alternates,
    description,
    keywords,
    openGraph: {
      description,
      images: ogImage ? [{ url: ogImage }] : undefined,
      title,
      type: "website",
      url: canonicalUrl,
    },
    title,
    twitter: {
      card: "summary_large_image",
      description,
      images: ogImage ? [ogImage] : undefined,
      title,
    },
  };
}

export default async function HomePage() {
  const { adminConfig, language, projects, services, translations, whatsAppDefaultMessageEnglish } = await getSiteHomeData();
  const aboutCopy = adminConfig.about;
  const contactCopy = translations.contact || {};
  const floatingContact = adminConfig.contact.floatingContact;
  const heroCopy = adminConfig.hero;
  const commonCopy = translations.common || {};
  const hasProjects = projects.length > 0;
  const hasServices = services.length > 0;
  const projectsCopy = translations.projects || {};
  const servicesCopy = translations.services || {};
  const heroCtaHref = hasServices ? heroCopy.ctaLink : "/contact";
  const heroCtaLabel = hasServices
    ? heroCopy.ctaText || servicesCopy.viewAll || "View Services"
    : commonCopy.contactUs || "Contact Us";
  const localizedHeroCtaHref = createLocalizedPath(
    heroCtaHref || ROUTES.SERVICES,
    language.currentLanguageCode,
    language.languageCodes
  );
  const localizedAboutCtaHref = createLocalizedPath(
    aboutCopy.ctaLink || ROUTES.CONTACT,
    language.currentLanguageCode,
    language.languageCodes
  );

  return (
    <main>
      <HeroSection
        ctaHref={localizedHeroCtaHref}
        ctaLabel={heroCtaLabel}
        description={heroCopy.description}
        imageDesktop={heroCopy.images.desktop}
        imageMobile={heroCopy.images.mobile}
        subtitle={heroCopy.subtitle}
        title={heroCopy.title}
      />
      {hasServices ? (
        <ServicesSection
          currentLanguageCode={language.currentLanguageCode}
          languageCodes={language.languageCodes}
          services={services}
          subtitle={servicesCopy.subtitle || ""}
          title={servicesCopy.title || "Our Services"}
          viewAllLabel={servicesCopy.viewAll || "View All Services"}
          viewDetailsLabel={servicesCopy.viewDetails || "View Details"}
        />
      ) : null}
      {hasProjects ? (
        <ProjectsSection
          galleryTitleLabel={projectsCopy.galleryTitle || "Gallery"}
          projects={projects}
          title={projectsCopy.title || "Our Projects"}
          viewGalleryLabel={projectsCopy.viewGallery || "View Gallery"}
        />
      ) : null}
      <AboutSection
        ctaHref={localizedAboutCtaHref}
        ctaLabel={aboutCopy.ctaText || contactCopy.title || "Get in Touch"}
        description={aboutCopy.description}
        features={aboutCopy.features}
        imagePath={aboutCopy.image || heroCopy.images.desktop}
        title={aboutCopy.title}
      />
      {floatingContact.enabled && floatingContact.showWhatsApp ? (
        <FloatingWhatsApp
          ariaLabel={contactCopy.chatOnWhatsApp || "Chat on WhatsApp"}
          defaultMessage={whatsAppDefaultMessageEnglish}
          number={adminConfig.contact.whatsapp.number}
        />
      ) : null}
    </main>
  );
}
