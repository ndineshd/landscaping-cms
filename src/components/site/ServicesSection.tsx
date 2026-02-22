import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { ROUTES } from "@/lib/constants";
import { createLocalizedPath } from "@/lib/site-i18n";
import type { Service } from "@/types/content";

import { ScrollReveal } from "./ScrollReveal";
import { ServiceCard } from "./ServiceCard";
import { SectionContainer } from "./SectionContainer";
import { SectionHeading } from "./SectionHeading";

interface ServicesSectionProps {
  currentLanguageCode: string;
  languageCodes: string[];
  services: Service[];
  subtitle: string;
  title: string;
  viewAllLabel: string;
  viewDetailsLabel: string;
}

/**
 * Homepage services section.
 */
export function ServicesSection({
  currentLanguageCode,
  languageCodes,
  services,
  subtitle,
  title,
  viewAllLabel,
  viewDetailsLabel,
}: ServicesSectionProps) {
  const visibleServices = services.filter((service) => service.enabled).slice(0, 4);
  const servicesPageHref = createLocalizedPath(
    ROUTES.SERVICES,
    currentLanguageCode,
    languageCodes
  );

  return (
    <section className="bg-[var(--site-color-muted)] py-20 md:py-24" id="services">
      <SectionContainer>
        <ScrollReveal>
          <SectionHeading subtitle={subtitle} title={title} />
        </ScrollReveal>
        <div className="mt-12 grid items-stretch gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visibleServices.map((service, index) => (
            <ScrollReveal className="h-full" delayMs={index * 70} key={service.id} variant="zoom">
              <ServiceCard
                href={createLocalizedPath(
                  `${ROUTES.SERVICE_DETAIL}/${service.id}`,
                  currentLanguageCode,
                  languageCodes
                )}
                service={service}
                viewDetailsLabel={viewDetailsLabel}
              />
            </ScrollReveal>
          ))}
        </div>
        <ScrollReveal className="mt-10 text-center" delayMs={120}>
          <Link
            className="inline-flex h-11 items-center gap-2 rounded-[5px] border border-[var(--site-color-border)] bg-white px-8 text-sm font-semibold text-[var(--site-color-primary)] transition-colors duration-200 hover:border-[var(--site-color-primary)] hover:bg-[var(--site-color-accent)]"
            href={servicesPageHref}
          >
            {viewAllLabel}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </ScrollReveal>
      </SectionContainer>
    </section>
  );
}
