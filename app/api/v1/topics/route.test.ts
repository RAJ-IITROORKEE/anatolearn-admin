import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ publishedTopicCatalogHandler: vi.fn() }));
vi.mock("@/features/content/route-handlers", () => ({ publishedTopicCatalogHandler: mocks.publishedTopicCatalogHandler }));

import { GET } from "./route";

describe("GET /api/v1/topics", () => {
  it("delegates the route contract to the learner catalog handler", async () => {
    const request = new Request("https://admin.example/api/v1/topics?page=2");
    const expected = new Response(JSON.stringify({ success: true }), { status: 200 });
    mocks.publishedTopicCatalogHandler.mockResolvedValue(expected);

    await expect(GET(request)).resolves.toBe(expected);
    expect(mocks.publishedTopicCatalogHandler).toHaveBeenCalledWith(request);
  });
});
