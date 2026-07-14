import { apiError } from "@/lib/api/response";
import { ZodError } from "zod";
import { MediaServiceError } from "./domain";
import { TrashError } from "@/features/trash/domain";

export function mediaError(error: unknown, requestId: string) {
  if (error instanceof ZodError) return apiError("VALIDATION_ERROR", "Request validation failed.", 400, requestId, error.flatten().fieldErrors as Record<string, string[]>);
  if (error instanceof MediaServiceError) {
    const status = error.code === "NOT_FOUND" ? 404 : error.code === "REFERENCED" || error.code === "HARD_DELETE_DISABLED" ? 409 : error.code === "INVALID_FILE" ? 400 : 502;
    return apiError(error.code, error.message, status, requestId);
  }
  if (error instanceof TrashError) return apiError(error.code, error.message, error.status, requestId);
  return apiError("INTERNAL_ERROR", "The media operation failed.", 500, requestId);
}
