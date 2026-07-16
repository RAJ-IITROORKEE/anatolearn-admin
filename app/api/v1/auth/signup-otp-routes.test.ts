import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  checkAuthRateLimits: vi.fn(),
  createSupabaseAdminClient: vi.fn(),
  createSupabaseAuthClient: vi.fn(),
  provisionUserProfile: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkAuthRateLimits: mocks.checkAuthRateLimits,
  trustedClientIdentifier: () => "client-key",
}));
vi.mock("@/lib/supabase/auth-client", () => ({ createSupabaseAuthClient: mocks.createSupabaseAuthClient }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: mocks.createSupabaseAdminClient }));
vi.mock("@/features/auth/profile-service", () => ({ provisionUserProfile: mocks.provisionUserProfile }));

import { POST as register } from "./register/route";
import { POST as resend } from "./resend-signup-otp/route";
import { POST as verify } from "./verify-signup-otp/route";

function request(path: string, body: object) {
  return new Request(`https://app.example/api/v1/auth/${path}`, {
    body: JSON.stringify(body),
    method: "POST",
  });
}

describe("signup OTP routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkAuthRateLimits.mockResolvedValue({ allowed: true, retryAfterSeconds: 60 });
    mocks.createSupabaseAdminClient.mockReturnValue({ auth: { admin: {
      deleteUser: vi.fn().mockResolvedValue({ error: null }),
      updateUserById: vi.fn().mockResolvedValue({ error: null }),
    } } });
  });

  it("requests signup verification without provisioning a profile or exposing identity data", async () => {
    const signUp = vi.fn().mockResolvedValue({
      data: { user: { id: "auth-user", identities: [{ id: "identity" }] }, session: null },
      error: null,
    });
    mocks.createSupabaseAuthClient.mockReturnValue({ auth: { signUp } });

    const response = await register(request("register", {
      email: " User@Example.COM ",
      password: "valid-password",
      fullName: "User Name",
    }));

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual(expect.objectContaining({
      success: true,
      data: {
        verificationRequired: true,
        message: "If this email can be registered, a verification code will be sent.",
      },
    }));
    expect(signUp).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "valid-password",
      options: { data: { full_name: "User Name" } },
    });
    expect(mocks.provisionUserProfile).not.toHaveBeenCalled();
  });

  it("keeps an existing-account signup response indistinguishable", async () => {
    mocks.createSupabaseAuthClient.mockReturnValue({ auth: { signUp: vi.fn().mockResolvedValue({
      data: { user: { id: "obfuscated", identities: [] }, session: null },
      error: null,
    }) } });

    const response = await register(request("register", {
      email: "user@example.com",
      password: "valid-password",
      fullName: "User Name",
    }));

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.not.toHaveProperty("data.userId");
  });

  it.each([
    ["register", register, { email: "user@example.com", password: "valid-password", fullName: "User Name" }, "signUp"],
    ["resend-signup-otp", resend, { email: "user@example.com" }, "resend"],
  ])("returns a safe 503 when %s cannot reach the auth provider", async (path, handler, body, method) => {
    mocks.createSupabaseAuthClient.mockReturnValue({ auth: {
      [method]: vi.fn().mockRejectedValue(new Error("provider unavailable")),
    } });

    const response = await handler(request(path, body));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      success: false, error: { code: "AUTH_UNAVAILABLE" },
    });
  });

  it.each([
    ["register", register, { email: "user@example.com", password: "valid-password", fullName: "User Name" }, "signUp"],
    ["resend-signup-otp", resend, { email: "user@example.com" }, "resend"],
  ])("returns a safe 503 when %s is throttled by the auth provider", async (path, handler, body, method) => {
    mocks.createSupabaseAuthClient.mockReturnValue({ auth: {
      [method]: vi.fn().mockResolvedValue({ data: { user: null, session: null }, error: { status: 429 } }),
    } });

    const response = await handler(request(path, body));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      success: false, error: { code: "AUTH_UNAVAILABLE" },
    });
  });

  it("verifies a signup OTP before provisioning the profile and returns no session", async () => {
    const user = { id: "auth-user", email: "user@example.com", email_confirmed_at: "2026-07-16T00:00:00Z", user_metadata: { full_name: "User Name" } };
    const verifyOtp = vi.fn().mockResolvedValue({ data: { user, session: { access_token: "secret" } }, error: null });
    mocks.createSupabaseAuthClient.mockReturnValue({ auth: { verifyOtp } });
    mocks.provisionUserProfile.mockResolvedValue({ id: "auth-user" });

    const response = await verify(request("verify-signup-otp", { email: "user@example.com", otp: "123456" }));

    expect(response.status).toBe(200);
    expect(verifyOtp).toHaveBeenCalledWith({ email: "user@example.com", token: "123456", type: "signup" });
    expect(mocks.createSupabaseAdminClient().auth.admin.updateUserById).toHaveBeenCalledWith("auth-user", {
      app_metadata: { signup_otp_verified: true },
    });
    expect(mocks.provisionUserProfile).toHaveBeenCalledWith(user);
    const payload = await response.json();
    expect(payload).toMatchObject({ success: true, data: { verified: true } });
    expect(payload).not.toHaveProperty("data.session");
  });

  it("removes a newly created identity when confirmations are misconfigured", async () => {
    const deleteUser = vi.fn().mockResolvedValue({ error: null });
    mocks.createSupabaseAdminClient.mockReturnValue({ auth: { admin: { deleteUser } } });
    mocks.createSupabaseAuthClient.mockReturnValue({ auth: { signUp: vi.fn().mockResolvedValue({
      data: { user: { id: "new-user", identities: [{ id: "identity" }] }, session: { access_token: "unexpected" } },
      error: null,
    }) } });

    const response = await register(request("register", {
      email: "user@example.com", password: "valid-password", fullName: "User Name",
    }));

    expect(response.status).toBe(503);
    expect(deleteUser).toHaveBeenCalledWith("new-user");
  });

  it("rejects an invalid OTP without provisioning", async () => {
    mocks.createSupabaseAuthClient.mockReturnValue({ auth: { verifyOtp: vi.fn().mockResolvedValue({
      data: { user: null, session: null },
      error: { code: "otp_expired", status: 400 },
    }) } });

    const response = await verify(request("verify-signup-otp", { email: "user@example.com", otp: "123456" }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ success: false, error: { code: "INVALID_OR_EXPIRED_OTP" } });
    expect(mocks.provisionUserProfile).not.toHaveBeenCalled();
  });

  it.each([
    ["rejects", vi.fn().mockRejectedValue(new Error("provider unavailable"))],
    ["returns a transient error", vi.fn().mockResolvedValue({ data: { user: null, session: null }, error: { status: 503 } })],
    ["throttles", vi.fn().mockResolvedValue({ data: { user: null, session: null }, error: { status: 429 } })],
  ])("returns a safe 503 when OTP verification %s", async (_case, verifyOtp) => {
    mocks.createSupabaseAuthClient.mockReturnValue({ auth: { verifyOtp } });

    const response = await verify(request("verify-signup-otp", { email: "user@example.com", otp: "123456" }));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      success: false, error: { code: "AUTH_UNAVAILABLE" },
    });
    expect(mocks.provisionUserProfile).not.toHaveBeenCalled();
  });

  it("resends signup OTP without disclosing account state", async () => {
    const resendOtp = vi.fn().mockResolvedValue({ data: {}, error: { code: "user_not_found", status: 400 } });
    mocks.createSupabaseAuthClient.mockReturnValue({ auth: { resend: resendOtp } });

    const response = await resend(request("resend-signup-otp", { email: "user@example.com" }));

    expect(response.status).toBe(202);
    expect(resendOtp).toHaveBeenCalledWith({ email: "user@example.com", type: "signup" });
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: { verificationRequired: true },
    });
  });
});
