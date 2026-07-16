import { emailSchema } from "@/features/auth/api-schemas";
import { isAuthProviderUnavailable } from "@/features/auth/provider-errors";
import { apiError, apiSuccess, requestId } from "@/lib/api/response";
import { checkAuthRateLimits, trustedClientIdentifier } from "@/lib/rate-limit";
import { createSupabaseAuthClient } from "@/lib/supabase/auth-client";

export async function POST(request: Request) {
  const id = requestId();
  const input = emailSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return apiError("VALIDATION_ERROR", "Enter a valid email address.", 400, id, input.error.flatten().fieldErrors);

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

  try {
    const result = await createSupabaseAuthClient().auth.resend({ email: input.data.email, type: "signup" });
    if (isAuthProviderUnavailable(result.error)) {
      return apiError("AUTH_UNAVAILABLE", "Email verification is temporarily unavailable.", 503, id);
    }
  } catch {
    return apiError("AUTH_UNAVAILABLE", "Email verification is temporarily unavailable.", 503, id);
  }
  return apiSuccess({
    verificationRequired: true,
    message: "If signup verification is pending, a verification code will be sent.",
  }, { requestId: id }, 202);
}
