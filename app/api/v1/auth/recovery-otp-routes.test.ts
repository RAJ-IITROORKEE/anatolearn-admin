import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  checkAuthRateLimits: vi.fn(),
  checkRateLimit: vi.fn(),
  createSupabaseAuthClient: vi.fn(),
  createSupabaseAdminClient: vi.fn(),
  auditCreate: vi.fn(),
  findProfileForUser: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkAuthRateLimits: mocks.checkAuthRateLimits,
  checkRateLimit: mocks.checkRateLimit,
  trustedClientIdentifier: () => "client-key",
}));
vi.mock("@/lib/supabase/auth-client", () => ({ createSupabaseAuthClient: mocks.createSupabaseAuthClient }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: mocks.createSupabaseAdminClient }));
vi.mock("@/features/auth/profile-service", () => ({ findProfileForUser: mocks.findProfileForUser }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { auditLog: { create: mocks.auditCreate } } }));
vi.mock("@/lib/logger", () => ({ logError: mocks.logError }));
vi.mock("@/lib/env", () => ({ getAuthRedirectUrls: () => ({ passwordReset: "https://app.example/auth/callback?next=%2Freset-password" }) }));

import { POST as forgotPassword } from "./forgot-password/route";
import { POST as resetPassword } from "./reset-password/route";
import { POST as verifyRecoveryOtp } from "./verify-recovery-otp/route";

function request(path: string, body: object) {
  return new Request(`https://app.example/api/v1/auth/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function recoveryToken() {
  return `x.${Buffer.from(JSON.stringify({ amr: [{ method: "recovery" }] })).toString("base64url")}.x`;
}

describe("recovery OTP routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkAuthRateLimits.mockResolvedValue({ allowed: true, retryAfterSeconds: 60 });
    mocks.checkRateLimit.mockResolvedValue({ allowed: true, retryAfterSeconds: 60 });
    mocks.auditCreate.mockResolvedValue({});
    mocks.findProfileForUser.mockResolvedValue({ id: "profile-id" });
  });

  it("keeps initiation/resend generic while mapping provider outages safely", async () => {
    const resetPasswordForEmail = vi.fn()
      .mockResolvedValueOnce({ data: {}, error: { code: "user_not_found", status: 400 } })
      .mockResolvedValueOnce({ data: {}, error: { code: "over_email_send_rate_limit", status: 429 } })
      .mockResolvedValueOnce({ data: {}, error: { code: "unexpected_failure", status: 500 } })
      .mockRejectedValueOnce(new Error("secret provider detail"));
    mocks.createSupabaseAuthClient.mockReturnValue({ auth: { resetPasswordForEmail } });

    const generic = await forgotPassword(request("forgot-password", { email: "USER@example.com" }));
    expect(generic.status).toBe(200);
    const genericBody = await generic.json();
    expect(genericBody).toMatchObject({ success: true, data: { message: expect.stringContaining("If an account exists") } });
    expect(resetPasswordForEmail).toHaveBeenCalledWith("user@example.com", expect.any(Object));

    const providerLimited = await forgotPassword(request("forgot-password", { email: "user@example.com" }));
    const providerLimitedBody = await providerLimited.json();
    expect(providerLimited.status).toBe(generic.status);
    expect(providerLimitedBody.success).toBe(genericBody.success);
    expect(providerLimitedBody.data).toEqual(genericBody.data);

    const providerUnavailable = await forgotPassword(request("forgot-password", { email: "user@example.com" }));
    expect(providerUnavailable.status).toBe(503);
    await expect(providerUnavailable.json()).resolves.toMatchObject({ success: false, error: { code: "AUTH_UNAVAILABLE" } });

    const transportUnavailable = await forgotPassword(request("forgot-password", { email: "user@example.com" }));
    expect(transportUnavailable.status).toBe(503);
    await expect(transportUnavailable.json()).resolves.toMatchObject({ success: false, error: { code: "AUTH_UNAVAILABLE" } });
  });

  it("verifies exactly six recovery digits and returns only a short-lived access token and expiry", async () => {
    const verifyOtp = vi.fn().mockResolvedValue({
      data: {
        user: { id: "user-id", email: "user@example.com" },
        session: { access_token: recoveryToken(), refresh_token: "must-not-leak", expires_at: 123456, token_type: "bearer" },
      },
      error: null,
    });
    mocks.createSupabaseAuthClient.mockReturnValue({ auth: { verifyOtp } });

    const response = await verifyRecoveryOtp(request("verify-recovery-otp", { email: " USER@example.com ", otp: "123456" }));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(verifyOtp).toHaveBeenCalledWith({ email: "user@example.com", token: "123456", type: "recovery" });
    await expect(response.json()).resolves.toEqual(expect.objectContaining({
      success: true,
      data: { accessToken: expect.any(String), expiresAt: 123456 },
    }));
    const payload = await response.json().catch(() => null);
    expect(payload).toBeNull();
  });

  it("rate limits verification by normalized account and client and rejects provider failures without details", async () => {
    mocks.checkAuthRateLimits.mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 41 });
    const limited = await verifyRecoveryOtp(request("verify-recovery-otp", { email: "USER@example.com", otp: "123456" }));
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe("41");
    expect(mocks.checkAuthRateLimits).toHaveBeenCalledWith(expect.objectContaining({
      namespace: "auth:verify-recovery-otp",
      accountIdentifier: "user@example.com",
      clientIdentifier: "client-key",
    }));

    mocks.checkAuthRateLimits.mockResolvedValue({ allowed: true, retryAfterSeconds: 60 });
    mocks.createSupabaseAuthClient.mockReturnValue({ auth: { verifyOtp: vi.fn().mockResolvedValue({ data: { user: null, session: null }, error: { status: 503, message: "secret" } }) } });
    const unavailable = await verifyRecoveryOtp(request("verify-recovery-otp", { email: "user@example.com", otp: "123456" }));
    expect(unavailable.status).toBe(503);
    expect(await unavailable.text()).not.toContain("secret");
  });

  it("rejects invalid OTPs and sessions without returning provider or user data", async () => {
    mocks.createSupabaseAuthClient.mockReturnValue({ auth: { verifyOtp: vi.fn().mockResolvedValue({
      data: { user: null, session: null }, error: { status: 400, message: "provider detail" },
    }) } });
    const response = await verifyRecoveryOtp(request("verify-recovery-otp", { email: "user@example.com", otp: "123456" }));
    expect(response.status).toBe(400);
    expect(await response.text()).not.toContain("provider detail");
  });

  it("uses the recovery token to reset, audits the change, and globally revokes refresh sessions", async () => {
    const token = recoveryToken();
    const getUser = vi.fn().mockResolvedValue({ data: { user: { id: "user-id" } }, error: null });
    const updateUserById = vi.fn().mockResolvedValue({ error: null });
    const signOut = vi.fn().mockResolvedValue({ error: null });
    mocks.createSupabaseAuthClient.mockReturnValue({ auth: { getUser } });
    mocks.createSupabaseAdminClient.mockReturnValue({ auth: { admin: { updateUserById, signOut } } });

    const response = await resetPassword(request("reset-password", { accessToken: token, password: "new-secure-password" }));
    expect(response.status).toBe(200);
    expect(updateUserById).toHaveBeenCalledWith("user-id", { password: "new-secure-password" });
    expect(mocks.auditCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ actorId: "profile-id", action: "PASSWORD_CHANGE", requestId: expect.any(String) }) });
    expect(signOut).toHaveBeenCalledWith(token, "global");
  });

  it("still revokes REST recovery sessions and returns success when profile or audit persistence fails", async () => {
    const token = recoveryToken();
    const signOut = vi.fn().mockResolvedValue({ error: null });
    mocks.createSupabaseAuthClient.mockReturnValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-id" } }, error: null }) } });
    mocks.createSupabaseAdminClient.mockReturnValue({ auth: { admin: {
      updateUserById: vi.fn().mockResolvedValue({ error: null }),
      signOut,
    } } });

    mocks.findProfileForUser.mockRejectedValueOnce(new Error("database host detail"));
    const profileFailure = await resetPassword(request("reset-password", { accessToken: token, password: "new-secure-password" }));
    expect(profileFailure.status).toBe(200);
    await expect(profileFailure.json()).resolves.toMatchObject({ success: true, data: { passwordUpdated: true } });
    expect(signOut).toHaveBeenCalledWith(token, "global");

    signOut.mockClear();
    mocks.findProfileForUser.mockResolvedValueOnce({ id: "profile-id" });
    mocks.auditCreate.mockRejectedValueOnce(new Error("database constraint detail"));
    const auditFailure = await resetPassword(request("reset-password", { accessToken: token, password: "new-secure-password" }));
    expect(auditFailure.status).toBe(200);
    await expect(auditFailure.json()).resolves.toMatchObject({ success: true, data: { passwordUpdated: true } });
    expect(signOut).toHaveBeenCalledWith(token, "global");
    expect(mocks.logError).toHaveBeenCalledTimes(2);
    expect(mocks.logError).toHaveBeenCalledWith(expect.objectContaining({
      code: "RECOVERY_PASSWORD_AUDIT_FAILED",
      route: "/api/v1/auth/reset-password",
    }));
  });
});
