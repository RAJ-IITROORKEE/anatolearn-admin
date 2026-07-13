import { describe, expect, it } from "vitest";

import { mediaDto } from "./dto";

describe("mediaDto", () => {
  it("serializes byteSize as a decimal string", () => {
    const now = new Date("2026-07-13T00:00:00.000Z");
    const dto = mediaDto({
      id: "asset-id",
      originalFilename: "heart.png",
      mimeType: "image/png",
      byteSize: BigInt("9007199254740993"),
      width: 100,
      height: 80,
      altText: "Heart",
      archivedAt: null,
      uploadedById: "user-id",
      createdAt: now,
      updatedAt: now,
    }, "https://signed.example/image", 300);

    expect(dto.byteSize).toBe("9007199254740993");
    expect(() => JSON.stringify(dto)).not.toThrow();
  });

  it("represents an unavailable admin preview without losing metadata", () => {
    const now = new Date("2026-07-13T00:00:00.000Z");
    const dto = mediaDto({
      id: "asset-id",
      originalFilename: "heart.png",
      mimeType: "image/png",
      byteSize: BigInt(10),
      width: 100,
      height: 80,
      altText: "Heart",
      archivedAt: null,
      uploadedById: "user-id",
      createdAt: now,
      updatedAt: now,
    }, null, null);

    expect(dto).toMatchObject({ signedUrl: null, signedUrlExpiresIn: null });
  });
});
