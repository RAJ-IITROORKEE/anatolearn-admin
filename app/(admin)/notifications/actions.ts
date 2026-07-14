"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z, ZodError } from "zod";

import type { NotificationActionState } from "@/components/notifications/campaign-actions";
import { NotificationError } from "@/features/notifications/domain";
import { getProviderConfig } from "@/features/notifications/provider";
import { campaignCreateSchema, uuidSchema } from "@/features/notifications/schemas";
import { cancelCampaign, createCampaignWithIntent, sendCampaign, updateCampaignWithIntent, type CampaignIntent } from "@/features/notifications/service";
import { searchActiveLearnerOptions } from "@/features/users/service";
import { requireAdminPage } from "@/lib/auth/session";

const value = (data: FormData, key: string) => String(data.get(key) ?? "").trim();
const isRedirect = (error: unknown) => (error as { digest?: string }).digest?.startsWith("NEXT_REDIRECT");

function formInput(data: FormData) {
  const audienceType = value(data, "audienceType");
  return {
    type: value(data, "type"),
    title: value(data, "title"),
    message: value(data, "message"),
    target: audienceType === "ALL_ACTIVE_USERS"
      ? { type: "ALL_ACTIVE_USERS" }
      : audienceType === "SELECTED_USERS"
        ? { type: "SELECTED_USERS", userIds: data.getAll("userIds").map(String) }
        : { type: audienceType },
  };
}

function actionError(error: unknown): NotificationActionState {
  if (error instanceof ZodError) return { error: error.issues[0]?.message ?? "Check the campaign fields." };
  if (error instanceof NotificationError) return { error: error.message };
  return { error: "The notification action could not be completed safely." };
}

async function context() {
  const { profile } = await requireAdminPage();
  return { actorId: profile.id, requestId: crypto.randomUUID() };
}

function scheduleTime(data: FormData) {
  const raw = value(data, "scheduledAt");
  const scheduledAt = new Date(raw);
  if (!raw || Number.isNaN(scheduledAt.getTime())) throw new NotificationError("INVALID_SCHEDULE", "Choose a valid schedule time.", 422);
  return scheduledAt;
}

function formIntent(data: FormData): CampaignIntent | null {
  const intent = value(data, "intent");
  if (intent === "draft") return { type: "DRAFT" };
  if (intent === "schedule") return { type: "SCHEDULE", scheduledAt: scheduleTime(data) };
  if (intent === "send") return { type: "SEND", providerReady: getProviderConfig().ready };
  return null;
}

export async function createCampaignAction(_state: NotificationActionState, data: FormData): Promise<NotificationActionState> {
  try {
    const input = campaignCreateSchema.parse(formInput(data));
    const intent = formIntent(data);
    if (!intent) return { error: "Choose a valid campaign action." };
    const actionContext = await context();
    const created = await createCampaignWithIntent(input, intent, actionContext);
    revalidatePath("/notifications");
    redirect(`/notifications/${created.id}`);
  } catch (error) {
    if (isRedirect(error)) throw error;
    return actionError(error);
  }
  return { success: "Campaign created." };
}

export async function updateCampaignAction(id: string, _state: NotificationActionState, data: FormData): Promise<NotificationActionState> {
  const parsedId = uuidSchema.safeParse(id);
  if (!parsedId.success) return { error: "Notification campaign was not found." };
  try {
    const input = campaignCreateSchema.parse(formInput(data));
    const intent = formIntent(data);
    if (!intent) return { error: "Choose a valid campaign action." };
    const actionContext = await context();
    await updateCampaignWithIntent(parsedId.data, input, intent, actionContext);
    revalidatePath("/notifications", "layout");
    redirect(`/notifications/${parsedId.data}`);
  } catch (error) {
    if (isRedirect(error)) throw error;
    return actionError(error);
  }
  return { success: "Campaign updated." };
}

export async function searchNotificationLearnersAction(query: string, page: number) {
  await requireAdminPage();
  const input = z.object({ query: z.string().trim().max(200), page: z.number().int().min(1).max(100_000) }).strict().parse({ query, page });
  return searchActiveLearnerOptions({ q: input.query, page: input.page });
}

export async function sendCampaignAction(id: string, _state: NotificationActionState): Promise<NotificationActionState> {
  void _state;
  const parsed = uuidSchema.safeParse(id);
  if (!parsed.success) return { error: "Notification campaign was not found." };
  try {
    const actionContext = await context();
    const provider = getProviderConfig();
    if (!provider.ready) return { error: "The delivery provider is not ready. This campaign was not queued." };
    await sendCampaign(parsed.data, actionContext, provider.ready);
    revalidatePath("/notifications", "layout");
    return { success: "Campaign queued for provider processing. Delivery is not yet confirmed." };
  } catch (error) { return actionError(error); }
}

export async function cancelCampaignAction(id: string, _state: NotificationActionState): Promise<NotificationActionState> {
  void _state;
  const parsed = uuidSchema.safeParse(id);
  if (!parsed.success) return { error: "Notification campaign was not found." };
  try {
    await cancelCampaign(parsed.data, await context());
    revalidatePath("/notifications", "layout");
    return { success: "Campaign cancelled." };
  } catch (error) { return actionError(error); }
}
