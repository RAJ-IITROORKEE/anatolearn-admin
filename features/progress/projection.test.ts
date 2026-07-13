import { describe, expect, it, vi } from "vitest";

import { refreshTopicProgress, refreshTopicProgressPairs } from "./projection";

describe("topic progress projection", () => {
  it("rebuilds all metrics for many user/topic pairs with one set-based upsert", async () => {
    const tx = { $executeRaw: vi.fn().mockResolvedValue(2) };
    const pairs = [
      { userId: "10000000-0000-4000-8000-000000000001", topicId: "20000000-0000-4000-8000-000000000001" },
      { userId: "10000000-0000-4000-8000-000000000002", topicId: "20000000-0000-4000-8000-000000000002" },
    ];

    await refreshTopicProgressPairs(tx as never, pairs);

    expect(tx.$executeRaw).toHaveBeenCalledOnce();
    const query = tx.$executeRaw.mock.calls[0][0];
    expect(query.strings.join(" ")).toContain("ON CONFLICT");
    expect(query.strings.join(" ")).toContain('"AttemptQuestion"');
    expect(query.values).toEqual(expect.arrayContaining(pairs.flatMap((pair) => [pair.userId, pair.topicId])));
  });

  it("keeps the single-topic API transaction-compatible", async () => {
    const tx = { $executeRaw: vi.fn().mockResolvedValue(1) };
    await refreshTopicProgress(tx as never, "user", "topic");
    expect(tx.$executeRaw).toHaveBeenCalledOnce();
  });
});
