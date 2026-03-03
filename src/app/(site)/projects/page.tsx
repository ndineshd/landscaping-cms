import type { Metadata } from "next";

import { FloatingWhatsApp } from "@/components/site/FloatingWhatsApp";
import { ProjectsCarousel } from "@/components/site/ProjectsCarousel";
import { SectionContainer } from "@/components/site/SectionContainer";
import { getActiveProjects } from "@/lib/config-loader";
import { ROUTES } from "@/lib/constants";
import {
  buildPageAlternates,
  parseKeywords,
  resolveMetadataBase,
  toAbsoluteUrl,
} from "@/lib/seo";
import { getSiteCommonData, localizeSiteContent } from "@/lib/site-data";
import type { Project } from "@/types/content";

export async function generateMetadata(): Promise<Metadata> {
  const siteData = await getSiteCommonData();
  const { adminConfig, language, translations } = siteData;
  const projectsCopy = translations.projects || {};
  const metadataBase = resolveMetadataBase();
  const alternates = buildPageAlternates(
    ROUTES.PROJECTS,
    language.currentLanguageCode,
    language.languageCodes,
    metadataBase,
    language.defaultLanguageCode
  );
  const pageTitle = projectsCopy.title || "Our Projects";
  const title = `${pageTitle} | ${adminConfig.site.name}`;
  const description =
    projectsCopy.subtitle || adminConfig.seo.description;
  const keywords = parseKeywords(adminConfig.seo.keywords);
  const ogImage = adminConfig.seo.ogImage
    ? toAbsoluteUrl(adminConfig.seo.ogImage, metadataBase)
    : undefined;
  const canonicalUrl = String(alternates.canonical || "");

  return {
    alternates,
    description,
    keywords,
    openGraph: {
      description,
      images: ogImage ? [{ url: ogImage }] : undefined,
      title,
      type: "website",
      url: canonicalUrl,
    },
    title,
    twitter: {
      card: "summary_large_image",
      description,
      images: ogImage ? [ogImage] : undefined,
      title,
    },
  };
}

export default async function ProjectsPage() {
  const [projectsRaw, siteData] = await Promise.all([
    getActiveProjects(),
    getSiteCommonData(),
  ]);
  const projects = localizeSiteContent(projectsRaw, siteData.language) as Project[];
  const projectsCopy = siteData.translations.projects || {};
  const contactCopy = siteData.translations.contact || {};
  const floatingContact = siteData.adminConfig.contact.floatingContact;
  const subtitle =
    projectsCopy.subtitle ||
    "Browse our portfolio of successful landscaping projects.";

  return (
    <main className="bg-[var(--site-color-background)] pb-20 pt-28">
      <section>
        <SectionContainer>
          <div className="max-w-3xl">
            <h1 className="site-heading text-3xl font-semibold leading-tight md:text-4xl">
              {projectsCopy.title || "Our Projects"}
            </h1>
            <p className="mt-4 text-base text-[var(--site-color-muted-foreground)] md:text-lg">
              {subtitle}
            </p>
          </div>
          <div className="mt-10">
            <ProjectsCarousel
              galleryTitleLabel={projectsCopy.galleryTitle || "Gallery"}
              projects={projects}
              viewGalleryLabel={projectsCopy.viewGallery || "View Gallery"}
            />
          </div>
        </SectionContainer>
      </section>
      {floatingContact.enabled && floatingContact.showWhatsApp ? (
        <FloatingWhatsApp
          ariaLabel={contactCopy.chatOnWhatsApp || "Chat on WhatsApp"}
          defaultMessage={siteData.whatsAppDefaultMessageEnglish}
          number={siteData.adminConfig.contact.whatsapp.number}
        />
      ) : null}
    </main>
  );
}
