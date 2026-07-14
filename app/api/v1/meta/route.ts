import { apiSuccess, requestId } from "@/lib/api/response";

export function GET() {
  const id = requestId();
  return apiSuccess(
    { apiVersion: "v1", capabilities: { authentication: true, storage: "private", notifications: true } },
    { requestId: id },
    200,
    { cacheControl: "public, max-age=300" },
  );
}
