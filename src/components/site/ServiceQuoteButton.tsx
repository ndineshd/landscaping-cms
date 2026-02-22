"use client";

import { useEffect, useMemo, useState } from "react";

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
  const [serviceUrl, setServiceUrl] = useState<string>("");

  useEffect(() => {
    setServiceUrl(window.location.href);
  }, []);

  const href = useMemo(() => {
    const safeNumber = sanitizePhoneNumber(number);
    const lines = [
      "Hi GrowWell Team,",
      `I would like a quote for "${serviceTitle}".`,
      serviceUrl ? `Service link: ${serviceUrl}` : "",
      "Please share pricing, timeline, and next steps.",
      "Thank you.",
    ].filter(Boolean);
    const message = lines.join("\n");

    return `https://wa.me/${safeNumber}?text=${encodeURIComponent(message)}`;
  }, [number, serviceTitle, serviceUrl]);

  return (
    <a
      className={className}
      href={href}
      rel="noreferrer"
      target="_blank"
    >
      <WhatsAppIcon className="h-5 w-5" />
      <span>{label}</span>
    </a>
  );
}
