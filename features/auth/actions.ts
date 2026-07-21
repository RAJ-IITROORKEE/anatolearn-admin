"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { emailSchema, loginSchema, passwordSchema } from "@/features/auth/schemas";
import { findProfileForUser, syncProfileEmail } from "@/features/auth/profile-service";
import { canAccessAdmin } from "@/lib/auth/permissions";
import { hasRecoveryMethod } from "@/lib/auth/token-claims";
import { prisma } from "@/lib/db/prisma";
import { getAuthRedirectUrls } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAuthClient } from "@/lib/supabase/auth-client";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { checkAuthRateLimits, checkRateLimit, trustedClientIdentifier } from "@/lib/rate-limit";
import { logError } from "@/lib/logger";

export type AuthActionState = { error?: string; success?: string };

export async function loginAction(_: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const input = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!input.success) return { error: "Enter a valid email and password." };
  const requestHeaders = await headers();
  const rateLimit = await checkAuthRateLimits({
    namespace: "auth:login",
    accountIdentifier: input.data.email,
    clientIdentifier: trustedClientIdentifier(requestHeaders),
    clientLimit: 10,
    accountLimit: 30,
  });
  if (!rateLimit.allowed) return { error: "Too many attempts. Please try again later." };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword(input.data);
  if (error || !data.user) return { error: "Email or password is incorrect." };

  await syncProfileEmail(data.user);
  const profile = await findProfileForUser(data.user.id);
  if (!profile || !canAccessAdmin(profile)) {
    await supabase.auth.signOut();
    return { error: "This account does not have active administrator access." };
  }

  await prisma.$transaction([
    prisma.profile.update({ where: { id: profile.id }, data: { lastLoginAt: new Date() } }),
    prisma.auditLog.create({
      data: { actorId: profile.id, action: "LOGIN", entityType: "Profile", entityId: profile.id },
    }),
  ]);
  redirect("/dashboard");
}

export async function forgotPasswordAction(
  _: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const input = emailSchema.safeParse({ email: formData.get("email") });
  if (!input.success) return { error: "Enter a valid email address." };
  const requestHeaders = await headers();
  const rateLimit = await checkAuthRateLimits({
    namespace: "auth:forgot-password",
    accountIdentifier: input.data.email,
    clientIdentifier: trustedClientIdentifier(requestHeaders),
    clientLimit: 5,
    accountLimit: 15,
  });
  if (!rateLimit.allowed) return { error: "Too many attempts. Please try again later." };
  const supabase = await createSupabaseServerClient();
  const { passwordReset } = getAuthRedirectUrls();
  await supabase.auth.resetPasswordForEmail(input.data.email, { redirectTo: passwordReset });
  return { success: "If an account exists, password reset instructions have been sent." };
}

export async function resetPasswordAction(
  _: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const input = passwordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!input.success) return { error: input.error.issues[0]?.message ?? "Enter a valid password." };
  const supabase = await createSupabaseServerClient();
  let accessToken: string | undefined;
  try {
    const sessionResult = await supabase.auth.getSession();
    accessToken = sessionResult.data.session?.access_token;
  } catch {
    return { error: "Password recovery is temporarily unavailable. Please try again." };
  }
  if (!accessToken || !hasRecoveryMethod(accessToken)) return { error: "Your recovery session is missing or expired." };
  const rateLimit = await checkRateLimit("auth:reset-password", accessToken, 5);
  if (!rateLimit.allowed) return { error: "Too many attempts. Please try again later." };
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: "Your recovery session is missing or expired." };
  const { error } = await supabase.auth.updateUser({ password: input.data.password });
  if (error) return { error: "The password could not be changed. Request a new reset link." };
  const recoveryRequestId = crypto.randomUUID();
  try {
    const profile = await findProfileForUser(userData.user.id);
    if (profile) {
      await prisma.auditLog.create({
        data: {
          actorId: profile.id,
          action: "PASSWORD_CHANGE",
          entityType: "Profile",
          entityId: profile.id,
        },
      });
    }
  } catch {
    logError({ requestId: recoveryRequestId, code: "RECOVERY_PASSWORD_AUDIT_FAILED", status: 500, route: "/reset-password" });
  }
  try {
    const revoked = await supabase.auth.signOut({ scope: "global" });
    if (revoked.error) throw revoked.error;
  } catch {
    logError({ requestId: recoveryRequestId, code: "RECOVERY_SESSION_REVOCATION_FAILED", status: 503, route: "/reset-password" });
  }
  return { success: "Password updated. Sign in with your new password." };
}

export async function changePasswordAction(
  _: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const input = passwordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  const currentPassword = formData.get("currentPassword");
  if (!input.success) return { error: input.error.issues[0]?.message ?? "Enter a valid password." };
  if (typeof currentPassword !== "string" || !currentPassword || currentPassword.length > 128) return { error: "Enter your current password." };
  if (currentPassword === input.data.password) return { error: "New password must differ from the current password." };

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: "Your session is missing or expired. Please sign in again." };
  const verifiedEmail = userData.user.email?.trim().toLowerCase();
  if (!verifiedEmail) return { error: "Your session is missing or expired. Please sign in again." };
  const profile = await findProfileForUser(userData.user.id);
  if (!profile || !canAccessAdmin(profile)) return { error: "This account does not have active administrator access." };
  const rateLimit = await checkRateLimit("auth:change-password", profile.id, 5);
  if (!rateLimit.allowed) return { error: "Too many attempts. Please try again later." };

  try {
    const verification = await createSupabaseAuthClient().auth.signInWithPassword({ email: verifiedEmail, password: currentPassword });
    if (verification.error || verification.data.user?.id !== userData.user.id) {
      return { error: "The current password is incorrect." };
    }
  } catch {
    return { error: "Password verification is temporarily unavailable. Please try again." };
  }
  try {
    const update = await createSupabaseAdminClient().auth.admin.updateUserById(userData.user.id, { password: input.data.password });
    if (update.error) return { error: "The password could not be changed. Please try again." };
  } catch {
    return { error: "The password could not be changed. Please try again." };
  }
  try {
    await prisma.auditLog.create({
      data: { actorId: profile.id, action: "PASSWORD_CHANGE", entityType: "Profile", entityId: profile.id },
    });
  } catch {
    logError({ requestId: crypto.randomUUID(), code: "SETTINGS_PASSWORD_AUDIT_FAILED", status: 500, route: "/settings/security" });
  }
  return { success: "Password updated." };
}

export async function updateEmailAction(
  _: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const input = emailSchema.safeParse({ email: formData.get("email") });
  if (!input.success) return { error: "Enter a valid email address." };

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: "Your session is missing or expired. Please sign in again." };

  const profile = await findProfileForUser(userData.user.id);
  if (!profile || !canAccessAdmin(profile)) return { error: "This account does not have active administrator access." };
  if (userData.user.email?.trim().toLowerCase() === input.data.email) return { error: "Enter a different email address." };

  const requestHeaders = await headers();
  const rateLimit = await checkAuthRateLimits({
    namespace: "auth:update-email",
    accountIdentifier: input.data.email,
    clientIdentifier: trustedClientIdentifier(requestHeaders),
    clientLimit: 3,
    accountLimit: 5,
  });
  if (!rateLimit.allowed) return { error: "Too many attempts. Please try again later." };

  const { callback } = getAuthRedirectUrls();
  const emailRedirect = new URL(callback);
  emailRedirect.searchParams.set("next", "/settings/profile");
  const { error } = await supabase.auth.updateUser(
    { email: input.data.email },
    { emailRedirectTo: emailRedirect.toString() },
  );
  if (error) return { error: "The email could not be changed. Check that it is available and try again." };
  return { success: "Check your email to confirm the new address." };
}

export async function logoutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
