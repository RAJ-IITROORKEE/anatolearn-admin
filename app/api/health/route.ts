import { apiSuccess, requestId } from "@/lib/api/response";

export function GET() {
  const id = requestId();
  return apiSuccess({ status: "ok" }, { requestId: id });
}
