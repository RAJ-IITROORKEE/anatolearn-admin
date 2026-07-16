import { describe, expect, it } from "vitest";

import { auditLogListSchema } from "@/features/audit/schemas";
import { buildMediaPath, mediaListSchema, mediaUpdateSchema, mediaUploadSchema } from "./schemas";

describe("media schemas", () => {
  it("normalizes bounded list filters", () => {
    expect(mediaListSchema.parse({ page: "2", pageSize: "100", archived: "false", mimeType: "image/png" })).toMatchObject({ page: 2, pageSize: 100, archived: false });
    expect(mediaListSchema.safeParse({ pageSize: "101" }).success).toBe(false);
  });

  it("requires a meaningful update", () => {
    expect(mediaUpdateSchema.safeParse({}).success).toBe(false);
    expect(mediaUpdateSchema.parse({ altText: "  Labeled heart  " })).toEqual({ altText: "Labeled heart" });
  });

  it("allows upload alt text to be omitted or blank", () => {
    expect(mediaUploadSchema.parse({})).toEqual({ altText: "" });
    expect(mediaUploadSchema.parse({ altText: "   " })).toEqual({ altText: "" });
  });

  it("builds paths without using the client filename", () => {
    expect(buildMediaPath("admin-id", "asset-id", "image/jpeg")).toBe("media/admin-id/asset-id.jpg");
  });
});

describe("audit list schema", () => {
  it("supports pagination, action, entity, actor, and date filters", () => {
    const result = auditLogListSchema.parse({ page: "3", action: "UPDATE", entityType: "MediaAsset", actorId: "550e8400-e29b-41d4-a716-446655440000", from: "2026-01-01T00:00:00.000Z" });
    expect(result).toMatchObject({ page: 3, action: "UPDATE", entityType: "MediaAsset" });
  });
});
