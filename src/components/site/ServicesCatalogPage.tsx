"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import { ROUTES } from "@/lib/constants";
import { createLocalizedPath } from "@/lib/site-i18n";
import type { Service } from "@/types/content";

import { ScrollReveal } from "./ScrollReveal";
import { ServiceCard } from "./ServiceCard";
import { SectionContainer } from "./SectionContainer";

interface ServicesCatalogPageProps {
  currentLanguageCode: string;
  languageCodes: string[];
  noResultsLabel: string;
  searchPlaceholder: string;
  services: Service[];
  subtitle: string;
  title: string;
  viewDetailsLabel: string;
}


export function ServicesCatalogPage({
  currentLanguageCode,
  languageCodes,
  noResultsLabel,
  searchPlaceholder,
  services,
  subtitle,
  title,
  viewDetailsLabel,
}: ServicesCatalogPageProps) {
  const [query, setQuery] = useState("");
  const enabledServices = useMemo(
    () => services.filter((service) => service.enabled),
    [services]
  );
  const shouldShowSearch = enabledServices.length > 8;

  const filteredServices = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return enabledServices;
    }

    return enabledServices.filter((service) => {
      return [service.title, service.shortDescription, service.description]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(needle));
    });
  }, [enabledServices, query]);

  return (
    <>
      <section className="relative overflow-hidden pb-12 pt-32 md:pb-14 md:pt-36">
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(130deg, #173425 0%, #1e4a34 42%, #2a6848 100%), radial-gradient(circle at 15% 20%, rgba(255,255,255,0.16) 0 12%, transparent 13%), radial-gradient(circle at 82% 72%, rgba(255,255,255,0.12) 0 9%, transparent 10%)",
          }}
        />
        <SectionContainer className="relative text-center">
          <ScrollReveal>
            <h1 className="site-heading text-4xl font-semibold text-white md:text-5xl">
              {title}
            </h1>
          </ScrollReveal>
          <ScrollReveal delayMs={80}>
            <p className="mx-auto mt-4 max-w-3xl text-base leading-relaxed text-white/85 md:text-base">
              {subtitle}
            </p>
          </ScrollReveal>
          {shouldShowSearch ? (
            <ScrollReveal className="mx-auto mt-8 max-w-[560px]" delayMs={130} variant="zoom">
              <label className="sr-only" htmlFor="services-search">
                {searchPlaceholder}
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--site-color-muted-foreground)]" />
                <input
                  className="h-12 w-full rounded-[5px] border border-[var(--site-color-border)] bg-white pl-12 pr-4 text-sm text-[var(--site-color-foreground)] outline-none transition-colors focus:border-[var(--site-color-primary)]"
                  id="services-search"
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={searchPlaceholder}
                  type="search"
                  value={query}
                />
              </div>
            </ScrollReveal>
          ) : null}
        </SectionContainer>
      </section>

      <section className="bg-white py-12 md:py-16">
        <SectionContainer>
          {filteredServices.length > 0 ? (
            <div className="grid items-stretch gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
              {filteredServices.map((service, index) => (
                <ScrollReveal className="h-full" delayMs={(index % 6) * 65} key={service.id} variant="zoom">
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
          ) : (
            <ScrollReveal>
              <div className="rounded-[5px] border border-[var(--site-color-border)] bg-[var(--site-color-muted)] p-8 text-center text-sm text-[var(--site-color-muted-foreground)]">
                {noResultsLabel}
              </div>
            </ScrollReveal>
          )}
        </SectionContainer>
      </section>
    </>
  );
}
