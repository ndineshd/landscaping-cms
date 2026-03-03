const MAP_ALLOWED_HOSTS = new Set([
  "google.com",
  "www.google.com",
  "maps.google.com",
  "maps.app.goo.gl",
  "goo.gl",
]);

const PRIVATE_IPV4_RANGES = [
  { max: [10, 255, 255, 255], min: [10, 0, 0, 0] },
  { max: [127, 255, 255, 255], min: [127, 0, 0, 0] },
  { max: [172, 31, 255, 255], min: [172, 16, 0, 0] },
  { max: [192, 168, 255, 255], min: [192, 168, 0, 0] },
  { max: [169, 254, 255, 255], min: [169, 254, 0, 0] },
];

function isIPv4(hostname: string): boolean {
  const parts = hostname.split(".");
  if (parts.length !== 4) return false;
  return parts.every((part) => /^\d+$/.test(part) && Number(part) >= 0 && Number(part) <= 255);
}

function compareIPv4(left: number[], right: number[]): number {
  for (let index = 0; index < 4; index += 1) {
    if (left[index] === right[index]) continue;
    return left[index] > right[index] ? 1 : -1;
  }
  return 0;
}

function isPrivateIPv4(hostname: string): boolean {
  if (!isIPv4(hostname)) return false;
  const ip = hostname.split(".").map((part) => Number(part));
  return PRIVATE_IPV4_RANGES.some((range) => {
    return compareIPv4(ip, range.min) >= 0 && compareIPv4(ip, range.max) <= 0;
  });
}

function isPrivateOrLocalHost(hostname: string): boolean {
  const lowerHost = hostname.trim().toLowerCase();
  if (!lowerHost) return true;

  if (
    lowerHost === "localhost" ||
    lowerHost === "::1" ||
    lowerHost.endsWith(".localhost") ||
    lowerHost.endsWith(".local") ||
    lowerHost.endsWith(".internal")
  ) {
    return true;
  }

  if (isPrivateIPv4(lowerHost)) {
    return true;
  }

  return (
    lowerHost.startsWith("fc") ||
    lowerHost.startsWith("fd") ||
    lowerHost.startsWith("fe80:")
  );
}

function isAllowedMapHost(hostname: string): boolean {
  const normalizedHost = hostname.trim().toLowerCase();
  return Array.from(MAP_ALLOWED_HOSTS).some(
    (allowedHost) =>
      normalizedHost === allowedHost || normalizedHost.endsWith(`.${allowedHost}`)
  );
}

export function toSafeHttpUrl(value: string | undefined): string | null {
  const normalized = (value || "").trim();
  if (!normalized) return null;
  try {
    const parsed = new URL(normalized);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return null;
    }
    if (isPrivateOrLocalHost(parsed.hostname)) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

export function toSafeMapUrl(value: string | undefined): string | null {
  const safe = toSafeHttpUrl(value);
  if (!safe) return null;
  const parsed = new URL(safe);
  if (!isAllowedMapHost(parsed.hostname)) {
    return null;
  }
  return parsed.toString();
}
