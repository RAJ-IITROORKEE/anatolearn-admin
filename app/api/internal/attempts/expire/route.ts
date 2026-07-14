import { expireDueAttempts } from "@/features/assessments/finalization-service";
import { mapApiError } from "@/lib/api/handler";
import { apiError, apiSuccess, requestId } from "@/lib/api/response";
import { getCronEnv } from "@/lib/env";
import { hasValidCronAuthorization } from "@/lib/security/cron";

const BATCH_SIZE = 50;
const MAX_BATCHES = 10;
const MAX_RUNTIME_MS = 8_000;

async function handle(request: Request) {
  const id = requestId();
  try {
    const secret = getCronEnv().CRON_SECRET;
    if (!secret) return apiError("CRON_UNAVAILABLE", "Scheduled processing is not configured.", 503, id);
    if (!hasValidCronAuthorization(request.headers.get("authorization"), secret)) return apiError("UNAUTHORIZED", "Authentication is required.", 401, id);
    const startedAt = Date.now();
    let claimed = 0;
    let finalized = 0;
    let batches = 0;
    while (batches < MAX_BATCHES && Date.now() - startedAt < MAX_RUNTIME_MS) {
      const result = await expireDueAttempts({ limit: BATCH_SIZE });
      claimed += result.claimed;
      finalized += result.finalized;
      batches += 1;
      if (result.claimed < BATCH_SIZE) break;
    }
    return apiSuccess({ claimed, finalized, batches }, { requestId: id });
  } catch (error) {
    return mapApiError(error, id);
  }
}

export const GET = handle;
export const POST = handle;
