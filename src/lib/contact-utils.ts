import type { ContactConfig, LocationInfo } from "@/types/config";

interface ContactCollections {
  addresses: string[];
  emails: string[];
  locations: LocationInfo[];
  phoneNumbers: string[];
}

function normalizeString(value: string | undefined): string {
  return (value || "").trim();
}

function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const deduped: string[] = [];

  values.forEach((value) => {
    const normalized = normalizeString(value);
    if (!normalized) return;

    const key = normalized.toLowerCase();
    if (seen.has(key)) return;

    seen.add(key);
    deduped.push(normalized);
  });

  return deduped;
}

function dedupeLocations(values: LocationInfo[]): LocationInfo[] {
  const seen = new Set<string>();
  const deduped: LocationInfo[] = [];

  values.forEach((entry) => {
    const name = normalizeString(entry?.name);
    const url = normalizeString(entry?.url);
    if (!name && !url) return;

    const key = `${name.toLowerCase()}|${url.toLowerCase()}`;
    if (seen.has(key)) return;

    seen.add(key);
    deduped.push({ name, url });
  });

  return deduped;
}

export function getContactCollections(contact: ContactConfig): ContactCollections {
  const phoneNumbers = dedupeStrings([contact.phone, ...(contact.phoneNumbers || [])]);
  const emails = dedupeStrings([contact.email, ...(contact.emails || [])]);
  const addresses = dedupeStrings([contact.address, ...(contact.addresses || [])]);
  const locations = dedupeLocations([contact.location, ...(contact.locations || [])]);

  return {
    addresses,
    emails,
    locations,
    phoneNumbers,
  };
}

export function getPrimaryPhoneNumber(contact: ContactConfig): string {
  return getContactCollections(contact).phoneNumbers[0] || "";
}
