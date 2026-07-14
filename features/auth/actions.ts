"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { emailSchema, loginSchema, passwordSchema } from "@/features/auth/schemas";
import { findProfileForUser } from "@/features/auth/profile-service";
import { canAccessAdmin } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";
import { getAuthRedirectUrls } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { checkAuthRateLimits, trustedClientIdentifier } from "@/lib/rate-limit";

export type AuthActionState = { error?: string; success?: string };

export async function loginAction(_: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const input = loginSchema.safeParse(Object.fromEntries(formData));
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
  const input = emailSchema.safeParse(Object.fromEntries(formData));
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

export async function updatePasswordAction(
  _: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const input = passwordSchema.safeParse(Object.fromEntries(formData));
  if (!input.success) return { error: input.error.issues[0]?.message ?? "Enter a valid password." };
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: "Your recovery session is missing or expired." };
  const { error } = await supabase.auth.updateUser({ password: input.data.password });
  if (error) return { error: "The password could not be changed. Request a new reset link." };
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
  return { success: "Password updated. You can continue securely." };
}

export async function logoutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
