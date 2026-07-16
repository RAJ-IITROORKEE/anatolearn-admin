"use server";

import { revalidatePath } from "next/cache";

import type { ActionState } from "@/components/phase3/action-form";
import { bulkSetFlashcardStatus, createFlashcard, setFlashcardStatus, updateFlashcard } from "@/features/flashcards/service";
import { flashcardBulkStatusSchema, flashcardCreateSchema, flashcardStatusUpdateSchema, flashcardUpdateSchema } from "@/features/flashcards/schemas";
import { archiveQuestion, bulkSetQuestionStatus, createQuestion, duplicateQuestion, setQuestionActivity, setQuestionStatus, updateQuestion } from "@/features/questions/service";
import { questionActivitySchema, questionBulkStatusSchema, questionCreateSchema, questionStatusSchema, questionUpdateSchema } from "@/features/questions/schemas";
import { requireAdminPage } from "@/lib/auth/session";
import { phase4ActionError } from "./phase4-action-errors";
import { moveToTrash } from "@/features/trash/service";
import { cleanupDirectUploads, directUploadContext, formBoolean, formNullable, formValue, resolveMediaField } from "@/features/media/direct-upload";

const context = async () => {
  const { profile } = await requireAdminPage();
  return { actorId: profile.id, requestId: crypto.randomUUID() };
};

async function flashcardInput(data: FormData, ctx: ReturnType<typeof directUploadContext>) {
  return {
    topicId: formValue(data, "topicId"),
    frontText: formValue(data, "frontText"),
    backText: formValue(data, "backText"),
    frontMediaId: await resolveMediaField(data, { fileKey: "frontFile", altText: formValue(data, "frontAltText"), existingId: formNullable(data, "frontMediaId"), clear: formBoolean(data, "clearFront") }, ctx),
    backMediaId: await resolveMediaField(data, { fileKey: "backFile", altText: formValue(data, "backAltText"), existingId: formNullable(data, "backMediaId"), clear: formBoolean(data, "clearBack") }, ctx),
    difficulty: formValue(data, "difficulty"),
    notes: formNullable(data, "notes"),
    displayOrder: Number(formValue(data, "displayOrder")),
  };
}

async function questionInput(data: FormData, ctx: ReturnType<typeof directUploadContext>) {
  const count = Number(formValue(data, "optionCount"));
  const correct = Number(formValue(data, "correctOption"));
  return {
    topicId: formValue(data, "topicId"),
    assessmentType: formValue(data, "assessmentType"),
    questionText: formValue(data, "questionText"),
    mediaId: await resolveMediaField(data, { fileKey: "questionFile", altText: formValue(data, "questionAltText"), existingId: formNullable(data, "mediaId"), clear: formBoolean(data, "clearQuestionImage") }, ctx),
    explanation: formValue(data, "explanation"),
    difficulty: formValue(data, "difficulty"),
    conceptTag: formNullable(data, "conceptTag"),
    options: Number.isInteger(count) && count >= 0 ? await Promise.all(Array.from({ length: count }, async (_, index) => ({
      ...(formValue(data, `optionId.${index}`) ? { id: formValue(data, `optionId.${index}`) } : {}),
      optionText: formValue(data, `optionText.${index}`),
      mediaId: await resolveMediaField(data, { fileKey: `optionFile.${index}`, altText: formValue(data, `optionAltText.${index}`), existingId: formNullable(data, `optionMediaId.${index}`), clear: formBoolean(data, `clearOption.${index}`) }, ctx),
      isCorrect: index === correct,
    }))) : [],
  };
}

export async function createFlashcardAction(_state: ActionState, data: FormData): Promise<ActionState> {
  let uploadContext;
  try {
    const ctx = await context(); uploadContext = directUploadContext(ctx.actorId, ctx.requestId); const parsed = flashcardCreateSchema.safeParse(await flashcardInput(data, uploadContext));
    if (!parsed.success) { await cleanupDirectUploads(uploadContext); return { error: parsed.error.issues[0]?.message ?? "Check the flashcard fields." }; }
    const created = await createFlashcard(parsed.data, ctx);
    revalidatePath("/flashcards");
    return { success: "Flashcard created.", redirectTo: `/flashcards/${created.id}` };
  } catch (error) {
    if (uploadContext) await cleanupDirectUploads(uploadContext); return phase4ActionError(error, { requestId: uploadContext?.requestId, route: "/admin/flashcards/create" });
  }
}

export async function updateFlashcardAction(id: string, _state: ActionState, data: FormData): Promise<ActionState> {
  void _state;
  let uploadContext;
  try {
    const ctx = await context(); uploadContext = directUploadContext(ctx.actorId, ctx.requestId); const parsed = flashcardUpdateSchema.safeParse(await flashcardInput(data, uploadContext));
    if (!parsed.success) { await cleanupDirectUploads(uploadContext); return { error: parsed.error.issues[0]?.message ?? "Check the flashcard fields." }; }
    await updateFlashcard(id, parsed.data, ctx);
    revalidatePath(`/flashcards/${id}`);
    return { success: "Flashcard saved." };
  } catch (error) { if (uploadContext) await cleanupDirectUploads(uploadContext); return phase4ActionError(error, { requestId: uploadContext?.requestId, route: "/admin/flashcards/update" }); }
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
    const parsed = flashcardBulkStatusSchema.safeParse({ ids: data.getAll("ids").map(String), status: formValue(data, "status") });
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Select at least one flashcard." };
    await bulkSetFlashcardStatus(parsed.data.ids, parsed.data.status, await context());
    revalidatePath("/flashcards");
    return { success: `${parsed.data.ids.length} flashcard${parsed.data.ids.length === 1 ? "" : "s"} updated.` };
  } catch (error) { return phase4ActionError(error); }
}

export async function createQuestionAction(_state: ActionState, data: FormData): Promise<ActionState> {
  let uploadContext;
  try {
    const ctx = await context(); uploadContext = directUploadContext(ctx.actorId, ctx.requestId); const parsed = questionCreateSchema.safeParse(await questionInput(data, uploadContext));
    if (!parsed.success) { await cleanupDirectUploads(uploadContext); return { error: parsed.error.issues[0]?.message ?? "Check the question fields." }; }
    const created = await createQuestion(parsed.data, ctx);
    revalidatePath(`/questions/${parsed.data.assessmentType.toLowerCase()}`);
    return { success: "Question created.", redirectTo: `/questions/${created.id}` };
  } catch (error) {
    if (uploadContext) await cleanupDirectUploads(uploadContext); return phase4ActionError(error, { requestId: uploadContext?.requestId, route: "/admin/questions/create" });
  }
}

export async function updateQuestionAction(id: string, _state: ActionState, data: FormData): Promise<ActionState> {
  void _state;
  let uploadContext;
  try {
    const ctx = await context(); uploadContext = directUploadContext(ctx.actorId, ctx.requestId); const parsed = questionUpdateSchema.safeParse(await questionInput(data, uploadContext));
    if (!parsed.success) { await cleanupDirectUploads(uploadContext); return { error: parsed.error.issues[0]?.message ?? "Check the question fields." }; }
    await updateQuestion(id, parsed.data, ctx);
    revalidatePath(`/questions/${id}`);
    return { success: "Question saved." };
  } catch (error) { if (uploadContext) await cleanupDirectUploads(uploadContext); return phase4ActionError(error, { requestId: uploadContext?.requestId, route: "/admin/questions/update" }); }
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

export async function trashFlashcardAction(id: string, _state: ActionState): Promise<ActionState> {
  void _state;
  try { await moveToTrash("flashcard", id, await context()); revalidatePath("/flashcards"); return { success: "Moved to Trash." }; } catch (error) { return phase4ActionError(error); }
}

export async function trashQuestionAction(id: string, _state: ActionState): Promise<ActionState> {
  void _state;
  try { await moveToTrash("question", id, await context()); revalidatePath("/questions", "layout"); return { success: "Moved to Trash." }; } catch (error) { return phase4ActionError(error); }
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
    return { success: "Question duplicated.", redirectTo: `/questions/${created.id}` };
  } catch (error) {
    return phase4ActionError(error);
  }
}

export async function bulkQuestionStatusAction(_state: ActionState, data: FormData): Promise<ActionState> {
  try {
    const parsed = questionBulkStatusSchema.safeParse({ ids: data.getAll("ids").map(String), status: formValue(data, "status") });
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Select at least one question." };
    await bulkSetQuestionStatus(parsed.data.ids, parsed.data.status, await context());
    revalidatePath("/questions", "layout");
    return { success: `${parsed.data.ids.length} question${parsed.data.ids.length === 1 ? "" : "s"} updated.` };
  } catch (error) { return phase4ActionError(error); }
}
