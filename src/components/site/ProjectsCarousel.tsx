"use client";

import { ChevronLeft, ChevronRight, Images } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  onOpenGallery: () => void;
  showGalleryAction: boolean;
  title: string;
  viewGalleryLabel: string;
}

interface ProjectsCarouselProps {
  galleryTitleLabel?: string;
  projects: Project[];
  viewGalleryLabel?: string;
}

function isVideoMediaPath(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return false;
  return /\.(mp4|webm|ogg|mov)(\?.*)?$/.test(normalized);
}

function isImageMediaPath(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return false;
  return /\.(jpg|jpeg|png|webp|gif|svg)(\?.*)?$/.test(normalized);
}

function getProjectImage(project: Project): string {
  if (
    project.image &&
    project.image.trim().length > 0 &&
    isImageMediaPath(project.image)
  ) {
    return project.image;
  }
  if (project.images && project.images.length > 0) {
    const firstImageFromGallery = project.images.find((entry) =>
      isImageMediaPath(entry || "")
    );
    if (firstImageFromGallery) return firstImageFromGallery;
  }
  return "/uploads/site/site/img-1771472600648.jpeg";
}

function getProjectGalleryImages(project: Project): string[] {
  const values = [project.image, ...(project.images || [])];
  const seen = new Set<string>();

  const deduped = values.reduce<string[]>((items, value) => {
    const normalized = (value || "").trim();
    if (!normalized) return items;

    const key = normalized.toLowerCase();
    if (seen.has(key)) return items;

    seen.add(key);
    items.push(normalized);
    return items;
  }, []);

  return deduped;
}

function isProjectGalleryEnabled(showGallery: unknown): boolean {
  if (typeof showGallery === "boolean") return showGallery;
  if (typeof showGallery === "number") return showGallery !== 0;

  if (typeof showGallery === "string") {
    const normalized = showGallery.trim().toLowerCase();
    if (!normalized) return false;
    if (["false", "0", "no", "off"].includes(normalized)) return false;
    if (["true", "1", "yes", "on"].includes(normalized)) return true;
    return false;
  }

  if (showGallery === undefined) return true;
  return false;
}

function shouldShowGalleryAction(project: Project): boolean {
  return isProjectGalleryEnabled(project.showGallery) && getProjectGalleryImages(project).length > 0;
}

function ProjectCard({
  completedDate,
  description,
  imagePath,
  onOpenGallery,
  showGalleryAction,
  title,
  viewGalleryLabel,
}: ProjectCardProps) {
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
        {showGalleryAction ? (
          <button
            className="mt-2 inline-flex items-center gap-2 rounded-[5px] border border-white/40 bg-black/45 px-3 py-2 text-xs font-semibold text-white transition-colors hover:border-white hover:bg-black/60"
            onClick={onOpenGallery}
            type="button"
          >
            <Images className="h-3.5 w-3.5" />
            {viewGalleryLabel}
          </button>
        ) : null}
      </div>
    </article>
  );
}

/**
 * Client carousel for project cards.
 */
export function ProjectsCarousel({
  galleryTitleLabel = "Gallery",
  projects,
  viewGalleryLabel = "View Gallery",
}: ProjectsCarouselProps) {
  const [api, setApi] = useState<CarouselApi | null>(null);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [slideCount, setSlideCount] = useState(0);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activeGalleryIndex, setActiveGalleryIndex] = useState(0);

  const activeProject = useMemo(
    () => projects.find((project) => project.id === activeProjectId) || null,
    [activeProjectId, projects]
  );
  const activeGalleryImages = useMemo(
    () =>
      activeProject && shouldShowGalleryAction(activeProject)
        ? getProjectGalleryImages(activeProject)
        : [],
    [activeProject]
  );

  const moveGallery = (direction: 1 | -1) => {
    if (activeGalleryImages.length <= 1) return;
    setActiveGalleryIndex((prevIndex) => {
      const next = prevIndex + direction;
      if (next < 0) return activeGalleryImages.length - 1;
      if (next >= activeGalleryImages.length) return 0;
      return next;
    });
  };

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

  useEffect(() => {
    if (activeGalleryIndex < activeGalleryImages.length) return;
    setActiveGalleryIndex(0);
  }, [activeGalleryImages.length, activeGalleryIndex]);

  return (
    <>
      <div className="mt-10">
        <Carousel opts={{ align: "start", loop: true }} setApi={setApi}>
          <CarouselContent>
            {projects.map((project) => (
              <CarouselItem className="basis-full sm:basis-1/2 lg:basis-1/3" key={project.id}>
                <ProjectCard
                  completedDate={project.completedDate}
                  description={project.description}
                  imagePath={getProjectImage(project)}
                  onOpenGallery={() => {
                    setActiveProjectId(project.id);
                    setActiveGalleryIndex(0);
                  }}
                  showGalleryAction={shouldShowGalleryAction(project)}
                  title={project.title}
                  viewGalleryLabel={viewGalleryLabel}
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

      <Dialog
        open={Boolean(activeProject && activeGalleryImages.length > 0)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setActiveProjectId(null);
            setActiveGalleryIndex(0);
          }
        }}
      >
        <DialogContent className="max-w-[96vw] border-[var(--site-color-border)] bg-white p-4 sm:max-w-4xl" showCloseButton>
          <DialogHeader>
            <DialogTitle className="site-heading text-xl text-[var(--site-color-foreground)]">
              {activeProject?.title} {galleryTitleLabel}
            </DialogTitle>
          </DialogHeader>

          {activeGalleryImages.length > 0 ? (
            <div className="space-y-3">
              <div className="relative overflow-hidden rounded-[5px] border border-[var(--site-color-border)] bg-[var(--site-color-muted)]">
                {isVideoMediaPath(activeGalleryImages[activeGalleryIndex]) ? (
                  // eslint-disable-next-line jsx-a11y/media-has-caption
                  <video
                    className="h-[52vh] w-full bg-black object-contain"
                    controls
                    src={activeGalleryImages[activeGalleryIndex]}
                  />
                ) : (
                  <SiteImage
                    alt={`${activeProject?.title || "Project"} gallery image ${activeGalleryIndex + 1}`}
                    className="h-[52vh] w-full"
                    imgClassName="object-contain bg-black/85"
                    src={activeGalleryImages[activeGalleryIndex]}
                  />
                )}
                {activeGalleryImages.length > 1 ? (
                  <>
                    <button
                      aria-label="Previous image"
                      className="absolute left-3 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-black/55 text-white transition-colors hover:bg-black/70"
                      onClick={() => moveGallery(-1)}
                      type="button"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                      aria-label="Next image"
                      className="absolute right-3 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-black/55 text-white transition-colors hover:bg-black/70"
                      onClick={() => moveGallery(1)}
                      type="button"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </>
                ) : null}
              </div>

              {activeGalleryImages.length > 1 ? (
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                  {activeGalleryImages.map((image, index) => (
                    <button
                      className={cn(
                        "overflow-hidden rounded-[5px] border bg-[var(--site-color-muted)]",
                        index === activeGalleryIndex
                          ? "border-[var(--site-color-primary)]"
                          : "border-[var(--site-color-border)]"
                      )}
                      key={`${activeProject?.id || "project"}-gallery-thumb-${index}`}
                      onClick={() => setActiveGalleryIndex(index)}
                      type="button"
                    >
                      {isVideoMediaPath(image) ? (
                        // eslint-disable-next-line jsx-a11y/media-has-caption
                        <video className="h-14 w-full bg-black object-cover" muted src={image} />
                      ) : (
                        <SiteImage
                          alt={`${activeProject?.title || "Project"} thumbnail ${index + 1}`}
                          className="h-14 w-full"
                          src={image}
                        />
                      )}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
