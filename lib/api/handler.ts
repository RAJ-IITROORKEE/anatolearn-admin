import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { apiError, requestId } from "./response";
import { ContentError } from "@/features/content/domain";
import { AssessmentError } from "@/features/assessments/domain";
import { ProgressError } from "@/features/progress/domain";
import { FeedbackError } from "@/features/feedback/domain";
import { UserManagementError } from "@/features/users/domain";
import { NotificationError } from "@/features/notifications/domain";
import { isRestoreDeadlineDatabaseError, TrashError } from "@/features/trash/domain";
import { logError } from "@/lib/logger";

export function mapApiError(error: unknown, id: string, route?: string) {
  if (error instanceof ContentError) return apiError(error.code, error.message, error.status, id, error.details);
  if (error instanceof AssessmentError) return apiError(error.code, error.message, error.status, id, error.details);
  if (error instanceof ProgressError) return apiError(error.code, error.message, error.status, id);
  if (error instanceof FeedbackError) return apiError(error.code, error.message, error.status, id);
  if (error instanceof UserManagementError) return apiError(error.code, error.message, error.status, id);
  if (error instanceof NotificationError) return apiError(error.code, error.message, error.status, id);
  if (error instanceof TrashError) return apiError(error.code, error.message, error.status, id);
  if (isRestoreDeadlineDatabaseError(error)) return apiError("RESTORE_EXPIRED", "The trash retention deadline has expired.", 409, id);
  if (error instanceof ZodError) return apiError("VALIDATION_ERROR", "Request validation failed.", 400, id, error.flatten().fieldErrors as Record<string, string[]>);
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") return apiError("CONFLICT", "A record with these unique values already exists.", 409, id);
    if (error.code === "P2003") return apiError("INVALID_REFERENCE", "A referenced record is unavailable.", 422, id);
    if (error.code === "P2025") return apiError("NOT_FOUND", "Content was not found.", 404, id);
  }
  logError({ requestId: id, code: "INTERNAL_ERROR", status: 500, route });
  return apiError("INTERNAL_ERROR", "An unexpected error occurred.", 500, id);
}

export async function withApiErrors(callback: (id: string) => Promise<Response>, route?: string) {
  const id = requestId();
  try { return await callback(id); } catch (error) { return mapApiError(error, id, route); }
}
