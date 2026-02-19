import type { CSSProperties } from "react";

import type { LogoConfig } from "@/types/config";
import { cn } from "@/lib/utils";

interface SiteLogoProps {
  className?: string;
  companyName: string;
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
  const width = toLogoSize(logo.imageWidth) || 36;
  const height = toLogoSize(logo.imageHeight) || width;
  return {
    width,
    height,
  };
}

function renderLogoBadge(logo: LogoConfig, logoText: string, siteName: string) {
  const hasImage = Boolean(logo.imageUrl && logo.imageUrl.trim().length > 0);
  const badgeStyle = getBadgeSizeStyle(logo);
  if (!hasImage) {
    return (
      <span
        className="grid place-items-center rounded-[5px] bg-[var(--site-color-primary)] text-xs font-bold uppercase text-white"
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
      className="relative inline-flex items-center justify-center overflow-hidden rounded-[5px] bg-[var(--site-color-accent)] p-1.5"
      style={badgeStyle}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt={`${siteName} logo`}
        className="h-full w-full"
        src={logo.imageUrl}
        style={imageStyle}
      />
    </span>
  );
}

/**
 * Shared brand logo block for header and footer.
 */
export function SiteLogo({ className, companyName, logo, logoText, siteName }: SiteLogoProps) {
  const companySuffix = getCompanySuffix(companyName, siteName);
  const mode = resolveDisplayMode(logo);
  const onlyImage = mode === "image-only";
  const showImage = mode !== "generated-with-name";
  const logoWithMode = showImage ? logo : { ...logo, imageUrl: "" };

  return (
    <div className={cn("flex items-center gap-3", className)}>
      {renderLogoBadge(logoWithMode, logoText, siteName)}
      {!onlyImage ? (
        <span className="leading-tight">
          <span className="site-heading block text-base font-semibold">{siteName}</span>
          <span className="block text-[10px] uppercase tracking-wide opacity-70">{companySuffix}</span>
        </span>
      ) : null}
    </div>
  );
}
