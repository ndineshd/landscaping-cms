import Link from "next/link";

import { SectionContainer } from "./SectionContainer";

interface HeroSectionProps {
  ctaHref: string;
  ctaLabel: string;
  description: string;
  imageDesktop: string;
  imageMobile: string;
  subtitle: string;
  title: string;
}

/**
 * Homepage hero section.
 */
export function HeroSection({
  ctaHref,
  ctaLabel,
  description,
  imageDesktop,
  imageMobile,
  subtitle,
  title,
}: HeroSectionProps) {
  return (
    <section className="relative min-h-[620px] overflow-hidden pt-20 md:min-h-[700px] md:pt-0">
      <div className="absolute inset-0">
        <div
          className="absolute inset-0 bg-cover bg-center md:hidden"
          style={{ backgroundImage: `url("${imageMobile}")` }}
        />
        <div
          className="absolute inset-0 hidden bg-cover bg-center md:block"
          style={{ backgroundImage: `url("${imageDesktop}")` }}
        />
        <div className="absolute inset-0 bg-black/45" />
      </div>

      <SectionContainer className="relative flex min-h-[620px] items-center justify-center py-20 text-center md:min-h-[700px] md:py-24">
        <div className="max-w-4xl text-white">
          <p className="site-animate-fade-up text-base font-medium text-white/85">{subtitle}</p>
          <h1 className="site-heading site-animate-fade-up mt-4 text-4xl font-semibold tracking-tight md:text-6xl">
            {title}
          </h1>
          <p className="site-animate-fade-up mt-6 text-lg text-white/90 md:text-2xl">{description}</p>
          <Link
            className="site-animate-fade-up mt-10 inline-flex h-12 items-center justify-center rounded-full border border-white/20 bg-[var(--site-color-primary)] px-8 text-base font-semibold text-white transition-all duration-300 hover:translate-y-[-2px] hover:bg-[var(--site-color-primary-hover)]"
            href={ctaHref}
          >
            {ctaLabel}
          </Link>
        </div>
      </SectionContainer>
    </section>
  );
}
