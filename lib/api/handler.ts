import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { apiError, requestId } from "./response";
import { ContentError } from "@/features/content/domain";
import { AssessmentError } from "@/features/assessments/domain";
import { ProgressError } from "@/features/progress/domain";

export function mapApiError(error: unknown, id: string) {
  if (error instanceof ContentError) return apiError(error.code, error.message, error.status, id, error.details);
  if (error instanceof AssessmentError) return apiError(error.code, error.message, error.status, id, error.details);
  if (error instanceof ProgressError) return apiError(error.code, error.message, error.status, id);
  if (error instanceof ZodError) return apiError("VALIDATION_ERROR", "Request validation failed.", 400, id, error.flatten().fieldErrors as Record<string, string[]>);
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") return apiError("CONFLICT", "A record with these unique values already exists.", 409, id);
    if (error.code === "P2003") return apiError("INVALID_REFERENCE", "A referenced record is unavailable.", 422, id);
    if (error.code === "P2025") return apiError("NOT_FOUND", "Content was not found.", 404, id);
  }
  console.error("Unhandled API error", { requestId: id, error });
  return apiError("INTERNAL_ERROR", "An unexpected error occurred.", 500, id);
}

export async function withApiErrors(callback: (id: string) => Promise<Response>) {
  const id = requestId();
  try { return await callback(id); } catch (error) { return mapApiError(error, id); }
}
