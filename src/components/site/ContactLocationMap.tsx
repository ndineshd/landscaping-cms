"use client";

import { LocateFixed } from "lucide-react";
import { useState } from "react";

interface ContactLocationMapProps {
  mapEmbedUrl: string;
  title: string;
}

export function ContactLocationMap({ mapEmbedUrl, title }: ContactLocationMapProps) {
  const [iframeKey, setIframeKey] = useState(0);

  return (
    <div className="relative mt-6 overflow-hidden rounded-[5px] border border-[var(--site-color-border)] bg-[var(--site-color-muted)]">
      <button
        aria-label="Go to configured location"
        className="absolute right-3 top-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#d2e3fc] bg-white/95 text-[#1a73e8] shadow-sm transition-colors hover:bg-[#e8f0fe]"
        onClick={() => setIframeKey((value) => value + 1)}
        title="Go to configured location"
        type="button"
      >
        <LocateFixed className="h-4 w-4" />
      </button>
      <iframe
        key={iframeKey}
        aria-label={`${title} map preview`}
        className="h-[420px] w-full"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        src={mapEmbedUrl}
        title={`${title} map`}
      />
    </div>
  );
}
