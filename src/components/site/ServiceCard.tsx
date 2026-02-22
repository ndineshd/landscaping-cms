import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Service } from "@/types/content";

import { SiteImage } from "./SiteImage";

interface ServiceCardProps {
  className?: string;
  href: string;
  service: Service;
  viewDetailsLabel: string;
}

export function ServiceCard({ className, href, service, viewDetailsLabel }: Readonly<ServiceCardProps>) {
  return (
    <Link
      className={cn(
        "group block h-full cursor-pointer overflow-hidden rounded-[5px] border border-[var(--site-color-border)] bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-[var(--site-color-primary)] hover:shadow-md",
        className
      )}
      href={href}
    >
      <div className="flex h-full flex-col bg-white">
        <div className="h-36 shrink-0 bg-[var(--site-color-muted)] md:h-40">
          <SiteImage
            alt={`${service.title} service image`}
            className="h-full w-full"
            imgClassName="transition-[transform,filter] duration-500 group-hover:scale-105 group-hover:brightness-110"
            src={service.image}
          />
        </div>
        <div className="flex-1 p-3.5">
          <h2 className="site-heading line-clamp-2 text-lg font-semibold leading-tight text-[var(--site-color-foreground)]">
            {service.title}
          </h2>
          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-[var(--site-color-muted-foreground)]">
            {service.shortDescription}
          </p>
        </div>
        <div className="mt-auto border-t border-[var(--site-color-border)] px-3.5 pb-3.5 pt-2.5">
          <span className="flex items-center justify-between rounded-[5px] px-2 py-1 text-sm font-semibold text-[var(--site-color-primary)] transition-shadow duration-300 group-hover:shadow-sm">
            <span>{viewDetailsLabel}</span>
            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
          </span>
        </div>
      </div>
    </Link>
  );
}
