import { mediaError } from "@/features/media/http";
import { archiveMedia } from "@/features/media/service";
import { requireAdmin } from "@/lib/api/admin";
import { apiSuccess } from "@/lib/api/response";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(request, true); if ("response" in auth) return auth.response;
  try { return apiSuccess(await archiveMedia((await params).id, auth.identity.profile.id, auth.id), { requestId: auth.id }); } catch (error) { return mediaError(error, auth.id); }
}
