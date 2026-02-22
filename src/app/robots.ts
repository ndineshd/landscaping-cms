import type { MetadataRoute } from "next";

import { resolveMetadataBase, toAbsoluteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  const metadataBase = resolveMetadataBase();

  return {
    host: metadataBase.origin,
    rules: [
      {
        allow: "/",
        disallow: ["/admin", "/api"],
        userAgent: "*",
      },
    ],
    sitemap: toAbsoluteUrl("/sitemap.xml", metadataBase),
  };
}
