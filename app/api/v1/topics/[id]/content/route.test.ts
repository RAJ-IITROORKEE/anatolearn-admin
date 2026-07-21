import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ resolve: vi.fn(), lessons: vi.fn() }));
vi.mock("@/lib/auth/request", () => ({ resolveRequestIdentity: mocks.resolve }));
vi.mock("@/features/content/service", () => ({ getPublishedLessons: mocks.lessons }));

import { GET } from "./route";

const topicId = "10000000-0000-4000-8000-000000000001";

describe("published topic content route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("loads owner lesson progress and does not accept a caller-supplied owner", async () => {
    mocks.resolve.mockResolvedValue({ profile: { id: "owner-id" }, mode: "bearer", user: {} });
    mocks.lessons.mockResolvedValue([{ id: "lesson", progress: null }]);
    const response = await GET(new Request(`https://app.example/api/v1/topics/${topicId}/content?userId=other`), {
      params: Promise.resolve({ id: topicId }),
    });
    expect(response.status).toBe(200);
    expect(mocks.lessons).toHaveBeenCalledWith(topicId, "owner-id");
  });
});
