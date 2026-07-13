import { listAdminAttempts } from "@/features/assessments/admin-service";
import { adminAttemptListSchema } from "@/features/progress/schemas";
import { mapApiError } from "@/lib/api/handler";
import { requireAdmin } from "@/lib/api/admin";
import { apiSuccess } from "@/lib/api/response";

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  try {
    const input = adminAttemptListSchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    const result = await listAdminAttempts(input);
    return apiSuccess(result.items, { requestId: auth.id, pagination: result.pagination });
  } catch (error) {
    return mapApiError(error, auth.id);
  }
}
