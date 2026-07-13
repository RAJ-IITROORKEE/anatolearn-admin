"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminPage } from "@/lib/auth/session";
import { createContent, setStatus, updateContent } from "@/features/content/service";
import { contentBlocksSchema, contentLessonCreateSchema, contentLessonUpdateSchema, organSystemCreateSchema, organSystemUpdateSchema, statusUpdateSchema, topicCreateSchema, topicUpdateSchema } from "@/features/content/schemas";
import { archiveMedia, updateMedia, uploadMedia } from "@/features/media/service";
import { mediaUpdateSchema, mediaUploadSchema } from "@/features/media/schemas";
import type { ActionState } from "@/components/phase3/action-form";
import { phase3ActionError } from "./phase3-action-errors";

type Resource = "organSystem" | "topic" | "contentLesson";
const value = (data: FormData, key: string) => String(data.get(key) ?? "").trim();
const nullable = (data: FormData, key: string) => value(data, key) || null;
const context = async () => { const { profile } = await requireAdminPage(); return { actorId: profile.id, requestId: crypto.randomUUID() }; };

function contentInput(resource: Resource, data: FormData) {
  if (resource === "organSystem") return { name: value(data, "name"), slug: value(data, "slug"), shortDescription: value(data, "shortDescription"), longDescription: nullable(data, "longDescription"), coverMediaId: nullable(data, "coverMediaId"), iconMediaId: nullable(data, "iconMediaId"), displayOrder: Number(value(data, "displayOrder")), isActive: data.get("isActive") === "on" };
  if (resource === "topic") return { organSystemId: value(data, "organSystemId"), title: value(data, "title"), slug: value(data, "slug"), summary: nullable(data, "summary"), coverMediaId: nullable(data, "coverMediaId"), displayOrder: Number(value(data, "displayOrder")) };
  let blocks: unknown;
  try { blocks = JSON.parse(value(data, "contentBlocks")); } catch { throw new Error("Lesson blocks must be valid JSON."); }
  const checkedBlocks = contentBlocksSchema.safeParse(blocks);
  if (!checkedBlocks.success) throw new Error(checkedBlocks.error.issues[0]?.message ?? "Lesson blocks are invalid.");
  return { topicId: value(data, "topicId"), title: value(data, "title"), slug: value(data, "slug"), summary: nullable(data, "summary"), contentBlocks: checkedBlocks.data, estimatedReadingMinutes: Number(value(data, "estimatedReadingMinutes")), displayOrder: Number(value(data, "displayOrder")) };
}

export async function createResource(resource: Resource, _state: ActionState, data: FormData): Promise<ActionState> {
  try {
    const raw = contentInput(resource, data);
    const schema = resource === "organSystem" ? organSystemCreateSchema : resource === "topic" ? topicCreateSchema : contentLessonCreateSchema;
    const parsed = schema.safeParse(raw);
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form fields." };
    const created = await createContent(resource, parsed.data, await context());
    revalidatePath(resource === "organSystem" ? "/organ-systems" : resource === "topic" ? "/topics" : "/content");
    redirect(resource === "organSystem" ? `/organ-systems/${created.id}` : resource === "topic" ? `/topics/${created.id}` : `/content/${created.id}`);
  } catch (error) { if ((error as { digest?: string }).digest?.startsWith("NEXT_REDIRECT")) throw error; return phase3ActionError(error); }
}

export async function updateResource(resource: Resource, id: string, _state: ActionState, data: FormData): Promise<ActionState> {
  try {
    const raw = contentInput(resource, data);
    const schema = resource === "organSystem" ? organSystemUpdateSchema : resource === "topic" ? topicUpdateSchema : contentLessonUpdateSchema;
    const parsed = schema.safeParse(raw);
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form fields." };
    await updateContent(resource, id, parsed.data, await context());
    revalidatePath(resource === "organSystem" ? `/organ-systems/${id}` : resource === "topic" ? `/topics/${id}` : `/content/${id}`);
    return { success: "Changes saved." };
  } catch (error) { return phase3ActionError(error); }
}

export async function changeResourceStatus(resource: Resource, id: string, status: string, _state: ActionState): Promise<ActionState> {
  void _state;
  try { const parsed = statusUpdateSchema.parse({ status }); await setStatus(resource, id, parsed.status, await context()); revalidatePath("/", "layout"); return { success: `Status changed to ${status.toLowerCase()}.` }; } catch (error) { return phase3ActionError(error); }
}

export async function uploadMediaAction(_state: ActionState, data: FormData): Promise<ActionState> {
  try { const parsed = mediaUploadSchema.safeParse({ altText: value(data, "altText") }); const file = data.get("file"); if (!parsed.success) return { error: parsed.error.issues[0]?.message }; if (!(file instanceof File) || !file.size) return { error: "Choose an image to upload." }; const ctx = await context(); await uploadMedia(file, parsed.data.altText, ctx.actorId, ctx.requestId); revalidatePath("/media"); return { success: "Image uploaded." }; } catch (error) { return phase3ActionError(error); }
}

export async function updateMediaAction(id: string, _state: ActionState, data: FormData): Promise<ActionState> {
  try { const parsed = mediaUpdateSchema.safeParse({ altText: value(data, "altText") }); if (!parsed.success) return { error: parsed.error.issues[0]?.message }; const ctx = await context(); await updateMedia(id, parsed.data.altText!, ctx.actorId, ctx.requestId); revalidatePath("/media"); return { success: "Alt text updated." }; } catch (error) { return phase3ActionError(error); }
}

export async function archiveMediaAction(id: string, _state: ActionState): Promise<ActionState> {
  void _state;
  try { const ctx = await context(); await archiveMedia(id, ctx.actorId, ctx.requestId); revalidatePath("/media"); return { success: "Media archived." }; } catch (error) { return phase3ActionError(error); }
}
