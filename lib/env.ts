import { z } from "zod";

const optionalUrl = z.preprocess((value) => (value === "" ? undefined : value), z.url().optional());
const optionalSecret = z.preprocess((value) => (value === "" ? undefined : value), z.string().min(32).optional());

export const publicEnvSchema = z.object({
  NEXT_PUBLIC_APP_NAME: z.string().min(1).default("AnatoLearn Admin"),
  NEXT_PUBLIC_APP_URL: z.url(),
  NEXT_PUBLIC_API_BASE_URL: z.string().startsWith("/").default("/api/v1"),
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
});

export const serverEnvSchema = publicEnvSchema.extend({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().startsWith("postgresql://"),
  DIRECT_URL: z.string().startsWith("postgresql://"),
  SUPABASE_SECRET_KEY: z.string().min(1),
  SUPABASE_AUTH_REDIRECT_URL: optionalUrl,
  SUPABASE_PASSWORD_RESET_REDIRECT_URL: optionalUrl,
  SUPABASE_STORAGE_BUCKET: z.string().min(1).default("anatomy-media"),
  SUPABASE_STORAGE_MAX_FILE_MB: z.coerce.number().int().positive().max(25).default(8),
  SUPABASE_STORAGE_ALLOWED_MIME_TYPES: z.string().min(1),
  SUPABASE_STORAGE_VISIBILITY: z.literal("private"),
});

export const cronEnvSchema = z.object({
  CRON_SECRET: optionalSecret,
});

export const notificationProviderEnvSchema = z.object({
  EXPO_PUSH_ENABLED: z.enum(["true", "false"]).default("false"),
  EXPO_ACCESS_TOKEN: z.preprocess((value) => value === "" ? undefined : value, z.string().min(1).optional()),
});

export const bootstrapEnvSchema = serverEnvSchema.extend({
  ADMIN_BOOTSTRAP_EMAIL: z.email(),
  ADMIN_BOOTSTRAP_PASSWORD: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().min(12).optional(),
  ),
});

export const envCheckSchema = bootstrapEnvSchema.and(cronEnvSchema).and(notificationProviderEnvSchema);

export function getPublicEnv() {
  return publicEnvSchema.parse(process.env);
}

export function getServerEnv() {
  return serverEnvSchema.parse(process.env);
}

export function getCronEnv() {
  return cronEnvSchema.parse(process.env);
}

export function getBootstrapEnv() {
  return bootstrapEnvSchema.parse(process.env);
}

export function getAuthRedirectUrls() {
  const env = getServerEnv();
  return {
    callback: env.SUPABASE_AUTH_REDIRECT_URL ?? `${env.NEXT_PUBLIC_APP_URL}/auth/callback`,
    passwordReset:
      env.SUPABASE_PASSWORD_RESET_REDIRECT_URL ?? `${env.NEXT_PUBLIC_APP_URL}/reset-password`,
  };
}
