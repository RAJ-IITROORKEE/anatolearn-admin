import { resetPasswordSchema } from "@/features/auth/api-schemas";
import { apiError, apiSuccess, requestId } from "@/lib/api/response";
import { hasRecoveryMethod } from "@/lib/auth/token-claims";
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
  const { data: userData, error: userError } = await supabase.auth.getUser(input.data.accessToken);
  if (userError || !userData.user) return apiError("INVALID_RECOVERY_SESSION", "The recovery session is invalid or expired.", 401, id);
  const { error } = await createSupabaseAdminClient().auth.admin.updateUserById(userData.user.id, { password: input.data.password });
  if (error) return apiError("PASSWORD_UPDATE_FAILED", "The password could not be changed.", 422, id);
  return apiSuccess({ passwordUpdated: true }, { requestId: id });
}
