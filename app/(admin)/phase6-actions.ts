"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";

import type { ActionState } from "@/components/phase3/action-form";
import { FeedbackError } from "@/features/feedback/domain";
import { adminFeedbackUpdateSchema, feedbackIdSchema } from "@/features/feedback/schemas";
import { updateFeedback } from "@/features/feedback/service";
import { UserManagementError } from "@/features/users/domain";
import { updateUserActivitySchema, userIdSchema } from "@/features/users/schemas";
import { setLearnerActivity } from "@/features/users/service";
import { requireAdminPage } from "@/lib/auth/session";

async function mutationContext() {
  const { profile } = await requireAdminPage();
  return { actorId: profile.id, requestId: crypto.randomUUID() };
}

function safeActionError(error: unknown): ActionState {
  if ((error as { digest?: string }).digest?.startsWith("NEXT_REDIRECT")) throw error;
  if (error instanceof ZodError) return { error: error.issues[0]?.message ?? "Check the submitted values." };
  if (error instanceof FeedbackError || error instanceof UserManagementError) return { error: error.message };
  return { error: "The change could not be saved. Please try again." };
}

export async function changeUserActivityAction(id: string, isActive: boolean, _state: ActionState): Promise<ActionState> {
  void _state;
  try {
    const validId = userIdSchema.parse(id);
    const input = updateUserActivitySchema.parse({ isActive });
    await setLearnerActivity(validId, input.isActive, await mutationContext());
    revalidatePath("/users", "layout");
    return { success: `User ${input.isActive ? "activated" : "deactivated"}.` };
  } catch (error) { return safeActionError(error); }
}

export async function updateFeedbackNotesAction(id: string, _state: ActionState, data: FormData): Promise<ActionState> {
  void _state;
  try {
    const validId = feedbackIdSchema.parse(id);
    const value = String(data.get("adminNotes") ?? "").trim();
    const input = adminFeedbackUpdateSchema.parse({ adminNotes: value || null });
    await updateFeedback(validId, input, await mutationContext());
    revalidatePath(`/feedback/${validId}`);
    revalidatePath("/feedback");
    return { success: "Admin notes saved." };
  } catch (error) { return safeActionError(error); }
}

export async function changeFeedbackStatusAction(id: string, status: string, _state: ActionState): Promise<ActionState> {
  void _state;
  try {
    const validId = feedbackIdSchema.parse(id);
    const input = adminFeedbackUpdateSchema.parse({ status });
    await updateFeedback(validId, input, await mutationContext());
    revalidatePath("/feedback", "layout");
    return { success: `Feedback marked ${input.status?.toLowerCase()}.` };
  } catch (error) { return safeActionError(error); }
}
