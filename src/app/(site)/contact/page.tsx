import Link from "next/link";
import { ExternalLink, Mail, Phone } from "lucide-react";

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

function createMapEmbedUrl(address: string): string {
  return `https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed`;
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
  const directionsHref =
    adminConfig.contact.location.url ||
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(adminConfig.contact.address)}`;
  const mapEmbedUrl = createMapEmbedUrl(adminConfig.contact.address);
  const floatingContact = adminConfig.contact.floatingContact;
  const locationCardTitle = adminConfig.site.name.includes("GrowWell")
    ? "GrowWell Chennai"
    : adminConfig.contact.location.name || adminConfig.site.name;

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
                  <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-[5px] bg-[var(--site-color-accent)] text-[#25d366]">
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
              <div className="group relative mt-6 overflow-hidden rounded-[5px] border border-[var(--site-color-border)] bg-[var(--site-color-muted)]">
                <div className="flex items-start justify-between gap-4 border-b border-[var(--site-color-border)] bg-white/95 px-4 py-3">
                  <div>
                    <p className="site-heading text-sm font-semibold text-[var(--site-color-foreground)]">
                      {adminConfig.site.companyName}
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed text-[var(--site-color-muted-foreground)]">
                      {adminConfig.contact.address}
                    </p>
                  </div>
                  <Link
                    className="shrink-0 rounded-[5px] border border-[var(--site-color-border)] px-3 py-1.5 text-xs font-medium text-[var(--site-color-foreground)] transition-colors hover:border-[var(--site-color-primary)] hover:text-[var(--site-color-primary)]"
                    href={directionsHref}
                    rel="noreferrer"
                    target="_blank"
                  >
                    View Large Map
                  </Link>
                </div>
                <iframe
                  aria-label={`${locationCardTitle} map preview`}
                  className="h-[420px] w-full transition-[filter,transform] duration-500 [filter:grayscale(1)_saturate(0.35)_contrast(1.03)] group-hover:[filter:grayscale(0)_saturate(1)] group-hover:scale-[1.01]"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  src={mapEmbedUrl}
                  title={`${locationCardTitle} map`}
                />
              </div>
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
