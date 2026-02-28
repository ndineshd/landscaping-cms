"use client";

import { WhatsAppIcon } from "./WhatsAppIcon";

interface ServiceQuoteButtonProps {
  className?: string;
  label?: string;
  number: string;
  serviceTitle: string;
}

function sanitizePhoneNumber(phone: string): string {
  return phone.replace(/[^\d]/g, "");
}

export function ServiceQuoteButton({
  className,
  label = "Contact & Get Quote",
  number,
  serviceTitle,
}: ServiceQuoteButtonProps) {
  const safeNumber = sanitizePhoneNumber(number);
  const message = `Hi, I'm interested in ${serviceTitle} service. Can you share pricing, and next steps?`;
  const href = `https://wa.me/${safeNumber}?text=${encodeURIComponent(message)}`;

  return (
    <a
      className={className}
      href={href}
      rel="noopener noreferrer"
      target="_blank"
    >
      <WhatsAppIcon className="h-5 w-5" />
      <span>{label}</span>
    </a>
  );
}
