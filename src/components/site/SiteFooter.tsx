import { Instagram, Mail, MapPin, Phone } from "lucide-react";

import type { LogoConfig, SocialMediaLink } from "@/types/config";

import { SectionContainer } from "./SectionContainer";
import { SiteLogo } from "./SiteLogo";

interface SiteFooterProps {
  addresses: string[];
  companyName: string;
  contactTitle: string;
  copyright: string;
  emails: string[];
  followUsTitle: string;
  homeHref: string;
  logo: LogoConfig;
  logoText: string;
  phoneNumbers: string[];
  siteDescription: string;
  siteName: string;
  socialMedia: SocialMediaLink[];
}

function getSocialIcon(icon: string) {
  if (icon.toLowerCase() === "instagram") {
    return <Instagram className="h-4 w-4" />;
  }
  return <Instagram className="h-4 w-4" />;
}

/**
 * Website footer.
 */
export function SiteFooter({
  addresses,
  companyName,
  contactTitle,
  copyright,
  emails,
  followUsTitle,
  homeHref,
  logo,
  logoText,
  phoneNumbers,
  siteDescription,
  siteName,
  socialMedia,
}: SiteFooterProps) {
  return (
    <footer className="border-t border-[var(--site-color-border)] bg-[#f4f6f4]">
      <SectionContainer className="py-12">
        <div className="grid gap-10 md:grid-cols-[1.35fr_1fr_0.7fr]">
          <div className="space-y-4">
            <SiteLogo
              companyName={companyName}
              homeHref={homeHref}
              logo={logo}
              logoText={logoText}
              siteName={siteName}
            />
            <p className="max-w-md text-sm leading-relaxed text-[var(--site-color-muted-foreground)]">{siteDescription}</p>
          </div>

          <div>
            <h3 className="site-heading text-lg font-semibold">{contactTitle}</h3>
            <ul className="mt-4 space-y-3 text-sm text-[var(--site-color-muted-foreground)]">
              {phoneNumbers.map((phone, index) => (
                <li className="flex items-center gap-2" key={`footer-phone-${index}`}>
                  <Phone className="h-4 w-4 text-[var(--site-color-primary)]" />
                  <a href={`tel:${phone.replace(/[^\d+]/g, "")}`}>{phone}</a>
                </li>
              ))}
              {emails.map((email, index) => (
                <li className="flex items-center gap-2" key={`footer-email-${index}`}>
                  <Mail className="h-4 w-4 text-[var(--site-color-primary)]" />
                  <a href={`mailto:${email}`}>{email}</a>
                </li>
              ))}
              {addresses.map((address, index) => (
                <li className="flex items-center gap-2" key={`footer-address-${index}`}>
                  <MapPin className="h-4 w-4 text-[var(--site-color-primary)]" />
                  <span>{address}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="site-heading text-lg font-semibold">{followUsTitle}</h3>
            <ul className="mt-4 flex items-center gap-3">
              {socialMedia.map((social) => {
                if (!social.enabled) {
                  return null;
                }

                return (
                  <li key={social.id}>
                    <a
                      aria-label={social.name}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-[5px] border border-[var(--site-color-border)] text-[var(--site-color-muted-foreground)] transition-colors duration-200 hover:border-[var(--site-color-primary)] hover:text-[var(--site-color-primary)]"
                      href={social.url}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {getSocialIcon(social.icon)}
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-[var(--site-color-border)] pt-6 text-xs text-[var(--site-color-muted-foreground)] md:flex-row md:items-center md:justify-between">
          <p>{copyright}</p>
        </div>
      </SectionContainer>
    </footer>
  );
}
