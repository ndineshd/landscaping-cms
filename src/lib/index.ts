/**
 * Centralized exports for configuration and utilities
 * Import from @/lib for convenient access to all utilities
 */

// Configuration and constants
export * from "./constants";
export { configLoader, getTranslation, getActiveProjects, getActiveServices, getProjectsByCategory } from "./config-loader";
export { getEnv, isDevelopment, isProduction, isTest } from "./env";
export type { Environment } from "./env";

// Re-export utilities
export { cn } from "./utils";
