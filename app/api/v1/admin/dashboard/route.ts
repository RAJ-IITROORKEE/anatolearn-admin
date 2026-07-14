import { getAdminDashboard } from "@/features/admin-dashboard/service";
import { parseAdminDashboardQuery } from "@/features/admin-dashboard/schemas";
import { requireAdmin } from "@/lib/api/admin";
import { mapApiError } from "@/lib/api/handler";
import { apiSuccess } from "@/lib/api/response";

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;

  try {
    const input = parseAdminDashboardQuery(new URL(request.url).searchParams);
    return apiSuccess(await getAdminDashboard(input), { requestId: auth.id });
  } catch (error) {
    return mapApiError(error, auth.id);
  }
}
