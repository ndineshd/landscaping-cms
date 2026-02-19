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
import { notFound } from "next/navigation";

import { FloatingWhatsApp } from "@/components/site/FloatingWhatsApp";
import { SectionContainer } from "@/components/site/SectionContainer";
import { ServiceQuoteButton } from "@/components/site/ServiceQuoteButton";
import { getActiveServices } from "@/lib/config-loader";
import { getSiteCommonData } from "@/lib/site-data";

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

export default async function ServiceDetailPage({ params }: ServiceDetailPageProps) {
  const [services, siteData] = await Promise.all([getActiveServices(), getSiteCommonData()]);
  const service = services.find((item) => item.id === params.id);

  if (!service) {
    notFound();
  }

  const Icon = getServiceIcon(service.icon);
  const floatingContact = siteData.adminConfig.contact.floatingContact;
  const otherServices = services.filter((item) => item.id !== service.id).slice(0, 5);
  const galleryItems = service.gallery.length > 0 ? service.gallery : [service.image];

  return (
    <main>
      <section className="border-b border-[var(--site-color-border)] bg-[var(--site-color-muted)] pb-10 pt-28 md:pb-12 md:pt-32">
        <SectionContainer>
          <nav aria-label="Breadcrumb" className="mb-5 flex flex-wrap items-center gap-2 text-sm text-[var(--site-color-muted-foreground)]">
            <Link className="transition-colors hover:text-[var(--site-color-primary)]" href="/">
              Home
            </Link>
            <ChevronRight className="h-4 w-4" />
            <Link className="transition-colors hover:text-[var(--site-color-primary)]" href="/services">
              Services
            </Link>
            <ChevronRight className="h-4 w-4" />
            <span className="font-medium text-[var(--site-color-foreground)]">{service.title}</span>
          </nav>

          <div className="flex items-start gap-4">
            <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[var(--site-color-accent)] text-[var(--site-color-primary)]">
              <Icon className="h-7 w-7" />
            </span>
            <div>
              <h1 className="site-heading text-3xl font-semibold text-[var(--site-color-foreground)] md:text-5xl">{service.title}</h1>
              <p className="mt-3 max-w-3xl text-base text-[var(--site-color-muted-foreground)] md:text-lg">{service.shortDescription}</p>
            </div>
          </div>
        </SectionContainer>
      </section>

      <section className="bg-white py-10 md:py-14">
        <SectionContainer>
          <div className="grid gap-10 lg:grid-cols-[1.6fr_0.74fr]">
            <div className="space-y-10">
              <div className="overflow-hidden rounded-2xl border border-[var(--site-color-border)] bg-[var(--site-color-muted)]">
                <div className="h-64 bg-cover bg-center sm:h-80 lg:h-[420px]" style={{ backgroundImage: `url("${service.image}")` }} />
              </div>

              <section>
                <h2 className="site-heading text-3xl font-semibold text-[var(--site-color-foreground)] md:text-4xl">About this Service</h2>
                <p className="mt-4 text-base leading-relaxed text-[var(--site-color-muted-foreground)] md:text-lg">{service.description}</p>
              </section>

              {service.features.length > 0 ? (
                <section>
                  <h2 className="site-heading text-2xl font-semibold text-[var(--site-color-foreground)] md:text-3xl">Key Features</h2>
                  <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                    {service.features.map((feature, index) => (
                      <li
                        className="flex items-start gap-3 rounded-xl border border-[var(--site-color-border)] bg-white px-4 py-4 text-[15px] text-[var(--site-color-foreground)]"
                        key={`${service.id}-feature-${index}`}
                      >
                        <Check className="mt-[2px] h-4 w-4 shrink-0 text-[var(--site-color-primary)]" />
                        <span>{resolveFeatureText(feature)}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {galleryItems.length > 0 ? (
                <section>
                  <h2 className="site-heading text-2xl font-semibold text-[var(--site-color-foreground)] md:text-3xl">Gallery</h2>
                  <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
                    {galleryItems.map((image, index) => (
                      <div className="overflow-hidden rounded-xl border border-[var(--site-color-border)] bg-[var(--site-color-muted)]" key={`${service.id}-gallery-${index}`}>
                        <div
                          aria-label={`${service.title} gallery image ${index + 1}`}
                          className="h-40 bg-cover bg-center sm:h-44 md:h-48"
                          role="img"
                          style={{ backgroundImage: `url("${image}")` }}
                        />
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}
            </div>

            <aside className="space-y-4 lg:sticky lg:top-28 lg:self-start">
              <div className="rounded-2xl border border-[var(--site-color-border)] bg-[var(--site-color-muted)] p-6">
                <h3 className="site-heading text-2xl font-semibold text-[var(--site-color-foreground)]">Need this service?</h3>
                <p className="mt-3 text-sm leading-relaxed text-[var(--site-color-muted-foreground)]">
                  Get in touch with us today for a free consultation and quote.
                </p>
                <ServiceQuoteButton
                  className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--site-color-primary)] px-6 py-4 text-base font-semibold text-white shadow-sm transition-colors hover:bg-[var(--site-color-primary-hover)]"
                  number={siteData.adminConfig.contact.whatsapp.number}
                  serviceTitle={service.title}
                />
                <p className="mt-4 text-center text-sm text-[var(--site-color-muted-foreground)]">
                  Or call us directly at
                  <br />
                  <a className="font-medium text-[var(--site-color-foreground)]" href={`tel:${siteData.adminConfig.contact.phone.replace(/[^\d+]/g, "")}`}>
                    {siteData.adminConfig.contact.phone}
                  </a>
                </p>
              </div>

              {otherServices.length > 0 ? (
                <div className="rounded-2xl border border-[var(--site-color-border)] bg-white p-6">
                  <h3 className="site-heading text-xl font-semibold text-[var(--site-color-foreground)]">Other Services</h3>
                  <ul className="mt-4 space-y-3">
                    {otherServices.map((item) => (
                      <li key={item.id}>
                        <Link className="text-base text-[var(--site-color-muted-foreground)] transition-colors hover:text-[var(--site-color-primary)]" href={`/services/${item.id}`}>
                          {item.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </aside>
          </div>
        </SectionContainer>
      </section>

      {floatingContact.enabled && floatingContact.showWhatsApp ? (
        <FloatingWhatsApp
          defaultMessage={siteData.adminConfig.contact.whatsapp.defaultMessage}
          number={siteData.adminConfig.contact.whatsapp.number}
        />
      ) : null}
    </main>
  );
}
