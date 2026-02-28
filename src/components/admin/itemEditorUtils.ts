export interface SelectOption {
  label: string;
  value: string;
}

const FIELD_SELECT_OPTIONS: Record<string, SelectOption[]> = {
  "site.logo.displayMode": [
    { label: "Generated + Company Name", value: "generated-with-name" },
    { label: "Image + Company Name", value: "image-with-name" },
    { label: "Image Only", value: "image-only" },
  ],
  "site.logo.type": [
    { label: "Generated", value: "text" },
    { label: "Image", value: "image" },
  ],
  "site.logo.imageObjectFit": [
    { label: "Contain", value: "contain" },
    { label: "Cover", value: "cover" },
  ],
  "site.logo.imageBlendMode": [
    { label: "Normal", value: "normal" },
    { label: "Multiply", value: "multiply" },
    { label: "Screen", value: "screen" },
    { label: "Overlay", value: "overlay" },
    { label: "Darken", value: "darken" },
    { label: "Lighten", value: "lighten" },
    { label: "Color", value: "color" },
    { label: "Luminosity", value: "luminosity" },
  ],
};

const IMAGE_FIELD_KEYWORDS = [
  "image",
  "photo",
  "thumbnail",
  "banner",
  "logo",
  "favicon",
  "ogimage",
];
const IMAGE_METADATA_KEYWORDS = ["width", "height", "blend", "objectfit", "fit", "ratio"];
const IMAGE_PARENT_KEYWORDS = ["images", "gallery", "photos", "banners"];

export function createDefaultFromSample(sample: unknown): unknown {
  if (Array.isArray(sample)) {
    return [];
  }

  if (isRecord(sample)) {
    return Object.fromEntries(
      Object.entries(sample).map(([key, value]) => [key, createDefaultFromSample(value)])
    );
  }

  if (typeof sample === "number") {
    return 0;
  }

  if (typeof sample === "boolean") {
    return false;
  }

  return "";
}

export function createUploadInputId(fieldPath: (string | number)[], scopeId: string): string {
  return `upload-${scopeId}-${fieldPath
    .map((segment) => String(segment))
    .join("-")
    .replace(/[^a-zA-Z0-9-]/g, "-")
    .toLowerCase()}`;
}

export function getFieldSelectOptions(fieldPath: (string | number)[]): SelectOption[] | null {
  const pathKey = fieldPath
    .filter((segment): segment is string => typeof segment === "string")
    .join(".");

  return FIELD_SELECT_OPTIONS[pathKey] || null;
}

export function isImageLikeField(
  fieldName: string,
  value: unknown,
  fieldPath: (string | number)[]
): boolean {
  if (isImageMetadataField(fieldPath)) {
    return false;
  }

  if (typeof value === "string" && isImagePath(value)) {
    return true;
  }

  const normalizedFieldName = fieldName.toLowerCase().replace(/[^a-z0-9]/g, "");

  if (IMAGE_FIELD_KEYWORDS.some((keyword) => normalizedFieldName.includes(keyword))) {
    return true;
  }

  return pathLooksLikeImage(fieldPath);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isVideoPath(value: string): boolean {
  const trimmedValue = value.trim().toLowerCase();

  if (!trimmedValue) {
    return false;
  }

  return (
    /^https?:\/\/.+\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(trimmedValue) ||
    /^\/.+\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(trimmedValue)
  );
}

export function shouldUseTextarea(fieldName: string, value: unknown): boolean {
  return (
    typeof value === "string" &&
    (value.length > 100 ||
      fieldName.toLowerCase().includes("description") ||
      fieldName.toLowerCase().includes("message"))
  );
}

export function toLabel(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function isImageMetadataField(fieldPath: (string | number)[]): boolean {
  const stringSegments = fieldPath.filter(
    (segment): segment is string => typeof segment === "string"
  );

  if (stringSegments.length === 0) {
    return false;
  }

  const leafSegment = stringSegments[stringSegments.length - 1]
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

  return IMAGE_METADATA_KEYWORDS.some((keyword) => leafSegment.includes(keyword));
}

function isImagePath(value: string): boolean {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return false;
  }

  if (
    /^https?:\/\/.+\.(jpg|jpeg|png|webp|gif|svg)(\?.*)?$/i.test(trimmedValue) ||
    /^\/.+\.(jpg|jpeg|png|webp|gif|svg)(\?.*)?$/i.test(trimmedValue)
  ) {
    return true;
  }

  return trimmedValue.startsWith("/uploads/");
}

function pathLooksLikeImage(fieldPath: (string | number)[]): boolean {
  const stringSegments = fieldPath.filter(
    (segment): segment is string => typeof segment === "string"
  );

  if (stringSegments.length === 0) {
    return false;
  }

  const leafSegment = stringSegments[stringSegments.length - 1]
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  const parentSegment =
    stringSegments.length > 1
      ? stringSegments[stringSegments.length - 2]
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "")
      : "";

  if (IMAGE_FIELD_KEYWORDS.some((keyword) => leafSegment.includes(keyword))) {
    return true;
  }

  return IMAGE_PARENT_KEYWORDS.some((keyword) => parentSegment.includes(keyword));
}
