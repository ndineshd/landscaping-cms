import type { ContactConfig, LocationInfo } from "@/types/config";

interface ContactCollections {
  addresses: string[];
  emails: string[];
  locations: LocationInfo[];
  phoneNumbers: string[];
  timings: string[];
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

function getPreferredStrings(
  listValues: string[] | undefined,
  fallbackValue: string
): string[] {
  const normalizedList = dedupeStrings(listValues || []);
  if (normalizedList.length > 0) {
    return normalizedList;
  }
  return dedupeStrings([fallbackValue]);
}

function getPreferredLocations(
  listValues: LocationInfo[] | undefined,
  fallbackValue: LocationInfo
): LocationInfo[] {
  const normalizedList = dedupeLocations(listValues || []);
  if (normalizedList.length > 0) {
    return normalizedList;
  }
  return dedupeLocations([fallbackValue]);
}

export function getContactCollections(contact: ContactConfig): ContactCollections {
  const phoneNumbers = getPreferredStrings(contact.phoneNumbers, contact.phone);
  const emails = getPreferredStrings(contact.emails, contact.email);
  const addresses = getPreferredStrings(contact.addresses, contact.address);
  const timings = dedupeStrings(contact.timings || []);
  const locations = getPreferredLocations(contact.locations, contact.location);

  return {
    addresses,
    emails,
    locations,
    phoneNumbers,
    timings,
  };
}

export function getPrimaryPhoneNumber(contact: ContactConfig): string {
  return getContactCollections(contact).phoneNumbers[0] || "";
}
