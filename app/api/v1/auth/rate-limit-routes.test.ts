import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  checkAuthRateLimits: vi.fn(),
  createSupabaseAuthClient: vi.fn(),
  findProfileForUser: vi.fn(),
  provisionUserProfile: vi.fn(),
  createSupabaseAdminClient: vi.fn(),
}));
vi.mock("@/lib/rate-limit", () => ({
  checkAuthRateLimits: mocks.checkAuthRateLimits,
  trustedClientIdentifier: () => "client-key",
}));
vi.mock("@/lib/supabase/auth-client", () => ({ createSupabaseAuthClient: mocks.createSupabaseAuthClient }));
vi.mock("@/features/auth/profile-service", () => ({
  findProfileForUser: mocks.findProfileForUser,
  provisionUserProfile: mocks.provisionUserProfile,
}));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: mocks.createSupabaseAdminClient }));
vi.mock("@/lib/env", () => ({ getAuthRedirectUrls: vi.fn() }));

import { POST as login } from "./login/route";
import { POST as forgotPassword } from "./forgot-password/route";
import { POST as register } from "./register/route";

describe("REST auth rate limiting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkAuthRateLimits.mockResolvedValue({ allowed: false, retryAfterSeconds: 37 });
  });

  it.each([
    ["login", login, { email: " User@Example.COM ", password: "valid-password" }, "auth:login", 10, 30, 60_000],
    ["forgot password", forgotPassword, { email: " User@Example.COM " }, "auth:forgot-password", 5, 15, 60_000],
    ["registration", register, { email: " User@Example.COM ", password: "valid-password", fullName: "User Name" }, "auth:signup-email", 10, 3, 15 * 60_000],
  ])("returns 429 and Retry-After for %s", async (_name, handler, body, namespace, clientLimit, accountLimit, windowMs) => {
    const response = await handler(new Request("https://app.example/api", {
      method: "POST",
      body: JSON.stringify(body),
    }));
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("37");
    expect(response.headers.get("x-request-id")).toBeTruthy();
    expect(mocks.checkAuthRateLimits).toHaveBeenCalledWith(expect.objectContaining({
      namespace,
      accountIdentifier: "user@example.com",
      clientIdentifier: "client-key",
      clientLimit,
      accountLimit,
      ...(windowMs === 60_000 ? {} : { windowMs }),
    }));
  });

  it("marks successful token responses private and non-cacheable", async () => {
    mocks.checkAuthRateLimits.mockResolvedValue({ allowed: true, retryAfterSeconds: 60 });
    mocks.createSupabaseAuthClient.mockReturnValue({
      auth: { signInWithPassword: vi.fn().mockResolvedValue({
        data: { user: { id: "user-id" }, session: {
          access_token: "access", refresh_token: "refresh", expires_at: 123, token_type: "bearer",
        } },
        error: null,
      }) },
    });
    mocks.findProfileForUser.mockResolvedValue({ id: "user-id", fullName: "User", role: "USER", isActive: true });
    const response = await login(new Request("https://app.example/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "user@example.com", password: "valid-password" }),
    }));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("vary")).toBe("Authorization, Cookie");
    expect(response.headers.get("x-request-id")).toBeTruthy();
    await expect(response.json()).resolves.not.toHaveProperty("data.profile.role");
  });

  it("distinguishes an unconfirmed email from incorrect credentials", async () => {
    mocks.checkAuthRateLimits.mockResolvedValue({ allowed: true, retryAfterSeconds: 60 });
    mocks.createSupabaseAuthClient.mockReturnValue({
      auth: { signInWithPassword: vi.fn().mockResolvedValue({
        data: { user: null, session: null },
        error: { code: "email_not_confirmed" },
      }) },
    });
    const response = await login(new Request("https://app.example/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "user@example.com", password: "valid-password" }),
    }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: { code: "EMAIL_CONFIRMATION_REQUIRED", message: "Confirm your email before signing in." },
    });
  });

  it("repairs only profiles that passed server-recorded signup OTP verification", async () => {
    mocks.checkAuthRateLimits.mockResolvedValue({ allowed: true, retryAfterSeconds: 60 });
    mocks.findProfileForUser.mockResolvedValue(null);
    mocks.provisionUserProfile.mockResolvedValue({ id: "user-id", fullName: "User", isActive: true });
    const signInWithPassword = vi.fn();
    mocks.createSupabaseAuthClient.mockReturnValue({ auth: { signInWithPassword } });

    signInWithPassword.mockResolvedValueOnce({
      data: { user: { id: "user-id", app_metadata: {} }, session: { access_token: "a", refresh_token: "r" } }, error: null,
    });
    const unverified = await login(new Request("https://app.example/api/v1/auth/login", {
      method: "POST", body: JSON.stringify({ email: "user@example.com", password: "valid-password" }),
    }));
    expect(unverified.status).toBe(503);
    expect(mocks.provisionUserProfile).not.toHaveBeenCalled();

    signInWithPassword.mockResolvedValueOnce({
      data: { user: { id: "user-id", app_metadata: { signup_otp_verified: true } }, session: { access_token: "a", refresh_token: "r", expires_at: 1, token_type: "bearer" } }, error: null,
    });
    const verified = await login(new Request("https://app.example/api/v1/auth/login", {
      method: "POST", body: JSON.stringify({ email: "user@example.com", password: "valid-password" }),
    }));
    expect(verified.status).toBe(200);
    expect(mocks.provisionUserProfile).toHaveBeenCalledTimes(1);
  });

  it("returns the normal safe signup result without provisioning an obfuscated user", async () => {
    mocks.checkAuthRateLimits.mockResolvedValue({ allowed: true, retryAfterSeconds: 60 });
    mocks.createSupabaseAuthClient.mockReturnValue({
      auth: { signUp: vi.fn().mockResolvedValue({
        data: { user: { id: "obfuscated-id", identities: [] }, session: null },
        error: null,
      }) },
    });
    const response = await register(new Request("https://app.example/api/v1/auth/register", {
      method: "POST",
      body: JSON.stringify({ email: "user@example.com", password: "valid-password", fullName: "User Name" }),
    }));
    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: { verificationRequired: true },
    });
    expect(mocks.provisionUserProfile).not.toHaveBeenCalled();
    expect(mocks.createSupabaseAdminClient).not.toHaveBeenCalled();
  });
});
