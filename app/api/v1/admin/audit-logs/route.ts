import { auditLogListSchema } from "@/features/audit/schemas";
import { listAuditLogs } from "@/features/audit/service";
import { requireAdmin } from "@/lib/api/admin";
import { apiError, apiSuccess } from "@/lib/api/response";

export async function GET(request: Request) {
  const auth = await requireAdmin(request); if ("response" in auth) return auth.response;
  const input = auditLogListSchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!input.success) return apiError("VALIDATION_ERROR", "Invalid audit-log filters.", 400, auth.id, input.error.flatten().fieldErrors);
  const result = await listAuditLogs(input.data);
  return apiSuccess(result.items, { requestId: auth.id, pagination: result.pagination });
}
