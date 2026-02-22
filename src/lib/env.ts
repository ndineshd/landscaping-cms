/**
 * Environment variables schema and validation
 * Ensures type-safe access to environment variables
 */

import { z } from "zod";

/**
 * Schema for environment variables
 */
const envSchema = z.object({
  /** Node environment */
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("production"),
  /** CORS allowed origins */
  CORS_ORIGINS: z.string().default("*"),
  /** API base URL for client-side requests */
  NEXT_PUBLIC_API_URL: z.string().url().optional().or(z.literal("")),
  /** Database connection string */
  MONGODB_URI: z.string().url().optional(),
  /** Admin panel JWT secret */
  JWT_SECRET: z.string().optional(),
  /** Admin PIN for authentication */
  ADMIN_PIN: z.string().optional(),
});

/**
 * Type for validated environment variables
 */
export type Environment = z.infer<typeof envSchema>;

/**
 * Validated environment variables
 */
let validatedEnv: Environment | null = null;

/**
 * Get validated environment variables
 * @returns Validated environment object
 * @throws Error if validation fails
 */
export function getEnv(): Environment {
  if (validatedEnv) {
    return validatedEnv;
  }

  const env = process.env;

  try {
    validatedEnv = envSchema.parse(env);
    return validatedEnv;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages: string[] = error.issues
        .map((err) => `${err.path.join(".")}: ${err.message}`)
        .filter((msg): msg is string => typeof msg === 'string');
      throw new Error(`Invalid environment variables: ${errorMessages.join(", ")}`);
    }
    throw error;
  }
}

/**
 * Check if running in development environment
 */
export const isDevelopment = (): boolean => {
  return getEnv().NODE_ENV === "development";
};

/**
 * Check if running in production environment
 */
export const isProduction = (): boolean => {
  return getEnv().NODE_ENV === "production";
};

/**
 * Check if running in test environment
 */
export const isTest = (): boolean => {
  return getEnv().NODE_ENV === "test";
};
