"use client";

import { useEffect, useState } from "react";

import {
  Carousel,
  CarouselApi,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { cn } from "@/lib/utils";
import type { Project } from "@/types/content";

import { SiteImage } from "./SiteImage";

interface ProjectCardProps {
  completedDate: string;
  description: string;
  imagePath: string;
  title: string;
}

interface ProjectsCarouselProps {
  projects: Project[];
}

function getProjectImage(project: Project): string {
  if (project.image && project.image.trim().length > 0) {
    return project.image;
  }
  if (project.images.length > 0) {
    return project.images[0];
  }
  return "/uploads/site/site/img-1771472600648.jpeg";
}

function ProjectCard({ completedDate, description, imagePath, title }: ProjectCardProps) {
  return (
    <article className="group relative h-[320px] overflow-hidden rounded-[5px] bg-[var(--site-color-muted)]">
      <SiteImage
        alt={`${title} project image`}
        className="absolute inset-0"
        imgClassName="transition-transform duration-500 group-hover:scale-105"
        src={imagePath}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent" />
      <div className="absolute bottom-4 left-4 right-4 space-y-2 text-white">
        <h3 className="site-heading text-xl font-semibold leading-tight">{title}</h3>
        {description ? (
          <p className="line-clamp-2 text-sm text-white/90">{description}</p>
        ) : null}
        {completedDate ? (
          <p className="text-xs font-medium uppercase tracking-wide text-white/80">
            {completedDate}
          </p>
        ) : null}
      </div>
    </article>
  );
}

/**
 * Client carousel for project cards.
 */
export function ProjectsCarousel({ projects }: ProjectsCarouselProps) {
  const [api, setApi] = useState<CarouselApi | null>(null);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [slideCount, setSlideCount] = useState(0);

  useEffect(() => {
    if (!api) {
      return;
    }

    const update = () => {
      setCurrentSlideIndex(api.selectedScrollSnap());
      setSlideCount(api.scrollSnapList().length);
    };

    update();
    api.on("reInit", update);
    api.on("select", update);

    return () => {
      api.off("reInit", update);
      api.off("select", update);
    };
  }, [api]);

  return (
    <div className="mt-10">
      <Carousel opts={{ align: "start", loop: true }} setApi={setApi}>
        <CarouselContent>
          {projects.map((project) => (
            <CarouselItem className="basis-full sm:basis-1/2 lg:basis-1/3" key={project.id}>
              <ProjectCard
                completedDate={project.completedDate}
                description={project.description}
                imagePath={getProjectImage(project)}
                title={project.title}
              />
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="left-1 hidden h-10 w-10 rounded-[5px] border-[var(--site-color-border)] bg-white text-[var(--site-color-primary)] md:inline-flex" />
        <CarouselNext className="right-1 hidden h-10 w-10 rounded-[5px] border-[var(--site-color-border)] bg-white text-[var(--site-color-primary)] md:inline-flex" />
      </Carousel>
      <div className="mt-6 flex items-center justify-center gap-2 md:hidden">
        {Array.from({ length: slideCount }).map((_, index) => (
          <button
            aria-label={`Go to project slide ${index + 1}`}
            className={cn(
              "h-2.5 w-2.5 rounded-[5px] border transition-colors duration-200",
              index === currentSlideIndex
                ? "border-[var(--site-color-primary)] bg-[var(--site-color-primary)]"
                : "border-[var(--site-color-border)] bg-transparent"
            )}
            key={`project-dot-${index}`}
            onClick={() => api?.scrollTo(index)}
            type="button"
          />
        ))}
      </div>
    </div>
  );
}
