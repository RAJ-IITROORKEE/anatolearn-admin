import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  checkAuthRateLimits: vi.fn(),
  createSupabaseServerClient: vi.fn(),
  headers: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkAuthRateLimits: mocks.checkAuthRateLimits,
  trustedClientIdentifier: () => "client-key",
}));
vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.createSupabaseServerClient }));
vi.mock("@/features/auth/profile-service", () => ({ findProfileForUser: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: {} }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/env", () => ({ getAuthRedirectUrls: () => ({ passwordReset: "https://app.example/reset-password" }) }));

import { forgotPasswordAction, loginAction } from "./actions";

describe("web auth action rate limiting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
    mocks.checkAuthRateLimits.mockResolvedValue({ allowed: false, retryAfterSeconds: 60 });
  });

  it("limits login by the schema-normalized identifier before authentication", async () => {
    const form = new FormData();
    form.set("email", " User@Example.COM ");
    form.set("password", "valid-password");
    await expect(loginAction({}, form)).resolves.toEqual({ error: "Too many attempts. Please try again later." });
    expect(mocks.checkAuthRateLimits).toHaveBeenCalledWith(expect.objectContaining({
      namespace: "auth:login", accountIdentifier: "user@example.com", clientIdentifier: "client-key",
      clientLimit: 10, accountLimit: 30,
    }));
    expect(mocks.createSupabaseServerClient).not.toHaveBeenCalled();
  });

  it("returns the same safe action message for forgot-password limits", async () => {
    const form = new FormData();
    form.set("email", "USER@example.com");
    await expect(forgotPasswordAction({}, form)).resolves.toEqual({ error: "Too many attempts. Please try again later." });
    expect(mocks.checkAuthRateLimits).toHaveBeenCalledWith(expect.objectContaining({
      namespace: "auth:forgot-password", accountIdentifier: "user@example.com", clientIdentifier: "client-key",
      clientLimit: 5, accountLimit: 15,
    }));
    expect(mocks.createSupabaseServerClient).not.toHaveBeenCalled();
  });
});
