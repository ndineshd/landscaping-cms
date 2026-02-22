import { FloatingWhatsApp } from "@/components/site/FloatingWhatsApp";
import { ServicesCatalogPage } from "@/components/site/ServicesCatalogPage";
import { getActiveServices } from "@/lib/config-loader";
import { getSiteCommonData, localizeSiteContent } from "@/lib/site-data";
import type { Service } from "@/types/content";

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
          defaultMessage={siteData.adminConfig.contact.whatsapp.defaultMessage}
          number={siteData.adminConfig.contact.whatsapp.number}
        />
      ) : null}
    </main>
  );
}
