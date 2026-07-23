import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolveRequestIdentity: vi.fn(),
  listStudyCatalog: vi.fn(),
}));

vi.mock("@/lib/auth/request", () => ({ resolveRequestIdentity: mocks.resolveRequestIdentity }));
vi.mock("./service", () => ({ listStudyCatalog: mocks.listStudyCatalog }));

import { publishedTopicCatalogHandler } from "./route-handlers";

describe("published topic catalog handler", () => {
  beforeEach(() => {
    mocks.resolveRequestIdentity.mockReset();
    mocks.listStudyCatalog.mockReset();
  });

  it("requires an active server-resolved identity", async () => {
    mocks.resolveRequestIdentity.mockResolvedValue(null);

    const response = await publishedTopicCatalogHandler(new Request("https://admin.example/api/v1/topics"));

    expect(response.status).toBe(401);
    expect(mocks.listStudyCatalog).not.toHaveBeenCalled();
  });

  it("validates the query and returns the shared paginated envelope", async () => {
    mocks.resolveRequestIdentity.mockResolvedValue({ profile: { id: "server-derived-user" }, user: {}, mode: "bearer" });
    mocks.listStudyCatalog.mockResolvedValue({ items: [{ id: "topic-id", publishedLessonCount: 1, publishedFlashcardCount: 2 }], pagination: { page: 2, pageSize: 50, total: 1, totalPages: 1 } });

    const response = await publishedTopicCatalogHandler(new Request("https://admin.example/api/v1/topics?page=2&pageSize=50&q=heart"));

    expect(response.status).toBe(200);
    expect(mocks.listStudyCatalog).toHaveBeenCalledWith({ page: 2, pageSize: 50, q: "heart" });
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: [{ id: "topic-id", publishedLessonCount: 1, publishedFlashcardCount: 2 }],
      meta: { pagination: { page: 2, pageSize: 50, total: 1, totalPages: 1 } },
    });
  });

  it("maps invalid query values to the standard 400 envelope", async () => {
    mocks.resolveRequestIdentity.mockResolvedValue({ profile: { id: "server-derived-user" }, user: {}, mode: "bearer" });

    const response = await publishedTopicCatalogHandler(new Request("https://admin.example/api/v1/topics?pageSize=101"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ success: false, error: { code: "VALIDATION_ERROR" } });
  });

  it("maps unexpected catalog failures to the standard 500 envelope", async () => {
    mocks.resolveRequestIdentity.mockResolvedValue({ profile: { id: "server-derived-user" }, user: {}, mode: "bearer" });
    mocks.listStudyCatalog.mockRejectedValue(new Error("database detail must remain private"));

    const response = await publishedTopicCatalogHandler(new Request("https://admin.example/api/v1/topics"));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({ success: false, error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." } });
  });
});
