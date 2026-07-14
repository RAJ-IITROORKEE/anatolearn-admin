import { apiError } from "@/lib/api/response";
import { listSchema, uuidSchema } from "./schemas";

export function parseId(value: string, requestId: string) {
  const result = uuidSchema.safeParse(value);
  return result.success ? result.data : apiError("NOT_FOUND", "Notification campaign was not found.", 404, requestId);
}

export function parseList(request: Request) {
  return listSchema.parse(Object.fromEntries(new URL(request.url).searchParams));
}
