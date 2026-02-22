import type { Project } from "@/types/content";

import { ScrollReveal } from "./ScrollReveal";
import { SectionContainer } from "./SectionContainer";
import { SectionHeading } from "./SectionHeading";
import { ProjectsCarousel } from "./ProjectsCarousel";

interface ProjectsSectionProps {
  galleryTitleLabel?: string;
  projects: Project[];
  title: string;
  viewGalleryLabel?: string;
}

/**
 * Homepage projects section.
 */
export function ProjectsSection({
  galleryTitleLabel,
  projects,
  title,
  viewGalleryLabel,
}: ProjectsSectionProps) {
  const visibleProjects = projects.filter((project) => project.enabled);
  if (visibleProjects.length === 0) return null;

  return (
    <section className="bg-white py-20 md:py-24">
      <SectionContainer>
        <ScrollReveal>
          <SectionHeading alignment="left" className="max-w-none" title={title} />
        </ScrollReveal>
        <ScrollReveal delayMs={90} variant="zoom">
          <ProjectsCarousel
            galleryTitleLabel={galleryTitleLabel}
            projects={visibleProjects}
            viewGalleryLabel={viewGalleryLabel}
          />
        </ScrollReveal>
      </SectionContainer>
    </section>
  );
}
