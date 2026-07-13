"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { ActionState } from "@/components/phase3/action-form";
import { bulkSetFlashcardStatus, createFlashcard, setFlashcardStatus, updateFlashcard } from "@/features/flashcards/service";
import { flashcardBulkStatusSchema, flashcardCreateSchema, flashcardStatusUpdateSchema, flashcardUpdateSchema } from "@/features/flashcards/schemas";
import { archiveQuestion, bulkSetQuestionStatus, createQuestion, duplicateQuestion, setQuestionActivity, setQuestionStatus, updateQuestion } from "@/features/questions/service";
import { questionActivitySchema, questionBulkStatusSchema, questionCreateSchema, questionStatusSchema, questionUpdateSchema } from "@/features/questions/schemas";
import { requireAdminPage } from "@/lib/auth/session";
import { phase4ActionError } from "./phase4-action-errors";

const value = (data: FormData, key: string) => String(data.get(key) ?? "").trim();
const nullable = (data: FormData, key: string) => value(data, key) || null;
const isRedirect = (error: unknown) => (error as { digest?: string }).digest?.startsWith("NEXT_REDIRECT");
const context = async () => {
  const { profile } = await requireAdminPage();
  return { actorId: profile.id, requestId: crypto.randomUUID() };
};

function flashcardInput(data: FormData) {
  return {
    topicId: value(data, "topicId"),
    frontText: value(data, "frontText"),
    backText: value(data, "backText"),
    frontMediaId: nullable(data, "frontMediaId"),
    backMediaId: nullable(data, "backMediaId"),
    difficulty: value(data, "difficulty"),
    notes: nullable(data, "notes"),
    displayOrder: Number(value(data, "displayOrder")),
  };
}

function questionInput(data: FormData) {
  const count = Number(value(data, "optionCount"));
  const correct = Number(value(data, "correctOption"));
  return {
    topicId: value(data, "topicId"),
    assessmentType: value(data, "assessmentType"),
    questionText: value(data, "questionText"),
    mediaId: nullable(data, "mediaId"),
    explanation: value(data, "explanation"),
    difficulty: value(data, "difficulty"),
    conceptTag: nullable(data, "conceptTag"),
    options: Number.isInteger(count) && count >= 0 ? Array.from({ length: count }, (_, index) => ({
      ...(value(data, `optionId.${index}`) ? { id: value(data, `optionId.${index}`) } : {}),
      optionText: value(data, `optionText.${index}`),
      mediaId: nullable(data, `optionMediaId.${index}`),
      isCorrect: index === correct,
    })) : [],
  };
}

export async function createFlashcardAction(_state: ActionState, data: FormData): Promise<ActionState> {
  try {
    const parsed = flashcardCreateSchema.safeParse(flashcardInput(data));
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the flashcard fields." };
    const created = await createFlashcard(parsed.data, await context());
    revalidatePath("/flashcards");
    redirect(`/flashcards/${created.id}`);
  } catch (error) {
    if (isRedirect(error)) throw error;
    return phase4ActionError(error);
  }
}

export async function updateFlashcardAction(id: string, _state: ActionState, data: FormData): Promise<ActionState> {
  void _state;
  try {
    const parsed = flashcardUpdateSchema.safeParse(flashcardInput(data));
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the flashcard fields." };
    await updateFlashcard(id, parsed.data, await context());
    revalidatePath(`/flashcards/${id}`);
    return { success: "Flashcard saved." };
  } catch (error) { return phase4ActionError(error); }
}

export async function changeFlashcardStatusAction(id: string, status: string, _state: ActionState): Promise<ActionState> {
  void _state;
  try {
    const parsed = flashcardStatusUpdateSchema.parse({ status });
    await setFlashcardStatus(id, parsed.status, await context());
    revalidatePath("/flashcards", "layout");
    return { success: `Flashcard ${status.toLowerCase()}.` };
  } catch (error) { return phase4ActionError(error); }
}

export async function bulkFlashcardStatusAction(_state: ActionState, data: FormData): Promise<ActionState> {
  try {
    const parsed = flashcardBulkStatusSchema.safeParse({ ids: data.getAll("ids").map(String), status: value(data, "status") });
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Select at least one flashcard." };
    await bulkSetFlashcardStatus(parsed.data.ids, parsed.data.status, await context());
    revalidatePath("/flashcards");
    return { success: `${parsed.data.ids.length} flashcard${parsed.data.ids.length === 1 ? "" : "s"} updated.` };
  } catch (error) { return phase4ActionError(error); }
}

export async function createQuestionAction(_state: ActionState, data: FormData): Promise<ActionState> {
  try {
    const parsed = questionCreateSchema.safeParse(questionInput(data));
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the question fields." };
    const created = await createQuestion(parsed.data, await context());
    revalidatePath(`/questions/${parsed.data.assessmentType.toLowerCase()}`);
    redirect(`/questions/${created.id}`);
  } catch (error) {
    if (isRedirect(error)) throw error;
    return phase4ActionError(error);
  }
}

export async function updateQuestionAction(id: string, _state: ActionState, data: FormData): Promise<ActionState> {
  void _state;
  try {
    const parsed = questionUpdateSchema.safeParse(questionInput(data));
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the question fields." };
    await updateQuestion(id, parsed.data, await context());
    revalidatePath(`/questions/${id}`);
    return { success: "Question saved." };
  } catch (error) { return phase4ActionError(error); }
}

export async function changeQuestionStatusAction(id: string, status: string, _state: ActionState): Promise<ActionState> {
  void _state;
  try {
    if (status === "ARCHIVED") await archiveQuestion(id, await context());
    else {
      const parsed = questionStatusSchema.parse({ status });
      await setQuestionStatus(id, parsed.status, await context());
    }
    revalidatePath("/questions", "layout");
    return { success: `Question ${status.toLowerCase()}.` };
  } catch (error) { return phase4ActionError(error); }
}

export async function changeQuestionActivityAction(id: string, isActive: boolean, _state: ActionState): Promise<ActionState> {
  void _state;
  try {
    const parsed = questionActivitySchema.parse({ isActive });
    await setQuestionActivity(id, parsed.isActive, await context());
    revalidatePath("/questions", "layout");
    return { success: `Question ${isActive ? "activated" : "deactivated"}.` };
  } catch (error) { return phase4ActionError(error); }
}

export async function duplicateQuestionAction(id: string, _state: ActionState): Promise<ActionState> {
  void _state;
  try {
    const created = await duplicateQuestion(id, await context());
    revalidatePath("/questions", "layout");
    redirect(`/questions/${created.id}`);
  } catch (error) {
    if (isRedirect(error)) throw error;
    return phase4ActionError(error);
  }
}

export async function bulkQuestionStatusAction(_state: ActionState, data: FormData): Promise<ActionState> {
  try {
    const parsed = questionBulkStatusSchema.safeParse({ ids: data.getAll("ids").map(String), status: value(data, "status") });
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Select at least one question." };
    await bulkSetQuestionStatus(parsed.data.ids, parsed.data.status, await context());
    revalidatePath("/questions", "layout");
    return { success: `${parsed.data.ids.length} question${parsed.data.ids.length === 1 ? "" : "s"} updated.` };
  } catch (error) { return phase4ActionError(error); }
}
