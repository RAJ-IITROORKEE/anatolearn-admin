import type { ActionState } from "@/components/phase3/action-form";
import { FlashcardError } from "@/features/flashcards/domain";
import { QuestionError } from "@/features/questions/domain";

export function phase4ActionError(error: unknown): ActionState {
  if (error instanceof FlashcardError || error instanceof QuestionError) return { error: error.message };
  return { error: "The operation could not be completed." };
}
