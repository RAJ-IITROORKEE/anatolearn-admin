import { emailSchema } from "@/features/auth/api-schemas";
import { apiError, apiSuccess, requestId } from "@/lib/api/response";
import { getAuthRedirectUrls } from "@/lib/env";
import { checkAuthRateLimits, trustedClientIdentifier } from "@/lib/rate-limit";
import { createSupabaseAuthClient } from "@/lib/supabase/auth-client";

export async function POST(request: Request) {
  const id = requestId();
  const input = emailSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return apiError("VALIDATION_ERROR", "Enter a valid email address.", 400, id);
  const rateLimit = await checkAuthRateLimits({
    namespace: "auth:forgot-password",
    accountIdentifier: input.data.email,
    clientIdentifier: trustedClientIdentifier(request.headers),
    clientLimit: 5,
    accountLimit: 15,
  });
  if (!rateLimit.allowed) {
    const response = apiError("RATE_LIMITED", "Try again later.", 429, id);
    response.headers.set("Retry-After", String(rateLimit.retryAfterSeconds));
    return response;
  }
  const supabase = createSupabaseAuthClient();
  const { passwordReset } = getAuthRedirectUrls();
  await supabase.auth.resetPasswordForEmail(input.data.email, { redirectTo: passwordReset });
  return apiSuccess({ message: "If an account exists, reset instructions have been sent." }, { requestId: id });
}
