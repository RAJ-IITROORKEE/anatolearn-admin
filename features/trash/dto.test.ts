import { describe, expect, it } from "vitest";

import { trashItemDto } from "./dto";

describe("trash DTO", () => {
  it("returns a safe heterogeneous item without media storage coordinates", () => {
    const purgeAfter = new Date("2026-08-13T12:00:00.000Z");
    const dto = trashItemDto({
      id: crypto.randomUUID(),
      type: "media-asset",
      label: "heart.png",
      trashedAt: new Date("2026-07-14T12:00:00.000Z"),
      purgeAfter,
      nextPurgeAttemptAt: purgeAfter,
      blockerReason: null,
      blockerCount: 0,
    }, new Date("2026-07-15T12:00:00.000Z"));

    expect(dto).toMatchObject({
      type: "media-asset",
      displayLabel: "heart.png",
      retentionState: "RESTORABLE",
      eligibility: "PENDING",
      blocker: null,
    });
    expect(dto).not.toHaveProperty("bucket");
    expect(dto).not.toHaveProperty("path");
  });
});
