import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listPublishedFlashcards: vi.fn(),
  resolveRequestIdentity: vi.fn(),
}));

vi.mock("@/features/flashcards/service", () => ({ listPublishedFlashcards: mocks.listPublishedFlashcards }));
vi.mock("@/lib/auth/request", () => ({ resolveRequestIdentity: mocks.resolveRequestIdentity }));

import { GET } from "./route";

const topicId = "20000000-0000-4000-8000-000000000002";
const request = new Request(`https://admin.example/api/v1/topics/${topicId}/flashcards`);
const context = { params: Promise.resolve({ id: topicId }) };

describe("published flashcards GET", () => {
  beforeEach(() => {
    mocks.listPublishedFlashcards.mockReset();
    mocks.resolveRequestIdentity.mockReset();
  });

  it("requires an active identity", async () => {
    mocks.resolveRequestIdentity.mockResolvedValue(null);
    const response = await GET(request, context);
    expect(response.status).toBe(401);
    expect(mocks.listPublishedFlashcards).not.toHaveBeenCalled();
  });

  it("uses the authenticated owner when returning cards and progress", async () => {
    mocks.resolveRequestIdentity.mockResolvedValue({ profile: { id: "user-id" }, user: {}, mode: "bearer" });
    mocks.listPublishedFlashcards.mockResolvedValue([{ id: "card-id", frontText: "Front", backText: "Back", progress: null }]);
    const response = await GET(request, context);
    expect(response.status).toBe(200);
    expect(mocks.listPublishedFlashcards).toHaveBeenCalledWith(topicId, "user-id");
    const body = await response.json();
    expect(body.data[0]).not.toHaveProperty("notes");
  });
});
