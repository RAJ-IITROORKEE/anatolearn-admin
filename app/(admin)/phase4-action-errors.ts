import type { ActionState } from "@/components/phase3/action-form";
import { FlashcardError } from "@/features/flashcards/domain";
import { QuestionError } from "@/features/questions/domain";
import { logError } from "@/lib/logger";

export function phase4ActionError(error: unknown, context: { requestId?: string; route?: string } = {}): ActionState {
  if (error instanceof FlashcardError || error instanceof QuestionError) return { error: error.message };
  const unexpected = error instanceof Error ? error : new Error("Unknown exception");
  logError({ requestId: context.requestId ?? "unknown", code: "ADMIN_ACTION_FAILED", status: 500, route: context.route, details: { errorName: unexpected.name, message: unexpected.message.replace(/[\r\n]/g, " ").slice(0, 240) } });
  return { error: "The operation could not be completed." };
}
