import Link from "next/link";
import type { ForwardRefExoticComponent, RefAttributes } from "react";
import {
  ArrowRight,
  Building2,
  Droplets,
  Fish,
  Flower2,
  Leaf,
  LucideProps,
  Scissors,
  Shovel,
  Sprout,
  TreeDeciduous,
  WavesLadder,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { Service } from "@/types/content";

type ServiceIcon = ForwardRefExoticComponent<
  Omit<LucideProps, "ref"> & RefAttributes<SVGSVGElement>
>;

const serviceIconMap: Record<string, ServiceIcon> = {
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

interface ServiceCardProps {
  className?: string;
  service: Service;
  viewDetailsLabel: string;
}

function normalizeIconName(iconName: string): string {
  return iconName.trim().toLowerCase().replace(/[_\s]+/g, "-");
}

function getServiceIcon(iconName: string): ServiceIcon {
  const normalized = normalizeIconName(iconName);
  return serviceIconMap[normalized] || Leaf;
}

export function ServiceCard({ className, service, viewDetailsLabel }: Readonly<ServiceCardProps>) {
  const Icon = getServiceIcon(service.icon);
  const imageStyle = service.image
    ? ({ backgroundImage: `url("${service.image}")` } as const)
    : undefined;

  return (
    <Link
      className={cn(
        "group block cursor-pointer rounded-[5px] border border-[var(--site-color-border)] bg-white p-1 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:p-2 hover:shadow-md",
        className
      )}
      href={`/services/${service.id}`}
    >
      <div className="h-full overflow-hidden rounded-[4px] bg-white">
        <div className="relative h-44 bg-[var(--site-color-muted)] md:h-48">
          <div
            className="h-full w-full bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
            style={imageStyle}
          />
          <span className="absolute left-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-[5px] bg-white text-[var(--site-color-primary)] shadow-sm">
            <Icon className="h-4 w-4" />
          </span>
        </div>
        <div className="space-y-3 p-4">
          <h2 className="site-heading text-xl font-semibold leading-tight text-[var(--site-color-foreground)]">
            {service.title}
          </h2>
          <p className="min-h-[54px] text-sm leading-relaxed text-[var(--site-color-muted-foreground)]">
            {service.shortDescription}
          </p>
        </div>
        <div className="border-t border-[var(--site-color-border)] px-4 pb-4 pt-3">
          <span className="inline-flex items-center gap-2 rounded-[5px] bg-[var(--site-color-accent)] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--site-color-primary)]">
            <span>{viewDetailsLabel}</span>
            <ArrowRight className="h-4 w-4" />
          </span>
        </div>
      </div>
    </Link>
  );
}
