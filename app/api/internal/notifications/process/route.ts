import { apiError, apiSuccess, requestId } from "@/lib/api/response";
import { mapApiError } from "@/lib/api/handler";
import { parseEmptyJsonBody } from "@/lib/api/body";
import { getCronEnv } from "@/lib/env";
import { hasValidCronAuthorization } from "@/lib/security/cron";
import { getExpoProvider } from "@/features/notifications/provider";
import { processNotifications } from "@/features/notifications/worker";

async function handle(request: Request) {
  const id = requestId();
  try {
    const secret = getCronEnv().CRON_SECRET;
    if (!secret) return apiError("CRON_UNAVAILABLE", "Scheduled processing is not configured.", 503, id);
    if (!hasValidCronAuthorization(request.headers.get("authorization"), secret)) return apiError("UNAUTHORIZED", "Authentication is required.", 401, id);
    if (request.method === "POST") await parseEmptyJsonBody(request);
    const provider = getExpoProvider();
    if (!provider) return apiSuccess({ campaigns: 0, deliveries: 0, finalized: 0 }, { requestId: id });
    return apiSuccess(await processNotifications(provider), { requestId: id });
  } catch (error) { return mapApiError(error, id, "/api/internal/notifications/process"); }
}
export const GET = handle;
export const POST = handle;
