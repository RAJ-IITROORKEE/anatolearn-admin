import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  checkAuthRateLimits: vi.fn(),
  checkRateLimit: vi.fn(),
  createSupabaseServerClient: vi.fn(),
  createSupabaseAuthClient: vi.fn(),
  createSupabaseAdminClient: vi.fn(),
  findProfileForUser: vi.fn(),
  headers: vi.fn(),
  auditCreate: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkAuthRateLimits: mocks.checkAuthRateLimits,
  checkRateLimit: mocks.checkRateLimit,
  trustedClientIdentifier: () => "client-key",
}));
vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.createSupabaseServerClient }));
vi.mock("@/lib/supabase/auth-client", () => ({ createSupabaseAuthClient: mocks.createSupabaseAuthClient }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: mocks.createSupabaseAdminClient }));
vi.mock("@/features/auth/profile-service", () => ({ findProfileForUser: mocks.findProfileForUser, syncProfileEmail: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { auditLog: { create: mocks.auditCreate } } }));
vi.mock("@/lib/logger", () => ({ logError: mocks.logError }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/env", () => ({ getAuthRedirectUrls: () => ({ callback: "https://app.example/auth/callback", passwordReset: "https://app.example/reset-password" }) }));

import { changePasswordAction, forgotPasswordAction, loginAction, resetPasswordAction, updateEmailAction } from "./actions";

function jwt(method: string) {
  return `x.${Buffer.from(JSON.stringify({ amr: [{ method }] })).toString("base64url")}.x`;
}

describe("web auth action rate limiting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
    mocks.checkAuthRateLimits.mockResolvedValue({ allowed: false, retryAfterSeconds: 60 });
    mocks.checkRateLimit.mockResolvedValue({ allowed: true, retryAfterSeconds: 60 });
    mocks.auditCreate.mockResolvedValue({});
  });

  it("limits login by the schema-normalized identifier before authentication", async () => {
    const form = new FormData();
    form.set("$ACTION_KEY", "framework-generated-value");
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

  it("requests an email change for the authenticated administrator", async () => {
    mocks.checkAuthRateLimits.mockResolvedValue({ allowed: true });
    mocks.findProfileForUser.mockResolvedValue({ id: "profile-id", role: "ADMIN", isActive: true });
    const updateUser = vi.fn().mockResolvedValue({ error: null });
    mocks.createSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-id", email: "old@example.com" } } }),
        updateUser,
      },
    });

    const form = new FormData();
    form.set("email", " New@example.com ");
    await expect(updateEmailAction({}, form)).resolves.toEqual({
      success: "Check your email to confirm the new address.",
    });

    expect(updateUser).toHaveBeenCalledWith(
      { email: "new@example.com" },
      { emailRedirectTo: "https://app.example/auth/callback?next=%2Fsettings%2Fprofile" },
    );
    expect(mocks.checkAuthRateLimits).toHaveBeenCalledWith(expect.objectContaining({
      namespace: "auth:update-email",
      accountIdentifier: "new@example.com",
    }));
  });

  it("does not call Supabase when the email is invalid", async () => {
    const form = new FormData();
    form.set("email", "not-an-email");
    await expect(updateEmailAction({}, form)).resolves.toEqual({ error: "Enter a valid email address." });
    expect(mocks.createSupabaseServerClient).not.toHaveBeenCalled();
  });

  it("requires recovery AMR for the web reset action", async () => {
    const updateUser = vi.fn();
    mocks.createSupabaseServerClient.mockResolvedValue({ auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: jwt("password") } } }),
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-id" } } }),
      updateUser,
    } });
    const form = new FormData();
    form.set("password", "new-secure-password");
    form.set("confirmPassword", "new-secure-password");
    await expect(resetPasswordAction({}, form)).resolves.toEqual({ error: "Your recovery session is missing or expired." });
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("updates, audits, and signs out a valid web recovery session", async () => {
    const signOut = vi.fn().mockResolvedValue({ error: null });
    const updateUser = vi.fn().mockResolvedValue({ error: null });
    mocks.createSupabaseServerClient.mockResolvedValue({ auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: jwt("recovery") } } }),
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-id" } } }),
      updateUser,
      signOut,
    } });
    mocks.findProfileForUser.mockResolvedValue({ id: "profile-id" });
    const form = new FormData();
    form.set("password", "new-secure-password");
    form.set("confirmPassword", "new-secure-password");
    await expect(resetPasswordAction({}, form)).resolves.toMatchObject({ success: expect.any(String) });
    expect(updateUser).toHaveBeenCalledWith({ password: "new-secure-password" });
    expect(mocks.auditCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ action: "PASSWORD_CHANGE", actorId: "profile-id" }) });
    expect(signOut).toHaveBeenCalledWith({ scope: "global" });
  });

  it("still revokes web recovery sessions and returns success when profile or audit persistence fails", async () => {
    const signOut = vi.fn().mockResolvedValue({ error: null });
    mocks.createSupabaseServerClient.mockResolvedValue({ auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: jwt("recovery") } } }),
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-id" } } }),
      updateUser: vi.fn().mockResolvedValue({ error: null }),
      signOut,
    } });
    const form = new FormData();
    form.set("password", "new-secure-password");
    form.set("confirmPassword", "new-secure-password");

    mocks.findProfileForUser.mockRejectedValueOnce(new Error("database host detail"));
    await expect(resetPasswordAction({}, form)).resolves.toMatchObject({ success: expect.any(String) });
    expect(signOut).toHaveBeenCalledWith({ scope: "global" });

    signOut.mockClear();
    mocks.findProfileForUser.mockResolvedValueOnce({ id: "profile-id" });
    mocks.auditCreate.mockRejectedValueOnce(new Error("database constraint detail"));
    await expect(resetPasswordAction({}, form)).resolves.toMatchObject({ success: expect.any(String) });
    expect(signOut).toHaveBeenCalledWith({ scope: "global" });
    expect(mocks.logError).toHaveBeenCalledTimes(2);
    expect(mocks.logError).toHaveBeenCalledWith(expect.objectContaining({
      code: "RECOVERY_PASSWORD_AUDIT_FAILED",
      route: "/reset-password",
    }));
  });

  it("requires the current password before changing it from authenticated settings", async () => {
    const updateUserById = vi.fn().mockResolvedValue({ error: null });
    mocks.createSupabaseServerClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-id", email: "user@example.com" } } }) } });
    mocks.findProfileForUser.mockResolvedValue({ id: "profile-id", email: "user@example.com", role: "ADMIN", isActive: true });
    mocks.createSupabaseAuthClient.mockReturnValue({ auth: { signInWithPassword: vi.fn().mockResolvedValue({ error: { status: 400 } }) } });
    mocks.createSupabaseAdminClient.mockReturnValue({ auth: { admin: { updateUserById } } });
    const form = new FormData();
    form.set("currentPassword", "old-password");
    form.set("password", "new-secure-password");
    form.set("confirmPassword", "new-secure-password");
    await expect(changePasswordAction({}, form)).resolves.toEqual({ error: "The current password is incorrect." });
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it("reauthenticates and audits a successful authenticated settings password change", async () => {
    const updateUserById = vi.fn().mockResolvedValue({ error: null });
    const signInWithPassword = vi.fn().mockResolvedValue({ data: { user: { id: "user-id" } }, error: null });
    mocks.createSupabaseServerClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-id", email: "user@example.com" } } }) } });
    mocks.findProfileForUser.mockResolvedValue({ id: "profile-id", email: "user@example.com", role: "ADMIN", isActive: true });
    mocks.createSupabaseAuthClient.mockReturnValue({ auth: { signInWithPassword } });
    mocks.createSupabaseAdminClient.mockReturnValue({ auth: { admin: { updateUserById } } });
    const form = new FormData();
    form.set("currentPassword", "old-password");
    form.set("password", "new-secure-password");
    form.set("confirmPassword", "new-secure-password");

    await expect(changePasswordAction({}, form)).resolves.toEqual({ success: "Password updated." });
    expect(signInWithPassword).toHaveBeenCalledWith({ email: "user@example.com", password: "old-password" });
    expect(updateUserById).toHaveBeenCalledWith("user-id", { password: "new-secure-password" });
    expect(mocks.auditCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ actorId: "profile-id", action: "PASSWORD_CHANGE" }) });
  });

  it("reauthenticates with the normalized provider email when the profile email is stale", async () => {
    const updateUserById = vi.fn().mockResolvedValue({ error: null });
    const signInWithPassword = vi.fn().mockResolvedValue({ data: { user: { id: "user-id" } }, error: null });
    mocks.createSupabaseServerClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-id", email: " Current@Example.COM " } } }) } });
    mocks.findProfileForUser.mockResolvedValue({ id: "profile-id", email: "stale@example.com", role: "ADMIN", isActive: true });
    mocks.createSupabaseAuthClient.mockReturnValue({ auth: { signInWithPassword } });
    mocks.createSupabaseAdminClient.mockReturnValue({ auth: { admin: { updateUserById } } });
    const form = new FormData();
    form.set("currentPassword", "old-password");
    form.set("password", "new-secure-password");
    form.set("confirmPassword", "new-secure-password");

    await expect(changePasswordAction({}, form)).resolves.toEqual({ success: "Password updated." });
    expect(signInWithPassword).toHaveBeenCalledWith({ email: "current@example.com", password: "old-password" });
  });

  it("fails safely when the provider user has no email", async () => {
    const signInWithPassword = vi.fn();
    const updateUserById = vi.fn();
    mocks.createSupabaseServerClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-id" } } }) } });
    mocks.findProfileForUser.mockResolvedValue({ id: "profile-id", email: "stale@example.com", role: "ADMIN", isActive: true });
    mocks.createSupabaseAuthClient.mockReturnValue({ auth: { signInWithPassword } });
    mocks.createSupabaseAdminClient.mockReturnValue({ auth: { admin: { updateUserById } } });
    const form = new FormData();
    form.set("currentPassword", "old-password");
    form.set("password", "new-secure-password");
    form.set("confirmPassword", "new-secure-password");

    await expect(changePasswordAction({}, form)).resolves.toEqual({ error: "Your session is missing or expired. Please sign in again." });
    expect(signInWithPassword).not.toHaveBeenCalled();
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it("logs a redacted audit failure without failing a completed settings password change", async () => {
    const updateUserById = vi.fn().mockResolvedValue({ error: null });
    const signInWithPassword = vi.fn().mockResolvedValue({ data: { user: { id: "user-id" } }, error: null });
    mocks.createSupabaseServerClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-id", email: "user@example.com" } } }) } });
    mocks.findProfileForUser.mockResolvedValue({ id: "profile-id", email: "user@example.com", role: "ADMIN", isActive: true });
    mocks.createSupabaseAuthClient.mockReturnValue({ auth: { signInWithPassword } });
    mocks.createSupabaseAdminClient.mockReturnValue({ auth: { admin: { updateUserById } } });
    mocks.auditCreate.mockRejectedValueOnce(new Error("database constraint and host detail"));
    const form = new FormData();
    form.set("currentPassword", "old-password");
    form.set("password", "new-secure-password");
    form.set("confirmPassword", "new-secure-password");

    await expect(changePasswordAction({}, form)).resolves.toEqual({ success: "Password updated." });
    expect(updateUserById).toHaveBeenCalledWith("user-id", { password: "new-secure-password" });
    expect(mocks.logError).toHaveBeenCalledWith({
      requestId: expect.any(String),
      code: "SETTINGS_PASSWORD_AUDIT_FAILED",
      status: 500,
      route: "/settings/security",
    });
  });
});
