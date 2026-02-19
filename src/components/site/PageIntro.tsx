import { SectionContainer } from "./SectionContainer";

interface PageIntroProps {
  description: string;
  title: string;
}

/**
 * Shared top intro block for secondary pages.
 */
export function PageIntro({ description, title }: PageIntroProps) {
  return (
    <section className="bg-[var(--site-color-muted)] pb-14 pt-32 md:pb-16 md:pt-36">
      <SectionContainer>
        <h1 className="site-heading text-4xl font-semibold text-[var(--site-color-foreground)] md:text-5xl">
          {title}
        </h1>
        <p className="mt-4 max-w-3xl text-base text-[var(--site-color-muted-foreground)] md:text-lg">{description}</p>
      </SectionContainer>
    </section>
  );
}
