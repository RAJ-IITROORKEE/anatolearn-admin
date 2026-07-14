import { loginSchema } from "@/features/auth/api-schemas";
import { findProfileForUser } from "@/features/auth/profile-service";
import { apiError, apiSuccess, requestId } from "@/lib/api/response";
import { checkAuthRateLimits, trustedClientIdentifier } from "@/lib/rate-limit";
import { createSupabaseAuthClient } from "@/lib/supabase/auth-client";

export async function POST(request: Request) {
  const id = requestId();
  const input = loginSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return apiError("VALIDATION_ERROR", "Invalid credentials.", 400, id);
  const rateLimit = await checkAuthRateLimits({
    namespace: "auth:login",
    accountIdentifier: input.data.email,
    clientIdentifier: trustedClientIdentifier(request.headers),
    clientLimit: 10,
    accountLimit: 30,
  });
  if (!rateLimit.allowed) {
    const response = apiError("RATE_LIMITED", "Try again later.", 429, id);
    response.headers.set("Retry-After", String(rateLimit.retryAfterSeconds));
    return response;
  }
  const supabase = createSupabaseAuthClient();
  const { data, error } = await supabase.auth.signInWithPassword(input.data);
  if (error || !data.user || !data.session) return apiError("INVALID_CREDENTIALS", "Email or password is incorrect.", 401, id);
  const profile = await findProfileForUser(data.user.id);
  if (!profile?.isActive) return apiError("ACCOUNT_INACTIVE", "Account access is unavailable.", 403, id);
  return apiSuccess({
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    expiresAt: data.session.expires_at,
    tokenType: data.session.token_type,
    profile: { id: profile.id, fullName: profile.fullName },
  }, { requestId: id });
}
