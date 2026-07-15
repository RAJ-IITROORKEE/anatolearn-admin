import { z } from "zod";

const optionalUrl = z.preprocess((value) => (value === "" ? undefined : value), z.url().optional());
const optionalString = z.preprocess((value) => (value === "" ? undefined : value), z.string().min(1).optional());
const knownCronPlaceholders = /^(change[_ -]?me|your[_ -]?cron|replace[_ -]?me|example)/i;
const optionalSecret = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(32).refine((value) => !knownCronPlaceholders.test(value), "CRON_SECRET must not be a placeholder.").optional(),
);

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

export const rateLimitEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  UPSTASH_REDIS_REST_URL: optionalUrl,
  UPSTASH_REDIS_REST_TOKEN: optionalString,
  KV_REST_API_URL: optionalUrl,
  KV_REST_API_TOKEN: optionalString,
}).superRefine((value, context) => {
  const pairs = [
    ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN", value.UPSTASH_REDIS_REST_URL, value.UPSTASH_REDIS_REST_TOKEN],
    ["KV_REST_API_URL", "KV_REST_API_TOKEN", value.KV_REST_API_URL, value.KV_REST_API_TOKEN],
  ] as const;
  for (const [urlKey, tokenKey, url, token] of pairs) {
    if (Boolean(url) !== Boolean(token)) {
      context.addIssue({ code: "custom", path: [url ? tokenKey : urlKey], message: "Both distributed rate-limit variables must be configured together." });
    }
  }
  const hasCustomPair = Boolean(value.UPSTASH_REDIS_REST_URL && value.UPSTASH_REDIS_REST_TOKEN);
  const hasVercelPair = Boolean(value.KV_REST_API_URL && value.KV_REST_API_TOKEN);
  if (value.NODE_ENV === "production" && !hasCustomPair && !hasVercelPair) {
    context.addIssue({ code: "custom", path: ["KV_REST_API_URL"], message: "Distributed rate limiting is required in production." });
  }
});

export const bootstrapEnvSchema = serverEnvSchema.extend({
  ADMIN_BOOTSTRAP_EMAIL: z.email(),
  ADMIN_BOOTSTRAP_PASSWORD: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().min(12).optional(),
  ),
});

export const envCheckSchema = bootstrapEnvSchema
  .and(cronEnvSchema)
  .and(notificationProviderEnvSchema)
  .and(rateLimitEnvSchema);

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
  const callback = env.SUPABASE_AUTH_REDIRECT_URL ?? `${env.NEXT_PUBLIC_APP_URL}/auth/callback`;
  const recoveryCallback = new URL(callback);
  recoveryCallback.searchParams.set("next", "/reset-password");
  return {
    callback,
    passwordReset:
      env.SUPABASE_PASSWORD_RESET_REDIRECT_URL ?? recoveryCallback.toString(),
  };
}
