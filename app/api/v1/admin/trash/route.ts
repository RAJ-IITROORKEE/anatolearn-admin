import { listTrash } from "@/features/trash/service";
import { trashListSchema } from "@/features/trash/schemas";
import { requireAdmin } from "@/lib/api/admin";
import { mapApiError } from "@/lib/api/handler";
import { apiSuccess } from "@/lib/api/response";

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if ("response" in auth) return auth.response!;
  try {
    const input = trashListSchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    const result = await listTrash(input);
    return apiSuccess(result.items, { requestId: auth.id, pagination: result.pagination });
  } catch (error) {
    return mapApiError(error, auth.id, "/api/v1/admin/trash");
  }
}
