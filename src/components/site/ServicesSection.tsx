import Link from "next/link";
import {
  ArrowRight,
  Building2,
  Flower2,
  Leaf,
  LucideProps,
  TreePine,
} from "lucide-react";
import type { ForwardRefExoticComponent, RefAttributes } from "react";

import type { Service } from "@/types/content";

import { SectionContainer } from "./SectionContainer";
import { SectionHeading } from "./SectionHeading";

type LucideIcon = ForwardRefExoticComponent<Omit<LucideProps, "ref"> & RefAttributes<SVGSVGElement>>;

const serviceIconMap: Record<string, LucideIcon> = {
  building: Building2,
  flower: Flower2,
  leaf: Leaf,
  "tree-deciduous": TreePine,
};

interface ServiceCardProps {
  description: string;
  iconName: string;
  imagePath: string;
  title: string;
  viewDetailsLabel: string;
}

interface ServicesSectionProps {
  services: Service[];
  subtitle: string;
  title: string;
  viewAllLabel: string;
  viewDetailsLabel: string;
}

function getServiceIcon(iconName: string): LucideIcon {
  return serviceIconMap[iconName] || Leaf;
}

function ServiceCard({ description, iconName, imagePath, title, viewDetailsLabel }: ServiceCardProps) {
  const Icon = getServiceIcon(iconName);

  return (
    <article className="group overflow-hidden rounded-2xl border border-[var(--site-color-border)] bg-white shadow-sm transition-all duration-300 hover:translate-y-[-6px] hover:shadow-xl">
      <div className="relative h-48 bg-[var(--site-color-muted)]">
        <div
          className="h-full w-full bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
          style={{ backgroundImage: `url("${imagePath}")` }}
        />
        <span className="absolute left-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-md bg-white text-[var(--site-color-primary)] shadow">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className="space-y-4 p-5">
        <h3 className="site-heading text-xl font-semibold leading-tight text-[var(--site-color-foreground)]">{title}</h3>
        <p className="min-h-16 text-sm leading-relaxed text-[var(--site-color-muted-foreground)]">{description}</p>
        <Link
          className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--site-color-primary)] transition-transform duration-300 group-hover:translate-x-0.5"
          href="/services"
        >
          {viewDetailsLabel}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </article>
  );
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
              description={service.shortDescription}
              iconName={service.icon}
              imagePath={service.image}
              key={service.id}
              title={service.title}
              viewDetailsLabel={viewDetailsLabel}
            />
          ))}
        </div>
        <div className="mt-10 text-center">
          <Link
            className="inline-flex h-11 items-center gap-2 rounded-full border border-[var(--site-color-border)] bg-white px-8 text-sm font-semibold text-[var(--site-color-primary)] transition-colors duration-200 hover:border-[var(--site-color-primary)] hover:bg-[var(--site-color-accent)]"
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
