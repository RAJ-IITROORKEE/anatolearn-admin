import { parseEmptyJsonBody } from "@/lib/api/body";
import { mapApiError } from "@/lib/api/handler";
import { apiError, apiSuccess, requestId } from "@/lib/api/response";
import { getCronEnv } from "@/lib/env";
import { hasValidCronAuthorization } from "@/lib/security/cron";
import { processMediaPurgeJobs, purgeDueTrash } from "@/features/trash/worker";

const BATCH_SIZE = 25;
const MAX_BATCHES = 4;
const MAX_RUNTIME_MS = 8_000;

async function handle(request: Request) {
  const id = requestId();
  try {
    const secret = getCronEnv().CRON_SECRET;
    if (!secret) return apiError("CRON_UNAVAILABLE", "Scheduled processing is not configured.", 503, id);
    if (!hasValidCronAuthorization(request.headers.get("authorization"), secret)) return apiError("UNAUTHORIZED", "Authentication is required.", 401, id);
    if (request.method === "POST") await parseEmptyJsonBody(request);
    const startedAt = Date.now();
    let batches = 0;
    let claimed = 0;
    let purged = 0;
    let blocked = 0;
    let storageClaimed = 0;
    let storageRemoved = 0;
    let storageRetried = 0;
    while (batches < MAX_BATCHES && Date.now() - startedAt < MAX_RUNTIME_MS) {
      const purge = await purgeDueTrash({ limit: BATCH_SIZE });
      const storage = await processMediaPurgeJobs({ limit: BATCH_SIZE });
      claimed += purge.claimed;
      purged += purge.purged;
      blocked += purge.blocked;
      storageClaimed += storage.claimed;
      storageRemoved += storage.removed;
      storageRetried += storage.retried;
      batches += 1;
      if (purge.claimed < BATCH_SIZE && storage.claimed < BATCH_SIZE) break;
    }
    return apiSuccess({ claimed, purged, blocked, storageClaimed, storageRemoved, storageRetried, batches }, { requestId: id });
  } catch (error) {
    return mapApiError(error, id, "/api/internal/trash/purge");
  }
}

export const GET = handle;
export const POST = handle;
