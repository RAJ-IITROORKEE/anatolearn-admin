import { resetPasswordSchema } from "@/features/auth/api-schemas";
import { isAuthProviderUnavailable } from "@/features/auth/provider-errors";
import { findProfileForUser } from "@/features/auth/profile-service";
import { apiError, apiSuccess, requestId } from "@/lib/api/response";
import { hasRecoveryMethod } from "@/lib/auth/token-claims";
import { prisma } from "@/lib/db/prisma";
import { logError } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseAuthClient } from "@/lib/supabase/auth-client";

export async function POST(request: Request) {
  const id = requestId();
  const input = resetPasswordSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return apiError("VALIDATION_ERROR", "Invalid password reset request.", 400, id, input.error.flatten().fieldErrors);
  const rateLimit = await checkRateLimit("auth:reset-password", input.data.accessToken, 5);
  if (!rateLimit.allowed) {
    const response = apiError("RATE_LIMITED", "Try again later.", 429, id);
    response.headers.set("Retry-After", String(rateLimit.retryAfterSeconds));
    return response;
  }
  if (!hasRecoveryMethod(input.data.accessToken)) return apiError("INVALID_RECOVERY_SESSION", "The recovery session is invalid or expired.", 401, id);
  const supabase = createSupabaseAuthClient();
  let userResult;
  try {
    userResult = await supabase.auth.getUser(input.data.accessToken);
  } catch {
    return apiError("AUTH_UNAVAILABLE", "Password recovery is temporarily unavailable.", 503, id);
  }
  const { data: userData, error: userError } = userResult;
  if (isAuthProviderUnavailable(userError)) return apiError("AUTH_UNAVAILABLE", "Password recovery is temporarily unavailable.", 503, id);
  if (userError || !userData.user) return apiError("INVALID_RECOVERY_SESSION", "The recovery session is invalid or expired.", 401, id);
  const admin = createSupabaseAdminClient();
  let updateResult;
  try {
    updateResult = await admin.auth.admin.updateUserById(userData.user.id, { password: input.data.password });
  } catch {
    return apiError("AUTH_UNAVAILABLE", "Password recovery is temporarily unavailable.", 503, id);
  }
  const { error } = updateResult;
  if (isAuthProviderUnavailable(error)) return apiError("AUTH_UNAVAILABLE", "Password recovery is temporarily unavailable.", 503, id);
  if (error) return apiError("PASSWORD_UPDATE_FAILED", "The password could not be changed.", 422, id);
  try {
    const profile = await findProfileForUser(userData.user.id);
    if (profile) {
      await prisma.auditLog.create({ data: { actorId: profile.id, action: "PASSWORD_CHANGE", entityType: "Profile", entityId: profile.id, requestId: id } });
    }
  } catch {
    logError({ requestId: id, code: "RECOVERY_PASSWORD_AUDIT_FAILED", status: 500, route: "/api/v1/auth/reset-password" });
  }
  try {
    const revoked = await admin.auth.admin.signOut(input.data.accessToken, "global");
    if (revoked.error) throw revoked.error;
  } catch {
    // Password replacement succeeded; access tokens expire independently and refresh sessions are revoked best-effort.
    logError({ requestId: id, code: "RECOVERY_SESSION_REVOCATION_FAILED", status: 503, route: "/api/v1/auth/reset-password" });
  }
  return apiSuccess({ passwordUpdated: true }, { requestId: id });
}
