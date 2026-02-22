import type { CSSProperties } from "react";
import Link from "next/link";

import type { LogoConfig } from "@/types/config";
import { cn } from "@/lib/utils";

import { SiteImage } from "./SiteImage";

interface SiteLogoProps {
  className?: string;
  companyName: string;
  homeHref?: string;
  logo: LogoConfig;
  logoText: string;
  siteName: string;
}

function getCompanySuffix(companyName: string, siteName: string): string {
  const suffix = companyName.replace(siteName, "").trim();
  return suffix || companyName;
}

function resolveDisplayMode(logo: LogoConfig): "generated-with-name" | "image-with-name" | "image-only" {
  if (logo.displayMode) {
    const normalizedMode = logo.displayMode.trim().toLowerCase().replace(/[_\s]+/g, "-");
    if (normalizedMode.includes("generated")) {
      return "generated-with-name";
    }
    if (normalizedMode.includes("only")) {
      return "image-only";
    }
    if (normalizedMode.includes("image")) {
      return "image-with-name";
    }
  }

  if (logo.type === "image") {
    return logo.showText === false ? "image-only" : "image-with-name";
  }

  return "generated-with-name";
}

function toLogoSize(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.min(Math.max(Math.round(value), 24), 120);
  }
  if (typeof value === "string") {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.min(Math.max(Math.round(parsed), 24), 120);
    }
  }
  return null;
}

function getBadgeSizeStyle(logo: LogoConfig): CSSProperties {
  const desktopWidth = toLogoSize(logo.imageWidth) || 36;
  const desktopHeight = toLogoSize(logo.imageHeight) || desktopWidth;
  const mobileWidth = toLogoSize(logo.imageMobileWidth) || desktopWidth;
  const mobileHeight = toLogoSize(logo.imageMobileHeight) || desktopHeight;

  return {
    "--logo-width-desktop": `${desktopWidth}px`,
    "--logo-height-desktop": `${desktopHeight}px`,
    "--logo-width-mobile": `${mobileWidth}px`,
    "--logo-height-mobile": `${mobileHeight}px`,
  } as CSSProperties;
}

function renderLogoBadge(logo: LogoConfig, logoText: string, siteName: string) {
  const hasImage = Boolean(logo.imageUrl && logo.imageUrl.trim().length > 0);
  const badgeStyle = getBadgeSizeStyle(logo);
  if (!hasImage) {
    return (
      <span
        className="site-logo-badge grid place-items-center rounded-[5px] bg-[var(--site-color-primary)] text-xs font-bold uppercase text-white"
        style={badgeStyle}
      >
        {logoText}
      </span>
    );
  }

  const imageStyle: CSSProperties = {
    mixBlendMode: logo.imageBlendMode || "multiply",
    objectFit: logo.imageObjectFit || "contain",
  };

  return (
    <span
      className="site-logo-badge relative inline-flex items-center justify-center overflow-hidden"
      style={badgeStyle}
    >
      <SiteImage
        alt={`${siteName} logo`}
        className="h-full w-full"
        imgClassName="h-full w-full"
        src={logo.imageUrl}
        style={imageStyle}
      />
    </span>
  );
}

/**
 * Shared brand logo block for header and footer.
 */
export function SiteLogo({ className, companyName, homeHref = "/", logo, logoText, siteName }: SiteLogoProps) {
  const companySuffix = getCompanySuffix(companyName, siteName);
  const mode = resolveDisplayMode(logo);
  const onlyImage = mode === "image-only";
  const showImage = mode !== "generated-with-name";
  const logoWithMode = showImage ? logo : { ...logo, imageUrl: "" };

  return (
    <Link aria-label={`${siteName} home`} className={cn("inline-flex items-center gap-3", className)} href={homeHref}>
      {renderLogoBadge(logoWithMode, logoText, siteName)}
      {!onlyImage ? (
        <span className="leading-tight">
          <span className="site-heading block text-base font-semibold">{siteName}</span>
          <span className="block text-[10px] uppercase tracking-wide opacity-70">{companySuffix}</span>
        </span>
      ) : null}
    </Link>
  );
}
