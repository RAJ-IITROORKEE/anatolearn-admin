import "server-only";

import { mediaUploadSchema } from "./schemas";
import { archiveMedia, uploadMedia } from "./service";

export type DirectUploadContext = {
  actorId: string;
  requestId: string;
  userAgent?: string | null;
  uploadedMediaIds: string[];
};

type MediaField = {
  fileKey: string;
  altText: string;
  existingId?: string | null;
  clear?: boolean;
};

const stringValue = (value: FormDataEntryValue | null) => String(value ?? "").trim();

export async function resolveMediaField(data: FormData, field: MediaField, context: DirectUploadContext) {
  const entry = data.get(field.fileKey);
  if (entry instanceof File && entry.size > 0) {
    const altText = mediaUploadSchema.parse({ altText: field.altText }).altText;
    const uploaded = await uploadMedia(entry, altText, context.actorId, context.requestId);
    context.uploadedMediaIds.push(uploaded.id);
    return uploaded.id;
  }
  if (field.clear) return null;
  return field.existingId || null;
}

export function directUploadContext(actorId: string, requestId: string, userAgent?: string | null): DirectUploadContext {
  return { actorId, requestId, userAgent, uploadedMediaIds: [] };
}

export async function cleanupDirectUploads(context: DirectUploadContext) {
  for (const id of context.uploadedMediaIds) {
    try {
      await archiveMedia(id, context.actorId, context.requestId);
    } catch {
      // The parent mutation is already failing; retaining the asset is safer than masking its error.
    }
  }
}

export function formValue(data: FormData, key: string) {
  return stringValue(data.get(key));
}

export function formNullable(data: FormData, key: string) {
  return formValue(data, key) || null;
}

export function formBoolean(data: FormData, key: string) {
  return data.get(key) === "on";
}

export function formNumber(data: FormData, key: string) {
  return Number(formValue(data, key));
}

export async function resolveMediaFromForm(
  data: FormData,
  context: DirectUploadContext,
  input: { fileKey: string; altTextKey: string; mediaIdKey: string; clearKey: string },
) {
  return resolveMediaField(data, {
    fileKey: input.fileKey,
    altText: formValue(data, input.altTextKey),
    existingId: formNullable(data, input.mediaIdKey),
    clear: formBoolean(data, input.clearKey),
  }, context);
}
