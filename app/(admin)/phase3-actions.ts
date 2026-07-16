"use server";

import { revalidatePath } from "next/cache";
import { requireAdminPage } from "@/lib/auth/session";
import { createContent, setStatus, updateContent } from "@/features/content/service";
import { contentBlocksSchema, contentLessonCreateSchema, contentLessonUpdateSchema, organSystemCreateSchema, organSystemUpdateSchema, statusUpdateSchema, topicCreateSchema, topicUpdateSchema } from "@/features/content/schemas";
import { archiveMedia, updateMedia, uploadMedia } from "@/features/media/service";
import { mediaUpdateSchema, mediaUploadSchema } from "@/features/media/schemas";
import { cleanupDirectUploads, directUploadContext, formBoolean, formNullable, formValue, resolveMediaField } from "@/features/media/direct-upload";
import type { ActionState } from "@/components/phase3/action-form";
import { phase3ActionError } from "./phase3-action-errors";
import { moveToTrash, restoreFromTrash } from "@/features/trash/service";

type Resource = "organSystem" | "topic" | "contentLesson";
const context = async () => { const { profile } = await requireAdminPage(); return { actorId: profile.id, requestId: crypto.randomUUID() }; };

async function contentInput(resource: Resource, data: FormData, ctx: ReturnType<typeof directUploadContext>) {
  if (resource === "organSystem") return { name: formValue(data, "name"), slug: formValue(data, "slug") || undefined, shortDescription: formValue(data, "shortDescription"), longDescription: formNullable(data, "longDescription"), coverMediaId: await resolveMediaField(data, { fileKey: "coverFile", altText: formValue(data, "coverAltText"), existingId: formNullable(data, "coverMediaId"), clear: formBoolean(data, "clearCover") }, ctx), iconMediaId: await resolveMediaField(data, { fileKey: "iconFile", altText: formValue(data, "iconAltText"), existingId: formNullable(data, "iconMediaId"), clear: formBoolean(data, "clearIcon") }, ctx), displayOrder: Number(formValue(data, "displayOrder")), isActive: formBoolean(data, "isActive") };
  if (resource === "topic") return { organSystemId: formValue(data, "organSystemId"), title: formValue(data, "title"), slug: formValue(data, "slug"), summary: formNullable(data, "summary"), coverMediaId: await resolveMediaField(data, { fileKey: "coverFile", altText: formValue(data, "coverAltText"), existingId: formNullable(data, "coverMediaId"), clear: formBoolean(data, "clearCover") }, ctx), displayOrder: Number(formValue(data, "displayOrder")) };
  let blocks: unknown;
  try { blocks = JSON.parse(formValue(data, "contentBlocks")); } catch { throw new Error("Lesson blocks must be valid JSON."); }
  if (Array.isArray(blocks)) {
    blocks = await Promise.all(blocks.map(async (block) => {
      if (!block || typeof block !== "object" || (block as { type?: unknown }).type !== "image") return block;
      const image = block as { id?: unknown; mediaId?: unknown; altText?: unknown };
      const blockId = String(image.id ?? "");
      return { ...image, mediaId: await resolveMediaField(data, { fileKey: `lessonFile.${blockId}`, altText: formValue(data, `lessonAltText.${blockId}`) || String(image.altText ?? ""), existingId: typeof image.mediaId === "string" ? image.mediaId : null, clear: formBoolean(data, `lessonClear.${blockId}`) }, ctx) };
    }));
  }
  const checkedBlocks = contentBlocksSchema.safeParse(blocks);
  if (!checkedBlocks.success) throw new Error(checkedBlocks.error.issues[0]?.message ?? "Lesson blocks are invalid.");
  return { topicId: formValue(data, "topicId"), title: formValue(data, "title"), slug: formValue(data, "slug"), summary: formNullable(data, "summary"), contentBlocks: checkedBlocks.data, estimatedReadingMinutes: Number(formValue(data, "estimatedReadingMinutes")), displayOrder: Number(formValue(data, "displayOrder")) };
}

export async function createResource(resource: Resource, _state: ActionState, data: FormData): Promise<ActionState> {
  let uploadContext;
  try {
    const ctx = await context(); uploadContext = directUploadContext(ctx.actorId, ctx.requestId); const raw = await contentInput(resource, data, uploadContext);
    const schema = resource === "organSystem" ? organSystemCreateSchema : resource === "topic" ? topicCreateSchema : contentLessonCreateSchema;
    const parsed = schema.safeParse(raw);
    if (!parsed.success) { await cleanupDirectUploads(uploadContext); return { error: parsed.error.issues[0]?.message ?? "Check the form fields." }; }
    const created = await createContent(resource, parsed.data, ctx);
    revalidatePath(resource === "organSystem" ? "/organ-systems" : resource === "topic" ? "/topics" : "/content");
    return { success: `${resource === "organSystem" ? "Organ system" : resource === "topic" ? "Topic" : "Lesson"} created.`, redirectTo: resource === "organSystem" ? `/organ-systems/${created.slug}` : resource === "topic" ? `/topics/${created.id}` : `/content/${created.id}` };
  } catch (error) { if (uploadContext) await cleanupDirectUploads(uploadContext); return phase3ActionError(error, { requestId: uploadContext?.requestId, route: `/admin/${resource}/create` }); }
}

export async function updateResource(resource: Resource, id: string, _state: ActionState, data: FormData): Promise<ActionState> {
  let uploadContext;
  try {
    const ctx = await context(); uploadContext = directUploadContext(ctx.actorId, ctx.requestId); const raw = await contentInput(resource, data, uploadContext);
    const schema = resource === "organSystem" ? organSystemUpdateSchema : resource === "topic" ? topicUpdateSchema : contentLessonUpdateSchema;
    const parsed = schema.safeParse(raw);
    if (!parsed.success) { await cleanupDirectUploads(uploadContext); return { error: parsed.error.issues[0]?.message ?? "Check the form fields." }; }
    const updated = await updateContent(resource, id, parsed.data, ctx);
    revalidatePath(resource === "organSystem" ? `/organ-systems/${updated.slug}` : resource === "topic" ? `/topics/${id}` : `/content/${id}`);
    return { success: "Changes saved.", ...(resource === "organSystem" ? { redirectTo: `/organ-systems/${updated.slug}` } : {}) };
  } catch (error) { if (uploadContext) await cleanupDirectUploads(uploadContext); return phase3ActionError(error, { requestId: uploadContext?.requestId, route: `/admin/${resource}/update` }); }
}

export async function changeResourceStatus(resource: Resource, id: string, status: string, _state: ActionState): Promise<ActionState> {
  void _state;
  try { const parsed = statusUpdateSchema.parse({ status }); await setStatus(resource, id, parsed.status, await context()); revalidatePath("/", "layout"); return { success: `Status changed to ${status.toLowerCase()}.` }; } catch (error) { return phase3ActionError(error); }
}

export async function uploadMediaAction(_state: ActionState, data: FormData): Promise<ActionState> {
  let requestId = "unknown";
  try { const parsed = mediaUploadSchema.safeParse({ altText: formValue(data, "altText") }); const file = data.get("file"); if (!parsed.success) return { error: parsed.error.issues[0]?.message }; if (!(file instanceof File) || !file.size) return { error: "Choose an image to upload." }; const ctx = await context(); requestId = ctx.requestId; await uploadMedia(file, parsed.data.altText, ctx.actorId, ctx.requestId); revalidatePath("/media"); return { success: "Image uploaded." }; } catch (error) { return phase3ActionError(error, { requestId, route: "/admin/media/upload" }); }
}

export async function updateMediaAction(id: string, _state: ActionState, data: FormData): Promise<ActionState> {
  let requestId = "unknown";
  try { const parsed = mediaUpdateSchema.safeParse({ altText: formValue(data, "altText") }); if (!parsed.success) return { error: parsed.error.issues[0]?.message }; const ctx = await context(); requestId = ctx.requestId; await updateMedia(id, parsed.data.altText!, ctx.actorId, ctx.requestId); revalidatePath("/media"); return { success: "Alt text updated." }; } catch (error) { return phase3ActionError(error, { requestId, route: "/admin/media/update" }); }
}

export async function archiveMediaAction(id: string, _state: ActionState): Promise<ActionState> {
  void _state;
  try { const ctx = await context(); await archiveMedia(id, ctx.actorId, ctx.requestId); revalidatePath("/media"); return { success: "Media archived." }; } catch (error) { return phase3ActionError(error); }
}

export async function trashMediaAction(id: string, _state: ActionState): Promise<ActionState> {
  void _state;
  try { const ctx = await context(); await moveToTrash("media-asset", id, ctx); revalidatePath("/media"); revalidatePath("/settings/trash"); return { success: "Moved to Trash." }; } catch (error) { return phase3ActionError(error); }
}

export async function trashResourceAction(type: "organ-system" | "topic" | "content-lesson" | "media-asset", id: string, _state: ActionState): Promise<ActionState> {
  void _state;
  try { const ctx = await context(); await moveToTrash(type, id, ctx); revalidatePath("/"); return { success: "Moved to Trash." }; } catch (error) { return phase3ActionError(error); }
}

export async function restoreTrashAction(type: "organ-system" | "topic" | "content-lesson" | "flashcard" | "question" | "media-asset", id: string, _state: ActionState): Promise<ActionState> {
  void _state;
  try { const ctx = await context(); await restoreFromTrash(type, id, ctx); revalidatePath("/"); revalidatePath("/settings/trash"); return { success: "Restored successfully." }; } catch (error) { return phase3ActionError(error); }
}
