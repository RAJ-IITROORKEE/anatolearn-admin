import { z } from "zod";

const page = z.coerce.number().int().min(1).default(1);
const pageSize = z.coerce.number().int().min(1).max(100).default(20);
const optionalBoolean = z.enum(["true", "false"]).transform((value) => value === "true").optional();

export const mediaListSchema = z.object({
  page, pageSize,
  search: z.string().trim().max(200).optional(),
  mimeType: z.enum(["image/png", "image/jpeg", "image/webp"]).optional(),
  archived: optionalBoolean,
  uploadedById: z.uuid().optional(),
});

export const mediaUpdateSchema = z.object({ altText: z.string().trim().min(1).max(500).optional() })
  .refine((value) => Object.keys(value).length > 0, "At least one field is required.");

export const mediaUploadSchema = z.object({ altText: z.string().trim().min(1).max(500) });
export const mediaIdSchema = z.uuid();

export function buildMediaPath(actorId: string, assetId: string, mimeType: string) {
  const extension = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
  return `media/${actorId}/${assetId}.${extension}`;
}
