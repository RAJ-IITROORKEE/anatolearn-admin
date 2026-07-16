import { registerSchema } from "@/features/auth/api-schemas";
import { isAuthProviderUnavailable } from "@/features/auth/provider-errors";
import { apiError, apiSuccess, requestId } from "@/lib/api/response";
import { checkAuthRateLimits, trustedClientIdentifier } from "@/lib/rate-limit";
import { createSupabaseAuthClient } from "@/lib/supabase/auth-client";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logError } from "@/lib/logger";

const pendingVerification = {
  verificationRequired: true,
  message: "If this email can be registered, a verification code will be sent.",
} as const;

export async function POST(request: Request) {
  const id = requestId();
  const input = registerSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return apiError("VALIDATION_ERROR", "Invalid registration details.", 400, id, input.error.flatten().fieldErrors);
  const rateLimit = await checkAuthRateLimits({
    namespace: "auth:signup-email",
    accountIdentifier: input.data.email,
    clientIdentifier: trustedClientIdentifier(request.headers),
    clientLimit: 10,
    accountLimit: 3,
    windowMs: 15 * 60_000,
  });
  if (!rateLimit.allowed) {
    const response = apiError("RATE_LIMITED", "Try again later.", 429, id);
    response.headers.set("Retry-After", String(rateLimit.retryAfterSeconds));
    return response;
  }
  const supabase = createSupabaseAuthClient();
  let result;
  try {
    result = await supabase.auth.signUp({
      email: input.data.email,
      password: input.data.password,
      options: { data: { full_name: input.data.fullName } },
    });
  } catch {
    return apiError("AUTH_UNAVAILABLE", "Email verification is temporarily unavailable.", 503, id);
  }
  const { data, error } = result;
  if (isAuthProviderUnavailable(error)) {
    return apiError("AUTH_UNAVAILABLE", "Email verification is temporarily unavailable.", 503, id);
  }
  if (data.session) {
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length > 0) {
      try {
        const deleted = await createSupabaseAdminClient().auth.admin.deleteUser(data.user.id);
        if (deleted.error) throw deleted.error;
      } catch {
        logError({ requestId: id, code: "REGISTRATION_COMPENSATION_FAILED", status: 500, route: "/api/v1/auth/register" });
      }
    }
    return apiError("AUTH_CONFIGURATION_ERROR", "Email verification is temporarily unavailable.", 503, id);
  }
  return apiSuccess(pendingVerification, { requestId: id }, 202);
}
