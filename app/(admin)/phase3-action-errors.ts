import { Prisma } from "@prisma/client";
import { ZodError } from "zod";

import { ContentError } from "@/features/content/domain";
import { MediaServiceError } from "@/features/media/domain";
import type { ActionState } from "@/components/phase3/action-form";

export function phase3ActionError(error: unknown): ActionState {
  if (error instanceof ContentError || error instanceof MediaServiceError) return { error: error.message };
  if (error instanceof ZodError) return { error: error.issues[0]?.message ?? "Check the form fields." };
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") return { error: "A record with these values already exists." };
    if (error.code === "P2003") return { error: "A referenced record is unavailable." };
    if (error.code === "P2025") return { error: "The requested content was not found." };
  }
  return { error: "The operation could not be completed." };
}
