import "server-only";

import type { DirectUploadContext } from "@/features/media/direct-upload";
import { formBoolean, formValue, resolveMediaField } from "@/features/media/direct-upload";
import {
  contentBlocksSchema,
  richContentToLegacyBlocks,
  richLessonContentSchema,
  richTextDocumentSchema,
  richTextDraftDocumentSchema,
  validateRichDraftFallback,
  type RichTextNode,
} from "./schemas";

async function resolveRichLessonImages(document: unknown, data: FormData, context: DirectUploadContext) {
  const draft = richTextDraftDocumentSchema.parse(document);
  validateRichDraftFallback(draft);
  const resolvedContent: RichTextNode[] = [];

  for (const node of draft.content) {
    if (node.type !== "image") {
      resolvedContent.push(node);
      continue;
    }

    const attrs: Record<string, unknown> = node.attrs ?? {};
    const uploadId = typeof attrs.uploadId === "string" ? attrs.uploadId : null;
    const existingId = typeof attrs.mediaId === "string" ? attrs.mediaId : null;
    const fieldId = uploadId ?? (typeof attrs.legacyId === "string" ? attrs.legacyId : existingId ?? "");
    const mediaId = await resolveMediaField(data, {
      fileKey: `lessonFile.${fieldId}`,
      altText: typeof attrs.alt === "string" ? attrs.alt : "",
      existingId,
    }, context);
    if (!mediaId) throw new Error("Choose an image for each managed image node.");

    resolvedContent.push({
      type: "image",
      attrs: {
        mediaId,
        alt: typeof attrs.alt === "string" ? attrs.alt : "",
        caption: typeof attrs.caption === "string" ? attrs.caption : null,
        ...(typeof attrs.legacyId === "string" ? { legacyId: attrs.legacyId } : {}),
      },
    });
  }

  return richTextDocumentSchema.parse({ ...draft, content: resolvedContent });
}

export async function resolveLessonContentFromForm(data: FormData, context: DirectUploadContext) {
  let content: unknown;
  try {
    content = JSON.parse(formValue(data, "contentBlocks"));
  } catch {
    throw new Error("Lesson blocks must be valid JSON.");
  }

  if (Array.isArray(content)) {
    const resolvedBlocks: unknown[] = [];
    for (const block of content) {
      if (!block || typeof block !== "object" || (block as { type?: unknown }).type !== "image") {
        resolvedBlocks.push(block);
        continue;
      }
      const image = block as { id?: unknown; mediaId?: unknown; altText?: unknown };
      const blockId = String(image.id ?? "");
      resolvedBlocks.push({
        ...image,
        mediaId: await resolveMediaField(data, {
          fileKey: `lessonFile.${blockId}`,
          altText: formValue(data, `lessonAltText.${blockId}`) || String(image.altText ?? ""),
          existingId: typeof image.mediaId === "string" ? image.mediaId : null,
          clear: formBoolean(data, `lessonClear.${blockId}`),
        }, context),
      });
    }
    return contentBlocksSchema.parse(resolvedBlocks);
  }

  if (content && typeof content === "object" && (content as { version?: unknown }).version === 2) {
    const richContent = await resolveRichLessonImages(
      (content as { richContent?: unknown }).richContent,
      data,
      context,
    );
    return richLessonContentSchema.parse({
      version: 2,
      richContent,
      fallbackBlocks: richContentToLegacyBlocks(richContent),
    });
  }

  return richLessonContentSchema.parse(content);
}
