import type { Metadata } from "next";

import { FloatingWhatsApp } from "@/components/site/FloatingWhatsApp";
import { ServicesCatalogPage } from "@/components/site/ServicesCatalogPage";
import { getActiveServices } from "@/lib/config-loader";
import { ROUTES } from "@/lib/constants";
import {
  buildPageAlternates,
  parseKeywords,
  resolveMetadataBase,
  toAbsoluteUrl,
} from "@/lib/seo";
import { getSiteCommonData, localizeSiteContent } from "@/lib/site-data";
import type { Service } from "@/types/content";

export async function generateMetadata(): Promise<Metadata> {
  const siteData = await getSiteCommonData();
  const { adminConfig, language, translations } = siteData;
  const servicesCopy = translations.services || {};
  const metadataBase = resolveMetadataBase();
  const alternates = buildPageAlternates(
    ROUTES.SERVICES,
    language.currentLanguageCode,
    language.languageCodes,
    metadataBase,
    language.defaultLanguageCode
  );
  const pageTitle = servicesCopy.title || "Our Services";
  const title = `${pageTitle} | ${adminConfig.site.name}`;
  const description =
    servicesCopy.subtitle ||
    adminConfig.seo.description;
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

export default async function ServicesPage() {
  const [servicesRaw, siteData] = await Promise.all([
    getActiveServices(),
    getSiteCommonData(),
  ]);
  const services = localizeSiteContent(servicesRaw, siteData.language) as Service[];
  const servicesCopy = siteData.translations.services || {};
  const contactCopy = siteData.translations.contact || {};
  const floatingContact = siteData.adminConfig.contact.floatingContact;
  const subtitle =
    servicesCopy.subtitle ||
    "Explore our wide range of professional landscaping and gardening services designed to transform your space.";

  return (
    <main>
      <ServicesCatalogPage
        currentLanguageCode={siteData.language.currentLanguageCode}
        languageCodes={siteData.language.languageCodes}
        noResultsLabel={servicesCopy.noResults || "No services found for your search."}
        searchPlaceholder={servicesCopy.searchPlaceholder || "Search for a service..."}
        services={services}
        subtitle={subtitle}
        title={servicesCopy.title || "Our Services"}
        viewDetailsLabel={servicesCopy.viewDetails || "View Details"}
      />
      {floatingContact.enabled && floatingContact.showWhatsApp ? (
        <FloatingWhatsApp
          ariaLabel={contactCopy.chatOnWhatsApp || "Chat on WhatsApp"}
          defaultMessage={siteData.whatsAppDefaultMessageEnglish}
          number={siteData.adminConfig.contact.whatsapp.number}
        />
      ) : null}
    </main>
  );
}
