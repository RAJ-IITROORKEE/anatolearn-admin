import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  updateFlashcardProgress: vi.fn(),
  resolveRequestIdentity: vi.fn(),
}));

vi.mock("@/features/flashcards/service", () => ({ updateFlashcardProgress: mocks.updateFlashcardProgress }));
vi.mock("@/lib/auth/request", () => ({ resolveRequestIdentity: mocks.resolveRequestIdentity }));

import { PUT } from "./route";

const eventId = "10000000-0000-4000-8000-000000000001";
const flashcardId = "20000000-0000-4000-8000-000000000002";
const context = { params: Promise.resolve({ id: flashcardId }) };

function request(mode: "same-origin" | "cross-origin" | "bearer") {
  const headers = new Headers({ "content-type": "application/json", host: "admin.example" });
  if (mode !== "bearer") headers.set("origin", mode === "same-origin" ? "https://admin.example" : "https://evil.example");
  if (mode === "bearer") headers.set("authorization", "Bearer token");
  return new Request(`https://admin.example/api/v1/flashcards/${flashcardId}/progress`, { method: "PUT", headers, body: JSON.stringify({ eventId, isDifficult: true }) });
}

describe("flashcard progress PUT", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = "https://admin.example";
    mocks.updateFlashcardProgress.mockReset();
    mocks.resolveRequestIdentity.mockReset();
  });

  it("rejects cross-origin cookie mutation", async () => {
    mocks.resolveRequestIdentity.mockResolvedValue({ profile: { id: "user-id" }, user: {}, mode: "cookie" });
    const response = await PUT(request("cross-origin"), context);
    expect(response.status).toBe(403);
    expect(mocks.updateFlashcardProgress).not.toHaveBeenCalled();
  });

  it("allows same-origin cookie mutation and derives ownership from identity", async () => {
    mocks.resolveRequestIdentity.mockResolvedValue({ profile: { id: "user-id" }, user: {}, mode: "cookie" });
    mocks.updateFlashcardProgress.mockResolvedValue({ flashcardId, viewedCount: 1 });
    const response = await PUT(request("same-origin"), context);
    expect(response.status).toBe(200);
    expect(mocks.updateFlashcardProgress).toHaveBeenCalledWith(flashcardId, "user-id", { eventId, isDifficult: true });
  });

  it("does not require an Origin header for bearer mutation", async () => {
    mocks.resolveRequestIdentity.mockResolvedValue({ profile: { id: "user-id" }, user: {}, mode: "bearer" });
    mocks.updateFlashcardProgress.mockResolvedValue({ flashcardId, viewedCount: 1 });
    const response = await PUT(request("bearer"), context);
    expect(response.status).toBe(200);
  });
});
