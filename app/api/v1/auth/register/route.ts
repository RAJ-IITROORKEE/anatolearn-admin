import { registerSchema } from "@/features/auth/api-schemas";
import { provisionUserProfile } from "@/features/auth/profile-service";
import { provisionRegisteredUser, RegistrationRetryError } from "@/features/auth/registration";
import { apiError, apiSuccess, requestId } from "@/lib/api/response";
import { checkAuthRateLimits, trustedClientIdentifier } from "@/lib/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseAuthClient } from "@/lib/supabase/auth-client";

export async function POST(request: Request) {
  const id = requestId();
  const input = registerSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return apiError("VALIDATION_ERROR", "Invalid registration details.", 400, id, input.error.flatten().fieldErrors);
  const rateLimit = await checkAuthRateLimits({
    namespace: "auth:register",
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
  const { data, error } = await supabase.auth.signUp({
    email: input.data.email,
    password: input.data.password,
    options: { data: { full_name: input.data.fullName } },
  });
  if (error || !data.user) return apiError("REGISTRATION_FAILED", "Registration could not be completed.", 409, id);
  try {
    await provisionRegisteredUser(
      data.user,
      input.data.fullName,
      provisionUserProfile,
      (userId) => createSupabaseAdminClient().auth.admin.deleteUser(userId),
      id,
    );
  } catch (provisionError) {
    if (provisionError instanceof RegistrationRetryError) {
      return apiError(provisionError.code, provisionError.message, 503, id);
    }
    throw provisionError;
  }
  return apiSuccess({ userId: data.user.id, emailConfirmationRequired: !data.session }, { requestId: id }, 201);
}
