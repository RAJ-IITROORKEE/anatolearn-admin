import { verifyRecoveryOtpSchema } from "@/features/auth/api-schemas";
import { isAuthProviderUnavailable } from "@/features/auth/provider-errors";
import { apiError, apiSuccess, requestId } from "@/lib/api/response";
import { hasRecoveryMethod } from "@/lib/auth/token-claims";
import { checkAuthRateLimits, trustedClientIdentifier } from "@/lib/rate-limit";
import { createSupabaseAuthClient } from "@/lib/supabase/auth-client";

export async function POST(request: Request) {
  const id = requestId();
  const input = verifyRecoveryOtpSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) {
    return apiError("VALIDATION_ERROR", "Enter the six-digit recovery code.", 400, id, input.error.flatten().fieldErrors);
  }

  const rateLimit = await checkAuthRateLimits({
    namespace: "auth:verify-recovery-otp",
    accountIdentifier: input.data.email,
    clientIdentifier: trustedClientIdentifier(request.headers),
    clientLimit: 10,
    accountLimit: 5,
    windowMs: 10 * 60_000,
  });
  if (!rateLimit.allowed) {
    const response = apiError("RATE_LIMITED", "Try again later.", 429, id);
    response.headers.set("Retry-After", String(rateLimit.retryAfterSeconds));
    return response;
  }

  let result;
  try {
    result = await createSupabaseAuthClient().auth.verifyOtp({
      email: input.data.email,
      token: input.data.otp,
      type: "recovery",
    });
  } catch {
    return apiError("AUTH_UNAVAILABLE", "Password recovery is temporarily unavailable.", 503, id);
  }
  if (isAuthProviderUnavailable(result.error)) {
    return apiError("AUTH_UNAVAILABLE", "Password recovery is temporarily unavailable.", 503, id);
  }
  const session = result.data.session;
  if (result.error || !result.data.user || !session?.access_token || !session.expires_at || !hasRecoveryMethod(session.access_token)) {
    return apiError("INVALID_OR_EXPIRED_OTP", "The recovery code is invalid or has expired.", 400, id);
  }

  return apiSuccess({ accessToken: session.access_token, expiresAt: session.expires_at }, { requestId: id });
}
