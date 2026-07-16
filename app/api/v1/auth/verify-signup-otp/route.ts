import { verifySignupOtpSchema } from "@/features/auth/api-schemas";
import { isAuthProviderUnavailable } from "@/features/auth/provider-errors";
import { provisionUserProfile } from "@/features/auth/profile-service";
import { apiError, apiSuccess, requestId } from "@/lib/api/response";
import { checkAuthRateLimits, trustedClientIdentifier } from "@/lib/rate-limit";
import { createSupabaseAuthClient } from "@/lib/supabase/auth-client";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const id = requestId();
  const input = verifySignupOtpSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return apiError("VALIDATION_ERROR", "Enter the six-digit verification code.", 400, id, input.error.flatten().fieldErrors);

  const rateLimit = await checkAuthRateLimits({
    namespace: "auth:verify-signup-otp",
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
      type: "signup",
    });
  } catch {
    return apiError("AUTH_UNAVAILABLE", "Email verification is temporarily unavailable.", 503, id);
  }
  const { data, error } = result;
  if (isAuthProviderUnavailable(error)) {
    return apiError("AUTH_UNAVAILABLE", "Email verification is temporarily unavailable.", 503, id);
  }
  if (error || !data.user?.email_confirmed_at) {
    return apiError("INVALID_OR_EXPIRED_OTP", "The verification code is invalid or has expired.", 400, id);
  }

  try {
    const admin = createSupabaseAdminClient();
    const marker = await admin.auth.admin.updateUserById(data.user.id, {
      app_metadata: { ...data.user.app_metadata, signup_otp_verified: true },
    });
    if (marker.error) throw marker.error;
    await provisionUserProfile(data.user);
  } catch {
    return apiError("ACCOUNT_SETUP_RETRY", "Email verified. Sign in to finish setting up your account.", 503, id);
  }

  return apiSuccess({ verified: true }, { requestId: id });
}
