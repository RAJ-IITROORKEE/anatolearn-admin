import { changePasswordSchema } from "@/features/auth/api-schemas";
import { apiError, apiSuccess, requestId } from "@/lib/api/response";
import { resolveRequestIdentity } from "@/lib/auth/request";
import { prisma } from "@/lib/db/prisma";
import { allowRequest, requestClientKey } from "@/lib/rate-limit";
import { hasSafeOrigin } from "@/lib/security/origin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseAuthClient } from "@/lib/supabase/auth-client";

export async function POST(request: Request) {
  const id = requestId();
  if (!allowRequest(requestClientKey(request, "change-password"), 5)) return apiError("RATE_LIMITED", "Try again later.", 429, id);
  const identity = await resolveRequestIdentity(request);
  if (!identity) return apiError("UNAUTHORIZED", "Authentication is required.", 401, id);
  if (identity.mode === "cookie" && !hasSafeOrigin(request.headers)) return apiError("INVALID_ORIGIN", "Request origin is not allowed.", 403, id);
  const input = changePasswordSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return apiError("VALIDATION_ERROR", "Invalid password change request.", 400, id, input.error.flatten().fieldErrors);
  const supabase = createSupabaseAuthClient();
  const { error: verificationError } = await supabase.auth.signInWithPassword({ email: identity.profile.email, password: input.data.currentPassword });
  if (verificationError) return apiError("INVALID_CURRENT_PASSWORD", "The current password is incorrect.", 401, id);
  const { error } = await createSupabaseAdminClient().auth.admin.updateUserById(identity.user.id, { password: input.data.newPassword });
  if (error) return apiError("PASSWORD_UPDATE_FAILED", "The password could not be changed.", 422, id);
  await prisma.auditLog.create({ data: { actorId: identity.profile.id, action: "PASSWORD_CHANGE", entityType: "Profile", entityId: identity.profile.id, requestId: id } });
  return apiSuccess({ passwordUpdated: true }, { requestId: id });
}
