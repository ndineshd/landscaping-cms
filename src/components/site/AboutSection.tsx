import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

import type { AboutFeature } from "@/types/config";

import { ScrollReveal } from "./ScrollReveal";
import { SectionContainer } from "./SectionContainer";
import { SiteImage } from "./SiteImage";

interface AboutSectionProps {
  ctaHref: string;
  ctaLabel: string;
  description: string;
  features: AboutFeature[];
  imagePath: string;
  title: string;
}

/**
 * Homepage about section.
 */
export function AboutSection({
  ctaHref,
  ctaLabel,
  description,
  features,
  imagePath,
  title,
}: AboutSectionProps) {
  return (
    <section className="bg-[#edf2ee] py-20 md:py-24">
      <SectionContainer>
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
          <ScrollReveal className="h-[300px] overflow-hidden rounded-[5px] bg-[var(--site-color-muted)] md:h-[400px]" variant="left">
            <SiteImage
              alt={`${title} section image`}
              className="h-full w-full"
              imgClassName="transition-transform duration-700 hover:scale-105"
              src={imagePath}
            />
          </ScrollReveal>
          <ScrollReveal delayMs={80} variant="right">
            <h2 className="site-heading text-3xl font-semibold leading-tight text-[var(--site-color-foreground)] md:text-4xl">
              {title}
            </h2>
            <p className="mt-5 text-base leading-relaxed text-[var(--site-color-muted-foreground)] md:text-lg">
              {description}
            </p>
            <ul className="mt-7 space-y-3">
              {features.map((feature) => (
                <li className="flex items-center gap-3 text-[15px] text-[var(--site-color-foreground)]" key={feature.title}>
                  <CheckCircle2 className="h-4 w-4 text-[var(--site-color-primary)]" />
                  <span>{feature.title}</span>
                </li>
              ))}
            </ul>
            <Link
              className="mt-8 inline-flex h-12 items-center justify-center rounded-[5px] bg-[var(--site-color-primary)] px-7 text-sm font-semibold text-white transition-colors duration-200 hover:bg-[var(--site-color-primary-hover)]"
              href={ctaHref}
            >
              {ctaLabel}
            </Link>
          </ScrollReveal>
        </div>
      </SectionContainer>
    </section>
  );
}
