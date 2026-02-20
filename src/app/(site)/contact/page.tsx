import { ExternalLink, Mail, Phone } from "lucide-react";

import { ContactLocationMap } from "@/components/site/ContactLocationMap";
import { FloatingWhatsApp } from "@/components/site/FloatingWhatsApp";
import { SectionContainer } from "@/components/site/SectionContainer";
import { WhatsAppIcon } from "@/components/site/WhatsAppIcon";
import { getSiteCommonData } from "@/lib/site-data";

function sanitizePhoneNumber(value: string): string {
  return value.replace(/[^\d+]/g, "");
}

function sanitizeWhatsAppNumber(value: string): string {
  return value.replace(/[^\d]/g, "");
}

function extractCoordinatesFromMapUrl(value: string): string | null {
  const decodedValue = decodeURIComponent(value);
  const patterns = [
    /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
    /\/place\/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
    /[?&](?:q|query|ll)=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/,
  ];

  for (const pattern of patterns) {
    const match = decodedValue.match(pattern);
    if (match) {
      return `${match[1]},${match[2]}`;
    }
  }

  return null;
}

async function resolveGoogleMapsUrl(url: string): Promise<string> {
  try {
    const response = await fetch(url, { redirect: "follow" });
    return response.url || url;
  } catch {
    return url;
  }
}

async function createMapEmbedUrl(
  locationUrl: string | undefined,
  fallbackQuery: string
): Promise<string> {
  const normalizedLocationUrl = locationUrl?.trim();

  if (normalizedLocationUrl) {
    if (normalizedLocationUrl.includes("/maps/embed")) {
      return normalizedLocationUrl;
    }

    const resolvedUrl = await resolveGoogleMapsUrl(normalizedLocationUrl);
    const pinnedCoordinates =
      extractCoordinatesFromMapUrl(resolvedUrl) ||
      extractCoordinatesFromMapUrl(normalizedLocationUrl);

    if (pinnedCoordinates) {
      return `https://www.google.com/maps?q=${encodeURIComponent(pinnedCoordinates)}&z=18&output=embed`;
    }

    return `https://www.google.com/maps?q=${encodeURIComponent(resolvedUrl)}&output=embed`;
  }

  return `https://www.google.com/maps?q=${encodeURIComponent(fallbackQuery)}&output=embed`;
}

export default async function ContactPage() {
  const siteData = await getSiteCommonData();
  const { adminConfig } = siteData;
  const contactCopy = siteData.translations.contact || {};
  const social = adminConfig.socialMedia.find(
    (item) => item.enabled && item.name.toLowerCase().includes("instagram")
  );

  const phoneHref = `tel:${sanitizePhoneNumber(adminConfig.contact.phone)}`;
  const emailHref = `mailto:${adminConfig.contact.email}`;
  const whatsappHref = `https://wa.me/${sanitizeWhatsAppNumber(adminConfig.contact.whatsapp.number)}?text=${encodeURIComponent(adminConfig.contact.whatsapp.defaultMessage)}`;
  const mapQuery = adminConfig.contact.location.name
    ? `${adminConfig.contact.location.name}, ${adminConfig.contact.address}`
    : adminConfig.contact.address;
  const mapEmbedUrl = await createMapEmbedUrl(adminConfig.contact.location.url, mapQuery);
  const floatingContact = adminConfig.contact.floatingContact;
  const locationCardTitle =
    adminConfig.contact.location.name || adminConfig.site.companyName || adminConfig.site.name;

  return (
    <main>
      <section className="relative overflow-hidden border-b border-[var(--site-color-border)] pb-14 pt-32 text-center md:pb-16 md:pt-36">
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(130deg, #183a2a 0%, #1f4d35 42%, #2a6848 100%), radial-gradient(circle at 16% 22%, rgba(255,255,255,0.16) 0 12%, transparent 13%), radial-gradient(circle at 84% 70%, rgba(255,255,255,0.14) 0 10%, transparent 11%)",
          }}
        />
        <SectionContainer className="relative">
          <h1 className="site-heading text-4xl font-semibold text-white md:text-4xl">
            {contactCopy.title || "Contact Us"}
          </h1>
          <p className="mx-auto mt-4 max-w-3xl text-base leading-relaxed text-white/85 md:text-lg">
            {contactCopy.subtitle ||
              "Let's build your dream garden! Reach out to us for quotes, consultations, or any questions."}
          </p>
        </SectionContainer>
      </section>

      <section className="bg-white py-10 md:py-14">
        <SectionContainer>
          <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
            <div>
              <h2 className="site-heading text-3xl font-semibold text-[var(--site-color-foreground)] md:text-3xl">Get in Touch</h2>
              <div className="mt-6 space-y-4">
                <a
                  className="flex items-center gap-4 rounded-[5px] border border-[var(--site-color-border)] bg-white px-5 py-[18px] transition-colors hover:border-[var(--site-color-primary)]"
                  href={phoneHref}
                >
                  <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-[5px] bg-[var(--site-color-muted)] text-[var(--site-color-primary)]">
                    <Phone className="h-6 w-6" />
                  </span>
                  <span>
                    <span className="block text-sm text-[var(--site-color-muted-foreground)]">{contactCopy.callUs || "Call Us"}</span>
                    <span className="site-heading block text-2xl font-semibold text-[var(--site-color-foreground)] md:text-[1.65rem]">
                      {adminConfig.contact.phone}
                    </span>
                  </span>
                </a>

                <a
                  className="flex items-center gap-4 rounded-[5px] border border-[var(--site-color-border)] bg-white px-5 py-[18px] transition-colors hover:border-[var(--site-color-primary)]"
                  href={whatsappHref}
                  rel="noreferrer"
                  target="_blank"
                >
                  <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#25d366] text-white shadow-sm">
                    <WhatsAppIcon className="h-6 w-6" />
                  </span>
                  <span>
                    <span className="block text-sm text-[var(--site-color-muted-foreground)]">{contactCopy.chatOnWhatsApp || "Chat on WhatsApp"}</span>
                    <span className="site-heading block text-2xl font-semibold text-[var(--site-color-foreground)] md:text-[1.65rem]">
                      Start Conversation
                    </span>
                  </span>
                </a>

                <a
                  className="flex items-center gap-4 rounded-[5px] border border-[var(--site-color-border)] bg-white px-5 py-[18px] transition-colors hover:border-[var(--site-color-primary)]"
                  href={emailHref}
                >
                  <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-[5px] bg-[var(--site-color-muted)] text-[var(--site-color-primary)]">
                    <Mail className="h-6 w-6" />
                  </span>
                  <span>
                    <span className="block text-sm text-[var(--site-color-muted-foreground)]">{contactCopy.emailUs || "Email Us"}</span>
                    <span className="site-heading block break-all text-xl font-semibold text-[var(--site-color-foreground)] md:text-xl">
                      {adminConfig.contact.email}
                    </span>
                  </span>
                </a>
              </div>

              {social ? (
                <a
                  className="mt-6 inline-flex h-[52px] w-full items-center justify-center gap-3 rounded-[5px] bg-[var(--site-color-primary)] px-7 text-base font-semibold text-white shadow-sm transition-colors hover:bg-[var(--site-color-primary-hover)] md:text-lg"
                  href={social.url}
                  rel="noreferrer"
                  target="_blank"
                >
                  <span>{contactCopy.followUs || "Follow us on Instagram"}</span>
                  <ExternalLink className="h-5 w-5" />
                </a>
              ) : null}
            </div>

            <div>
              <h2 className="site-heading text-3xl font-semibold text-[var(--site-color-foreground)] md:text-3xl">Visit Us</h2>
              <ContactLocationMap mapEmbedUrl={mapEmbedUrl} title={locationCardTitle} />
            </div>
          </div>
        </SectionContainer>
      </section>

      {floatingContact.enabled && floatingContact.showWhatsApp ? (
        <FloatingWhatsApp
          defaultMessage={adminConfig.contact.whatsapp.defaultMessage}
          number={adminConfig.contact.whatsapp.number}
        />
      ) : null}
    </main>
  );
}
