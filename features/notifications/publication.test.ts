import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  create: vi.fn(),
  createMany: vi.fn(),
  executeRaw: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: {} }));

import { createPublicationNotification } from "./publication";

describe("publication notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findMany.mockResolvedValue([]);
    mocks.create.mockResolvedValue({ id: "campaign-id", status: "SENT" });
    mocks.executeRaw.mockResolvedValue(2);
  });

  it("creates an immediately available in-app announcement for active learners", async () => {
    const tx = {
      notificationPublicationSource: { findMany: mocks.findMany, createMany: mocks.createMany },
      notificationCampaign: { create: mocks.create },
      $executeRaw: mocks.executeRaw,
    };

    await createPublicationNotification(tx as never, {
      actorId: "admin-id",
      publicationSources: [{ type: "CONTENT_LESSON", id: "10000000-0000-4000-8000-000000000001" }],
      title: "New lesson available",
      message: "A new lesson was added to Cardiovascular System.",
    });

    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        type: "ANNOUNCEMENT",
        status: "SENT",
        deliveryMode: "IN_APP",
        sentAt: expect.any(Date),
        createdById: "admin-id",
      }),
    }));
    expect(mocks.executeRaw).toHaveBeenCalledOnce();
    expect(mocks.createMany).toHaveBeenCalledWith({
      data: [{ campaignId: "campaign-id", sourceType: "CONTENT_LESSON", sourceId: "10000000-0000-4000-8000-000000000001" }],
      skipDuplicates: true,
    });
    const insert = mocks.executeRaw.mock.calls[0][0];
    expect(insert.strings.join(" ")).toContain('INSERT INTO "NotificationRecipient" ("id", "campaignId", "userId", "createdAt", "updatedAt")');
    expect(insert.strings.join(" ")).toContain("gen_random_uuid()");
    expect(insert.strings.join(" ")).toContain("CURRENT_TIMESTAMP");
    expect(insert.strings.join(" ")).toContain('FROM "Profile"');
    expect(insert.values).toContain("campaign-id");
  });

  it("does not create duplicate recipients when the source was previously announced", async () => {
    mocks.findMany.mockResolvedValue([{ sourceType: "QUESTION", sourceId: "10000000-0000-4000-8000-000000000002" }]);
    const tx = {
      notificationPublicationSource: { findMany: mocks.findMany, createMany: mocks.createMany },
      notificationCampaign: { create: mocks.create },
      $executeRaw: mocks.executeRaw,
    };

    await createPublicationNotification(tx as never, {
      actorId: "admin-id",
      publicationSources: [{ type: "QUESTION", id: "10000000-0000-4000-8000-000000000002" }],
      title: "New practice question available",
      message: "New practice question: Identify the structure.",
    });

    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.createMany).not.toHaveBeenCalled();
    expect(mocks.executeRaw).not.toHaveBeenCalled();
  });
});
