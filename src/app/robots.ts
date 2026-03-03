import type { MetadataRoute } from "next";
import { headers } from "next/headers";

import { isSiteIndexable, resolveMetadataBase, toAbsoluteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const fallbackBase = resolveMetadataBase();
  const requestHeaders = await headers();
  const forwardedHost = requestHeaders.get("x-forwarded-host");
  const host = forwardedHost || requestHeaders.get("host");
  const protoHeader = requestHeaders.get("x-forwarded-proto");
  const protocol = protoHeader || (host?.includes("localhost") ? "http" : "https");
  let metadataBase = fallbackBase;
  if (host) {
    try {
      metadataBase = new URL(`${protocol}://${host}`);
    } catch {
      metadataBase = fallbackBase;
    }
  }
  const shouldIndexSite = isSiteIndexable(metadataBase);

  return {
    host: metadataBase.origin,
    rules: [
      shouldIndexSite
        ? {
            allow: "/",
            disallow: ["/admin", "/api"],
            userAgent: "*",
          }
        : {
            disallow: "/",
            userAgent: "*",
          },
    ],
    sitemap: shouldIndexSite ? toAbsoluteUrl("/sitemap.xml", metadataBase) : undefined,
  };
}
