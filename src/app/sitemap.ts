import type { MetadataRoute } from "next";
import { headers } from "next/headers";

import { configLoader, getActiveServices } from "@/lib/config-loader";
import { ROUTES } from "@/lib/constants";
import { isSiteIndexable, resolveMetadataBase, toAbsoluteUrl } from "@/lib/seo";
import { createLocalizedPath, resolveSiteLanguage } from "@/lib/site-i18n";

export const dynamic = "force-dynamic";

const STATIC_SITE_PATHS: Array<{
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  path: string;
  priority: number;
}> = [
  {
    changeFrequency: "weekly",
    path: ROUTES.HOME,
    priority: 1,
  },
  {
    changeFrequency: "weekly",
    path: ROUTES.SERVICES,
    priority: 0.9,
  },
  {
    changeFrequency: "monthly",
    path: ROUTES.CONTACT,
    priority: 0.8,
  },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
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
  if (!isSiteIndexable(metadataBase)) {
    return [];
  }
  const adminConfig = await configLoader.loadAdminConfig();
  const languageState = resolveSiteLanguage(adminConfig.site);
  const services = await getActiveServices();
  const now = new Date();
  const seenUrls = new Set<string>();
  const entries: MetadataRoute.Sitemap = [];

  const addEntry = (
    path: string,
    changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"],
    priority: number
  ) => {
    languageState.languageCodes.forEach((languageCode) => {
      const localizedPath = createLocalizedPath(
        path,
        languageCode,
        languageState.languageCodes
      );
      const url = toAbsoluteUrl(localizedPath, metadataBase);
      if (seenUrls.has(url)) return;
      seenUrls.add(url);
      entries.push({
        changeFrequency,
        lastModified: now,
        priority,
        url,
      });
    });
  };

  STATIC_SITE_PATHS.forEach((entry) => {
    addEntry(entry.path, entry.changeFrequency, entry.priority);
  });

  services.forEach((service) => {
    addEntry(
      `${ROUTES.SERVICE_DETAIL}/${service.id}`,
      "weekly",
      0.7
    );
  });

  return entries;
}
