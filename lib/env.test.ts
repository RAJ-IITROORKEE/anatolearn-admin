import { describe, expect, it } from "vitest";

import { bootstrapEnvSchema, cronEnvSchema, notificationProviderEnvSchema, publicEnvSchema, serverEnvSchema } from "@/lib/env";

describe("publicEnvSchema", () => {
  it("accepts the documented public application settings", () => {
    expect(
      publicEnvSchema.parse({
        NEXT_PUBLIC_APP_NAME: "AnatoLearn Admin",
        NEXT_PUBLIC_APP_URL: "http://localhost:3000",
        NEXT_PUBLIC_API_BASE_URL: "/api/v1",
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example",
      }),
    ).toEqual({
      NEXT_PUBLIC_APP_NAME: "AnatoLearn Admin",
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      NEXT_PUBLIC_API_BASE_URL: "/api/v1",
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example",
    });
  });

  it("rejects invalid application URLs", () => {
    expect(() =>
      publicEnvSchema.parse({
        NEXT_PUBLIC_APP_NAME: "AnatoLearn Admin",
        NEXT_PUBLIC_APP_URL: "not-a-url",
        NEXT_PUBLIC_API_BASE_URL: "/api/v1",
      }),
    ).toThrow();
  });

  it("accepts modern Supabase server configuration", () => {
    expect(
      serverEnvSchema.parse({
        NEXT_PUBLIC_APP_NAME: "AnatoLearn Admin",
        NEXT_PUBLIC_APP_URL: "http://localhost:3000",
        NEXT_PUBLIC_API_BASE_URL: "/api/v1",
        NODE_ENV: "test",
        DATABASE_URL: "postgresql://user:password@localhost:6543/postgres",
        DIRECT_URL: "postgresql://user:password@localhost:5432/postgres",
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example",
        SUPABASE_SECRET_KEY: "sb_secret_example",
        SUPABASE_AUTH_REDIRECT_URL: "http://localhost:3000/auth/callback",
        SUPABASE_PASSWORD_RESET_REDIRECT_URL: "http://localhost:3000/reset-password",
        SUPABASE_STORAGE_BUCKET: "anatomy-media",
        SUPABASE_STORAGE_ALLOWED_MIME_TYPES: "image/png,image/jpeg,image/webp",
        SUPABASE_STORAGE_VISIBILITY: "private",
      }).SUPABASE_STORAGE_VISIBILITY,
    ).toBe("private");
  });

  it("rejects public storage configuration", () => {
    expect(() =>
      serverEnvSchema.parse({
        NEXT_PUBLIC_APP_URL: "http://localhost:3000",
        DATABASE_URL: "postgresql://user:password@localhost:6543/postgres",
        DIRECT_URL: "postgresql://user:password@localhost:5432/postgres",
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example",
        SUPABASE_SECRET_KEY: "sb_secret_example",
        SUPABASE_AUTH_REDIRECT_URL: "http://localhost:3000/auth/callback",
        SUPABASE_PASSWORD_RESET_REDIRECT_URL: "http://localhost:3000/reset-password",
        SUPABASE_STORAGE_ALLOWED_MIME_TYPES: "image/png,image/jpeg,image/webp",
        SUPABASE_STORAGE_VISIBILITY: "public",
      }),
    ).toThrow();
  });

  it("keeps bootstrap-only validation out of runtime configuration", () => {
    const input = {
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      DATABASE_URL: "postgresql://user:password@localhost:6543/postgres",
      DIRECT_URL: "postgresql://user:password@localhost:5432/postgres",
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example",
      SUPABASE_SECRET_KEY: "sb_secret_example",
      SUPABASE_STORAGE_ALLOWED_MIME_TYPES: "image/png",
      SUPABASE_STORAGE_VISIBILITY: "private",
      ADMIN_BOOTSTRAP_EMAIL: "admin@example.com",
      ADMIN_BOOTSTRAP_PASSWORD: "short",
    };

    expect(serverEnvSchema.safeParse(input).success).toBe(true);
    expect(bootstrapEnvSchema.safeParse(input).success).toBe(false);
  });

  it("keeps cron-only validation out of shared runtime configuration", () => {
    const base = {
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      DATABASE_URL: "postgresql://user:password@localhost:6543/postgres",
      DIRECT_URL: "postgresql://user:password@localhost:5432/postgres",
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example",
      SUPABASE_SECRET_KEY: "sb_secret_example",
      SUPABASE_STORAGE_ALLOWED_MIME_TYPES: "image/png",
      SUPABASE_STORAGE_VISIBILITY: "private",
    };
    expect(serverEnvSchema.safeParse(base).success).toBe(true);
    expect(serverEnvSchema.safeParse({ ...base, CRON_SECRET: "too-short" }).success).toBe(true);
    expect(cronEnvSchema.safeParse({ CRON_SECRET: "too-short" }).success).toBe(false);
    expect(cronEnvSchema.parse({ CRON_SECRET: "x".repeat(32) }).CRON_SECRET).toHaveLength(32);
  });

  it("keeps optional notification provider validation out of shared runtime configuration", () => {
    const runtime = {
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      DATABASE_URL: "postgresql://user:password@localhost:6543/postgres",
      DIRECT_URL: "postgresql://user:password@localhost:5432/postgres",
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example",
      SUPABASE_SECRET_KEY: "sb_secret_example",
      SUPABASE_STORAGE_ALLOWED_MIME_TYPES: "image/png",
      SUPABASE_STORAGE_VISIBILITY: "private",
      EXPO_PUSH_ENABLED: "invalid",
    };
    expect(serverEnvSchema.safeParse(runtime).success).toBe(true);
    expect(notificationProviderEnvSchema.safeParse(runtime).success).toBe(false);
    expect(notificationProviderEnvSchema.parse({ EXPO_PUSH_ENABLED: "false" })).toEqual({ EXPO_PUSH_ENABLED: "false" });
    expect(notificationProviderEnvSchema.parse({ EXPO_PUSH_ENABLED: "true", EXPO_ACCESS_TOKEN: "token" })).toEqual({ EXPO_PUSH_ENABLED: "true", EXPO_ACCESS_TOKEN: "token" });
  });
});
