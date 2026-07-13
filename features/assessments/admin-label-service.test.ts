import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ systems: vi.fn(), topics: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: {
  organSystem: { findMany: mocks.systems },
  topic: { findMany: mocks.topics },
} }));

import { getAdminAttemptLabels } from "./admin-label-service";

describe("admin attempt label lookup", () => {
  beforeEach(() => vi.clearAllMocks());

  it("queries only distinct IDs from the current attempt page", async () => {
    mocks.systems.mockResolvedValue([{ id: "system-1", name: "Cardiovascular" }]);
    mocks.topics.mockResolvedValue([{ id: "topic-1", title: "Heart" }]);

    const result = await getAdminAttemptLabels({
      organSystemIds: ["system-1", "system-1"],
      topicIds: ["topic-1", "topic-1", "topic-missing"],
    });

    expect(mocks.systems).toHaveBeenCalledWith({ where: { id: { in: ["system-1"] } }, select: { id: true, name: true } });
    expect(mocks.topics).toHaveBeenCalledWith({ where: { id: { in: ["topic-1", "topic-missing"] } }, select: { id: true, title: true } });
    expect(result.systemLabels.get("system-1")).toBe("Cardiovascular");
    expect(result.topicLabels.get("topic-missing")).toBeUndefined();
  });
});
