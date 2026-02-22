/**
 * Admin CMS utilities and helpers
 */

/**
 * Available file paths for the CMS
 */
export const CMS_FILES = {
  ADMIN_CONFIG: "src/data/content/admin.config.json",
  PROJECTS: "src/data/content/projects.json",
  SERVICES: "src/data/content/services.json",
  TRANSLATIONS: "src/data/content/translations.json",
} as const;

/**
 * File metadata for display
 */
export const CMS_FILE_METADATA = {
  [CMS_FILES.ADMIN_CONFIG]: {
    label: "Site Configuration",
    description: "General site settings, theme, SEO, and contact info",
    icon: "Settings",
  },
  [CMS_FILES.PROJECTS]: {
    label: "Projects",
    description: "Portfolio projects and case studies",
    icon: "Image",
  },
  [CMS_FILES.SERVICES]: {
    label: "Services",
    description: "Service offerings and features",
    icon: "Briefcase",
  },
  [CMS_FILES.TRANSLATIONS]: {
    label: "Translations",
    description: "Multi-language content and strings",
    icon: "Globe",
  },
} as const;

/**
 * Get display label for file path
 * @param filePath - File path
 * @returns Display label
 */
export function getFileLabel(filePath: string): string {
  const metadata = CMS_FILE_METADATA[filePath as keyof typeof CMS_FILE_METADATA];
  return metadata?.label || filePath;
}

/**
 * Get metadata for file path
 * @param filePath - File path
 * @returns File metadata
 */
export function getFileMetadata(filePath: string): typeof CMS_FILE_METADATA[keyof typeof CMS_FILE_METADATA] | null {
  return CMS_FILE_METADATA[filePath as keyof typeof CMS_FILE_METADATA] || null;
}

/**
 * Extract dynamic fields from data items
 * @param items - Array of data items
 * @returns Array of field names
 */
export function extractFieldsFromItems(
  items: Record<string, unknown>[]
): string[] {
  if (!items || items.length === 0) return [];

  const allKeys = new Set<string>();
  items.forEach((item) => {
    if (typeof item === "object" && item !== null) {
      Object.keys(item).forEach((key) => allKeys.add(key));
    }
  });

  return Array.from(allKeys).sort();
}

/**
 * Detect field type based on value
 * @param value - Field value
 * @returns Detected field type
 */
export function detectFieldType(value: unknown): string {
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return "number";
  if (Array.isArray(value)) return "array";
  if (typeof value === "string" && value.startsWith("/uploads/"))
    return "image";
  return "string";
}

/**
 * Validate email address
 * @param email - Email to validate
 * @returns True if valid email
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate URL
 * @param url - URL to validate
 * @returns True if valid URL
 */
export function validateURL(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Convert value to appropriate type
 * @param value - Value to convert
 * @param type - Target type
 * @returns Converted value
 */
export function convertValue(value: unknown, type: string): unknown {
  switch (type) {
    case "number":
      return Number(value);
    case "boolean":
      return value === true || value === "true";
    case "array":
      if (typeof value === "string") {
        return value.split(",").map((item) => item.trim());
      }
      return value;
    default:
      return String(value);
  }
}

/**
 * Stringify value for display
 * @param value - Value to stringify
 * @returns String representation
 */
export function stringifyValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/**
 * Generate unique ID
 * @returns Unique ID
 */
export function generateId(): number {
  return Date.now();
}

/**
 * Debounce function
 * @param func - Function to debounce
 * @param delay - Delay in milliseconds
 * @returns Debounced function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;

  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      func(...args);
    }, delay);
  };
}

/**
 * Check if object is empty
 * @param obj - Object to check
 * @returns True if empty
 */
export function isEmpty(obj: Record<string, unknown>): boolean {
  return Object.keys(obj).length === 0;
}

/**
 * Deep clone object
 * @param obj - Object to clone
 * @returns Cloned object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}
