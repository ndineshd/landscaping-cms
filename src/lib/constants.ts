/**
 * Application constants
 * Centralized place for all constant values used throughout the application
 */

/**
 * API endpoints
 */
export const API_ENDPOINTS = {
  /** Admin login endpoint */
  ADMIN_LOGIN: "/api/admin/login",
  /** Admin verification endpoint */
  ADMIN_VERIFY: "/api/admin/verify",
  /** Get configuration endpoint */
  CONFIG: "/api/config/",
  /** Send contact form endpoint */
  CONTACT_FORM: "/api/contact",
  /** Get projects endpoint */
  PROJECTS: "/api/projects",
  /** Get services endpoint */
  SERVICES: "/api/services",
} as const;

/**
 * Route paths
 */
export const ROUTES = {
  /** Home page */
  HOME: "/",
  /** Services listing page */
  SERVICES: "/services",
  /** Service detail page */
  SERVICE_DETAIL: "/services",
  /** Projects listing page */
  PROJECTS: "/projects",
  /** Project detail page */
  PROJECT_DETAIL: "/projects",
  /** Contact page */
  CONTACT: "/contact",
  /** Admin login page */
  ADMIN_LOGIN: "/admin/login",
  /** Admin dashboard */
  ADMIN_DASHBOARD: "/admin",
  /** Admin projects management */
  ADMIN_PROJECTS: "/admin/projects",
  /** Admin services management */
  ADMIN_SERVICES: "/admin/services",
  /** Admin content management */
  ADMIN_CONTENT: "/admin/content",
  /** Admin settings */
  ADMIN_SETTINGS: "/admin/settings",
} as const;

/**
 * Local storage keys
 */
export const STORAGE_KEYS = {
  /** Admin auth token */
  ADMIN_TOKEN: "admin_token",
  /** Admin session start time */
  SESSION_START: "session_start",
  /** User language preference */
  LANGUAGE: "language",
  /** Theme preference (light/dark) */
  THEME: "theme",
} as const;

/**
 * Cookie names
 */
export const COOKIES = {
  /** Admin session cookie */
  ADMIN_SESSION: "admin_session",
  /** Language preference cookie */
  LANGUAGE: "language",
} as const;

/**
 * Animation durations (in milliseconds)
 */
export const ANIMATION_DURATIONS = {
  /** Fast animation */
  FAST: 150,
  /** Standard animation */
  STANDARD: 300,
  /** Slow animation */
  SLOW: 500,
  /** Very slow animation */
  SLOWER: 800,
} as const;

/**
 * Breakpoints for responsive design
 */
export const BREAKPOINTS = {
  /** Mobile breakpoint */
  MOBILE: 640,
  /** Tablet breakpoint */
  TABLET: 768,
  /** Desktop breakpoint */
  DESKTOP: 1024,
  /** Large desktop breakpoint */
  LARGE: 1280,
} as const;

/**
 * Image alt text fallbacks
 */
export const IMAGE_ALTS = {
  /** Logo alt text */
  LOGO: "GrowWell Landscapes Logo",
  /** Hero image alt text */
  HERO: "Landscape showcase",
  /** Project image alt text */
  PROJECT: "Project showcase",
  /** Service image alt text */
  SERVICE: "Service showcase",
} as const;

/**
 * Default values and limits
 */
export const DEFAULTS = {
  /** Default page size for pagination */
  PAGE_SIZE: 12,
  /** Maximum items to show in preview */
  PREVIEW_LIMIT: 3,
  /** Session timeout in milliseconds (1 hour) */
  SESSION_TIMEOUT: 3600000,
  /** Image optimization quality (1-100) */
  IMAGE_QUALITY: 85,
} as const;

/**
 * Regular expressions for validation
 */
export const REGEX_PATTERNS = {
  /** Email validation pattern */
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  /** Phone number validation pattern (Indian format) */
  PHONE: /^[6-9]\d{9}$/,
  /** URL validation pattern */
  URL: /^https?:\/\/.+/,
  /** Slug validation pattern */
  SLUG: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
} as const;

/**
 * Environmental variables (type-safe)
 */
export const ENV = {
  /** Application environment */
  NODE_ENV: (process.env.NODE_ENV as "development" | "production" | "test") ||
    "production",
  /** CORS origins */
  CORS_ORIGINS: process.env.CORS_ORIGINS || "*",
  /** API base URL */
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || "",
} as const;

/**
 * Error messages
 */
export const ERROR_MESSAGES = {
  /** Generic error message */
  GENERIC: "Something went wrong. Please try again later.",
  /** Not found error */
  NOT_FOUND: "The requested resource was not found.",
  /** Unauthorized error */
  UNAUTHORIZED: "You are not authorized to perform this action.",
  /** Invalid credentials error */
  INVALID_CREDENTIALS: "Invalid username or password.",
  /** Session expired error */
  SESSION_EXPIRED: "Your session has expired. Please log in again.",
  /** Network error */
  NETWORK_ERROR: "Network error. Please check your connection.",
} as const;

/**
 * Success messages
 */
export const SUCCESS_MESSAGES = {
  /** Generic success message */
  SUCCESS: "Operation completed successfully.",
  /** Login success */
  LOGIN_SUCCESS: "Logged in successfully.",
  /** Logout success */
  LOGOUT_SUCCESS: "Logged out successfully.",
  /** Save success */
  SAVE_SUCCESS: "Changes saved successfully.",
  /** Delete success */
  DELETE_SUCCESS: "Item deleted successfully.",
  /** Contact form submit success */
  CONTACT_SUBMITTED: "Thank you! We'll get back to you soon.",
} as const;
