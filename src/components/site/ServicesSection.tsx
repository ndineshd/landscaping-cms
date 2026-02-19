import Link from "next/link";
import { ArrowRight } from "lucide-react";

import type { Service } from "@/types/content";

import { ServiceCard } from "./ServiceCard";
import { SectionContainer } from "./SectionContainer";
import { SectionHeading } from "./SectionHeading";

interface ServicesSectionProps {
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
  services,
  subtitle,
  title,
  viewAllLabel,
  viewDetailsLabel,
}: ServicesSectionProps) {
  const visibleServices = services.slice(0, 4);

  return (
    <section className="bg-[var(--site-color-muted)] py-20 md:py-24" id="services">
      <SectionContainer>
        <SectionHeading subtitle={subtitle} title={title} />
        <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {visibleServices.map((service) => (
            <ServiceCard
              key={service.id}
              service={service}
              viewDetailsLabel={viewDetailsLabel}
            />
          ))}
        </div>
        <div className="mt-10 text-center">
          <Link
            className="inline-flex h-11 items-center gap-2 rounded-[5px] border border-[var(--site-color-border)] bg-white px-8 text-sm font-semibold text-[var(--site-color-primary)] transition-colors duration-200 hover:border-[var(--site-color-primary)] hover:bg-[var(--site-color-accent)]"
            href="/services"
          >
            {viewAllLabel}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </SectionContainer>
    </section>
  );
}
