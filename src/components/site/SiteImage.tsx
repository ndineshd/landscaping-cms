"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { Leaf } from "lucide-react";

import { cn } from "@/lib/utils";

interface SiteImageProps {
  alt: string;
  src?: string | null;
  className?: string;
  imgClassName?: string;
  loading?: "lazy" | "eager";
  style?: CSSProperties;
}

function normalizeImageSource(src?: string | null): string {
  if (!src) return "";
  return src.trim();
}

export function SiteImage({
  alt,
  src,
  className,
  imgClassName,
  loading = "lazy",
  style,
}: Readonly<SiteImageProps>) {
  const [hasError, setHasError] = useState(false);
  const normalizedSrc = useMemo(() => normalizeImageSource(src), [src]);
  const canRenderImage = normalizedSrc.length > 0 && !hasError;

  return (
    <div className={cn("relative overflow-hidden", className)}>
      {canRenderImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt={alt}
          className={cn("h-full w-full object-cover object-center", imgClassName)}
          decoding="async"
          loading={loading}
          onError={() => setHasError(true)}
          src={normalizedSrc}
          style={style}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center border border-slate-300 bg-slate-100 text-slate-500">
          <Leaf aria-hidden="true" className="h-8 w-8" />
        </div>
      )}
    </div>
  );
}
