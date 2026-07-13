import { mediaError } from "@/features/media/http";
import { mediaListSchema, mediaUploadSchema } from "@/features/media/schemas";
import { listMedia, uploadMedia } from "@/features/media/service";
import { requireAdmin } from "@/lib/api/admin";
import { apiError, apiSuccess } from "@/lib/api/response";

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if ("response" in auth) return auth.response;
  const input = mediaListSchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!input.success) return apiError("VALIDATION_ERROR", "Invalid media filters.", 400, auth.id, input.error.flatten().fieldErrors);
  try { const result = await listMedia(input.data); return apiSuccess(result.items, { requestId: auth.id, pagination: result.pagination }); } catch (error) { return mediaError(error, auth.id); }
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request, true);
  if ("response" in auth) return auth.response;
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const input = mediaUploadSchema.safeParse({ altText: form?.get("altText") });
  if (!(file instanceof File) || !input.success) return apiError("VALIDATION_ERROR", "A valid image and alt text are required.", 400, auth.id, input.success ? undefined : input.error.flatten().fieldErrors);
  try { return apiSuccess(await uploadMedia(file, input.data.altText, auth.identity.profile.id, auth.id), { requestId: auth.id }, 201); } catch (error) { return mediaError(error, auth.id); }
}
