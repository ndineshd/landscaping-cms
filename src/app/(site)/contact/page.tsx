import Link from "next/link";
import { ExternalLink, Mail, MapPin, MessageCircleMore, Phone } from "lucide-react";

import { FloatingWhatsApp } from "@/components/site/FloatingWhatsApp";
import { SectionContainer } from "@/components/site/SectionContainer";
import { getSiteCommonData } from "@/lib/site-data";

function sanitizePhoneNumber(value: string): string {
  return value.replace(/[^\d+]/g, "");
}

function sanitizeWhatsAppNumber(value: string): string {
  return value.replace(/[^\d]/g, "");
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
  const floatingContact = adminConfig.contact.floatingContact;
  const locationCardTitle = adminConfig.site.name.includes("GrowWell")
    ? "GrowWell Chennai"
    : adminConfig.contact.location.name || adminConfig.site.name;

  return (
    <main>
      <section className="border-b border-[var(--site-color-border)] bg-[var(--site-color-muted)] pb-14 pt-32 text-center md:pb-16 md:pt-36">
        <SectionContainer>
          <h1 className="site-heading text-4xl font-semibold text-[var(--site-color-foreground)] md:text-4xl">
            {contactCopy.title || "Contact Us"}
          </h1>
          <p className="mx-auto mt-4 max-w-3xl text-base leading-relaxed text-[var(--site-color-muted-foreground)] md:text-lg">
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
                  className="flex items-center gap-4 rounded-2xl border border-[var(--site-color-border)] bg-white px-5 py-[18px] transition-colors hover:border-[var(--site-color-primary)]"
                  href={phoneHref}
                >
                  <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--site-color-muted)] text-[var(--site-color-primary)]">
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
                  className="flex items-center gap-4 rounded-2xl border border-[var(--site-color-border)] bg-white px-5 py-[18px] transition-colors hover:border-[var(--site-color-primary)]"
                  href={whatsappHref}
                  rel="noreferrer"
                  target="_blank"
                >
                  <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--site-color-accent)] text-[#25d366]">
                    <MessageCircleMore className="h-6 w-6" />
                  </span>
                  <span>
                    <span className="block text-sm text-[var(--site-color-muted-foreground)]">{contactCopy.chatOnWhatsApp || "Chat on WhatsApp"}</span>
                    <span className="site-heading block text-2xl font-semibold text-[var(--site-color-foreground)] md:text-[1.65rem]">
                      Start Conversation
                    </span>
                  </span>
                </a>

                <a
                  className="flex items-center gap-4 rounded-2xl border border-[var(--site-color-border)] bg-white px-5 py-[18px] transition-colors hover:border-[var(--site-color-primary)]"
                  href={emailHref}
                >
                  <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--site-color-muted)] text-[var(--site-color-primary)]">
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
                  className="mt-6 inline-flex h-[52px] w-full items-center justify-center gap-3 rounded-full bg-[var(--site-color-primary)] px-7 text-base font-semibold text-white shadow-sm transition-colors hover:bg-[var(--site-color-primary-hover)] md:text-lg"
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
              <div className="relative mt-6 overflow-hidden rounded-3xl border border-[var(--site-color-border)] bg-[#e5e7e5] p-4 md:p-8">
                <div
                  aria-hidden="true"
                  className="absolute inset-0 opacity-85"
                  style={{
                    backgroundImage:
                      "radial-gradient(circle at 12% 25%, #bfc4bf 0 8%, transparent 9%), radial-gradient(circle at 32% 60%, #c7cbc7 0 9%, transparent 10%), radial-gradient(circle at 72% 24%, #c0c4c0 0 9%, transparent 10%), radial-gradient(circle at 86% 68%, #c8ccc8 0 8%, transparent 9%), linear-gradient(135deg, #d9ddd9 0%, #e8ebe8 40%, #dfe3df 100%)",
                  }}
                />
                <div className="relative grid min-h-[360px] place-items-center">
                  <div className="w-full max-w-[295px] rounded-2xl bg-white p-5 text-center shadow-md">
                    <MapPin className="mx-auto h-8 w-8 text-[var(--site-color-primary)]" />
                    <h3 className="site-heading mt-3 text-2xl font-semibold text-[var(--site-color-foreground)] md:text-[1.65rem]">{locationCardTitle}</h3>
                    <p className="mt-2 text-base text-[var(--site-color-muted-foreground)] md:text-lg">{adminConfig.contact.address}</p>
                    <Link
                      className="mt-5 inline-flex h-11 items-center justify-center rounded-lg border border-[var(--site-color-foreground)] px-5 text-sm font-medium text-[var(--site-color-foreground)] transition-colors hover:border-[var(--site-color-primary)] hover:text-[var(--site-color-primary)]"
                      href={directionsHref}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Get Directions
                    </Link>
                  </div>
                </div>
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
