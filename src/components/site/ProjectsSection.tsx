import type { Project } from "@/types/content";

import { ScrollReveal } from "./ScrollReveal";
import { SectionContainer } from "./SectionContainer";
import { SectionHeading } from "./SectionHeading";
import { ProjectsCarousel } from "./ProjectsCarousel";

interface ProjectsSectionProps {
  projects: Project[];
  title: string;
}

/**
 * Homepage projects section.
 */
export function ProjectsSection({ projects, title }: ProjectsSectionProps) {
  const visibleProjects = projects.filter((project) => project.enabled);
  if (visibleProjects.length === 0) return null;

  return (
    <section className="bg-white py-20 md:py-24">
      <SectionContainer>
        <ScrollReveal>
          <SectionHeading alignment="left" className="max-w-none" title={title} />
        </ScrollReveal>
        <ScrollReveal delayMs={90} variant="zoom">
          <ProjectsCarousel projects={visibleProjects} />
        </ScrollReveal>
      </SectionContainer>
    </section>
  );
}
