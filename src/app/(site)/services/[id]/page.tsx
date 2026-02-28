import Link from "next/link";
import {
  Building2,
  Check,
  ChevronRight,
  Droplets,
  Fish,
  Flower2,
  Leaf,
  Scissors,
  Shovel,
  Sprout,
  TreeDeciduous,
  WavesLadder,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FloatingWhatsApp } from "@/components/site/FloatingWhatsApp";
import { ScrollReveal } from "@/components/site/ScrollReveal";
import { SectionContainer } from "@/components/site/SectionContainer";
import { SiteImage } from "@/components/site/SiteImage";
import { ServiceQuoteButton } from "@/components/site/ServiceQuoteButton";
import { getActiveServices } from "@/lib/config-loader";
import { ROUTES } from "@/lib/constants";
import { getContactCollections } from "@/lib/contact-utils";
import {
  buildPageAlternates,
  parseKeywords,
  resolveMetadataBase,
  toAbsoluteUrl,
} from "@/lib/seo";
import { createLocalizedPath } from "@/lib/site-i18n";
import { getSiteCommonData, localizeSiteContent } from "@/lib/site-data";
import type { Service } from "@/types/content";

interface ServiceDetailPageProps {
  params: {
    id: string;
  };
}

const serviceIconMap: Record<string, LucideIcon> = {
  building: Building2,
  droplets: Droplets,
  fish: Fish,
  flower: Flower2,
  leaf: Leaf,
  scissors: Scissors,
  shovel: Shovel,
  sprout: Sprout,
  "tree-deciduous": TreeDeciduous,
  "waves-ladder": WavesLadder,
};

function normalizeIconName(iconName: string): string {
  return iconName.trim().toLowerCase().replace(/[_\s]+/g, "-");
}

function getServiceIcon(iconName: string): LucideIcon {
  const normalized = normalizeIconName(iconName);
  return serviceIconMap[normalized] || Leaf;
}

function resolveFeatureText(feature: string | { description?: string; title: string }): string {
  if (typeof feature === "string") {
    return feature;
  }
  return feature.description ? `${feature.title} - ${feature.description}` : feature.title;
}

export async function generateMetadata({
  params,
}: ServiceDetailPageProps): Promise<Metadata> {
  const [servicesRaw, siteData] = await Promise.all([
    getActiveServices(),
    getSiteCommonData(),
  ]);
  const services = localizeSiteContent(servicesRaw, siteData.language) as Service[];
  const service = services.find((item) => item.id === params.id);
  const metadataBase = resolveMetadataBase();

  if (!service) {
    return {
      robots: {
        follow: false,
        index: false,
      },
      title: `Service Not Found | ${siteData.adminConfig.site.name}`,
    };
  }

  const routePath = `${ROUTES.SERVICE_DETAIL}/${service.id}`;
  const alternates = buildPageAlternates(
    routePath,
    siteData.language.currentLanguageCode,
    siteData.language.languageCodes,
    metadataBase,
    siteData.language.defaultLanguageCode
  );
  const title = `${service.title} | ${siteData.adminConfig.site.name}`;
  const description =
    service.shortDescription ||
    service.description ||
    siteData.adminConfig.seo.description;
  const baseKeywords = parseKeywords(siteData.adminConfig.seo.keywords) || [];
  const keywords = Array.from(
    new Set([
      ...baseKeywords,
      service.title,
      service.id,
    ])
  );
  const previewImage = service.image || siteData.adminConfig.seo.ogImage;
  const ogImage = previewImage
    ? toAbsoluteUrl(previewImage, metadataBase)
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
      type: "article",
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

export default async function ServiceDetailPage({ params }: ServiceDetailPageProps) {
  const [servicesRaw, siteData] = await Promise.all([
    getActiveServices(),
    getSiteCommonData(),
  ]);
  const services = localizeSiteContent(servicesRaw, siteData.language) as Service[];
  const sourceService = servicesRaw.find((item) => item.id === params.id);
  const service = services.find((item) => item.id === params.id);

  if (!service || !sourceService) {
    notFound();
  }

  const navCopy = siteData.translations.nav || {};
  const contactCopy = siteData.translations.contact || {};
  const detailCopy = siteData.translations.serviceDetail || {};
  const Icon = getServiceIcon(service.icon);
  const floatingContact = siteData.adminConfig.contact.floatingContact;
  const otherServices = services.filter((item) => item.id !== service.id).slice(0, 5);
  const galleryItems = service.gallery.length > 0 ? service.gallery : [service.image];
  const homeHref = createLocalizedPath(
    ROUTES.HOME,
    siteData.language.currentLanguageCode,
    siteData.language.languageCodes
  );
  const servicesHref = createLocalizedPath(
    ROUTES.SERVICES,
    siteData.language.currentLanguageCode,
    siteData.language.languageCodes
  );
  const aboutServiceHeading = detailCopy.aboutTitle || "About this Service";
  const callDirectlyLabel = detailCopy.callDirectly || "Or call us directly at";
  const featuresHeading = detailCopy.featuresTitle || "Key Features";
  const galleryHeading = detailCopy.galleryTitle || "Gallery";
  const getQuoteLabel = detailCopy.getQuoteButton || "Contact & Get Quote";
  const needServiceDescription =
    detailCopy.needServiceDescription ||
    "Get in touch with us today for a free consultation and quote.";
  const needServiceHeading = detailCopy.needServiceTitle || "Need this service?";
  const otherServicesHeading = detailCopy.otherServicesTitle || "Other Services";
  const breadcrumbHomeLabel = navCopy.home || detailCopy.breadcrumbHome || "Home";
  const breadcrumbServicesLabel = navCopy.services || detailCopy.breadcrumbServices || "Services";
  const contactCollections = getContactCollections(siteData.adminConfig.contact);
  const metadataBase = resolveMetadataBase();
  const servicePath = createLocalizedPath(
    `${ROUTES.SERVICE_DETAIL}/${service.id}`,
    siteData.language.currentLanguageCode,
    siteData.language.languageCodes
  );
  const localizedHomeUrl = toAbsoluteUrl(
    createLocalizedPath(
      ROUTES.HOME,
      siteData.language.currentLanguageCode,
      siteData.language.languageCodes
    ),
    metadataBase
  );
  const localizedServicesUrl = toAbsoluteUrl(servicesHref, metadataBase);
  const localizedServiceUrl = toAbsoluteUrl(servicePath, metadataBase);
  const serviceImageUrl = service.image
    ? toAbsoluteUrl(service.image, metadataBase)
    : undefined;
  const businessName = siteData.adminConfig.site.companyName || siteData.adminConfig.site.name;
  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          item: localizedHomeUrl,
          name: breadcrumbHomeLabel,
          position: 1,
        },
        {
          "@type": "ListItem",
          item: localizedServicesUrl,
          name: breadcrumbServicesLabel,
          position: 2,
        },
        {
          "@type": "ListItem",
          item: localizedServiceUrl,
          name: service.title,
          position: 3,
        },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "Service",
      areaServed: contactCollections.addresses[0],
      description: service.description || service.shortDescription,
      image: serviceImageUrl,
      inLanguage: siteData.language.currentLanguageCode,
      name: service.title,
      provider: {
        "@type": "LocalBusiness",
        name: businessName,
        url: localizedHomeUrl,
      },
      serviceType: service.title,
      url: localizedServiceUrl,
    },
  ];

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <section className="relative overflow-hidden border-b border-[var(--site-color-border)] pb-10 pt-28 md:pb-12 md:pt-32">
        <SiteImage
          alt={`${service.title} hero image`}
          className="absolute inset-0"
          src={service.image}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/60 to-black/40" />
        <SectionContainer className="relative">
          <nav aria-label="Breadcrumb" className="mb-5 flex flex-wrap items-center gap-2 text-sm text-white/75">
            <Link className="transition-colors hover:text-white" href={homeHref}>
              {breadcrumbHomeLabel}
            </Link>
            <ChevronRight className="h-4 w-4" />
            <Link className="transition-colors hover:text-white" href={servicesHref}>
              {breadcrumbServicesLabel}
            </Link>
            <ChevronRight className="h-4 w-4" />
            <span className="font-medium text-white">{service.title}</span>
          </nav>

          <div className="flex items-start gap-4">
            <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-[5px] bg-white/85 text-[var(--site-color-primary)]">
              <Icon className="h-7 w-7" />
            </span>
            <div>
              <h1 className="site-heading text-3xl font-semibold text-white md:text-5xl">{service.title}</h1>
              <p className="mt-3 max-w-3xl text-base text-white/85 md:text-lg">{service.shortDescription}</p>
            </div>
          </div>
        </SectionContainer>
      </section>

      <section className="bg-white py-10 md:py-14">
        <SectionContainer>
          <div className="grid gap-10 lg:grid-cols-[1.6fr_0.74fr]">
            <div className="space-y-10">
              <ScrollReveal variant="zoom">
                <div className="overflow-hidden rounded-[5px] border border-[var(--site-color-border)] bg-[var(--site-color-muted)]">
                  <SiteImage
                    alt={`${service.title} service image`}
                    className="h-64 sm:h-80 lg:h-[420px]"
                    src={service.image}
                  />
                </div>
              </ScrollReveal>

              <ScrollReveal delayMs={70}>
                <section>
                  <h2 className="site-heading text-3xl font-semibold text-[var(--site-color-foreground)] md:text-4xl">{aboutServiceHeading}</h2>
                  <p className="mt-4 text-base leading-relaxed text-[var(--site-color-muted-foreground)] md:text-lg">{service.description}</p>
                </section>
              </ScrollReveal>

              {service.features.length > 0 ? (
                <ScrollReveal delayMs={90}>
                  <section>
                    <h2 className="site-heading text-2xl font-semibold text-[var(--site-color-foreground)] md:text-3xl">{featuresHeading}</h2>
                    <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                      {service.features.map((feature, index) => (
                        <li
                          className="flex items-start gap-3 rounded-[5px] border border-[var(--site-color-border)] bg-white px-4 py-4 text-[15px] text-[var(--site-color-foreground)]"
                          key={`${service.id}-feature-${index}`}
                        >
                          <Check className="mt-[2px] h-4 w-4 shrink-0 text-[var(--site-color-primary)]" />
                          <span>{resolveFeatureText(feature)}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                </ScrollReveal>
              ) : null}

              {galleryItems.length > 0 ? (
                <ScrollReveal delayMs={110}>
                  <section>
                    <h2 className="site-heading text-2xl font-semibold text-[var(--site-color-foreground)] md:text-3xl">{galleryHeading}</h2>
                    <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
                      {galleryItems.map((image, index) => (
                        <div className="overflow-hidden rounded-[5px] border border-[var(--site-color-border)] bg-[var(--site-color-muted)]" key={`${service.id}-gallery-${index}`}>
                          <SiteImage
                            alt={`${service.title} gallery image ${index + 1}`}
                            className="h-40 sm:h-44 md:h-48"
                            src={image}
                          />
                        </div>
                      ))}
                    </div>
                  </section>
                </ScrollReveal>
              ) : null}
            </div>

            <aside className="space-y-4 lg:sticky lg:top-28 lg:self-start">
              <ScrollReveal delayMs={70} variant="right">
                <div className="rounded-[5px] border border-[var(--site-color-border)] bg-[var(--site-color-muted)] p-6">
                  <h3 className="site-heading text-2xl font-semibold text-[var(--site-color-foreground)]">{needServiceHeading}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-[var(--site-color-muted-foreground)]">
                    {needServiceDescription}
                  </p>
                  <ServiceQuoteButton
                    className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-[5px] bg-[var(--site-color-primary)] px-6 py-4 text-base font-semibold text-white shadow-sm transition-colors hover:bg-[var(--site-color-primary-hover)]"
                    label={getQuoteLabel}
                    number={siteData.adminConfig.contact.whatsapp.number}
                    serviceTitle={sourceService.title}
                  />
                  <p className="mt-4 text-center text-sm text-[var(--site-color-muted-foreground)]">
                    {callDirectlyLabel}
                  </p>
                  {contactCollections.phoneNumbers.length > 0 ? (
                    <div className="mt-2 flex flex-col items-center gap-1 text-center">
                      {contactCollections.phoneNumbers.map((phone, index) => (
                        <a
                          className="font-medium text-[var(--site-color-foreground)]"
                          href={`tel:${phone.replace(/[^\d+]/g, "")}`}
                          key={`service-contact-phone-${index}`}
                        >
                          {phone}
                        </a>
                      ))}
                    </div>
                  ) : null}
                </div>
              </ScrollReveal>

              {otherServices.length > 0 ? (
                <ScrollReveal delayMs={120} variant="right">
                  <div className="rounded-[5px] border border-[var(--site-color-border)] bg-white p-6">
                    <h3 className="site-heading text-xl font-semibold text-[var(--site-color-foreground)]">{otherServicesHeading}</h3>
                    <ul className="mt-4 space-y-3">
                      {otherServices.map((item) => (
                        <li key={item.id}>
                          <Link
                            className="text-base text-[var(--site-color-muted-foreground)] transition-colors hover:text-[var(--site-color-primary)]"
                            href={createLocalizedPath(
                              `${ROUTES.SERVICE_DETAIL}/${item.id}`,
                              siteData.language.currentLanguageCode,
                              siteData.language.languageCodes
                            )}
                          >
                            {item.title}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                </ScrollReveal>
              ) : null}
            </aside>
          </div>
        </SectionContainer>
      </section>

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
