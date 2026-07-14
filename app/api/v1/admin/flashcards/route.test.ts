import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createFlashcard: vi.fn(),
  listAdminFlashcards: vi.fn(),
  resolveRequestIdentity: vi.fn(),
}));

vi.mock("@/features/flashcards/service", () => ({
  bulkSetFlashcardStatus: vi.fn(),
  createFlashcard: mocks.createFlashcard,
  getAdminFlashcard: vi.fn(),
  listAdminFlashcards: mocks.listAdminFlashcards,
  reorderFlashcards: vi.fn(),
  setFlashcardStatus: vi.fn(),
  updateFlashcard: vi.fn(),
}));
vi.mock("@/lib/auth/request", () => ({
  hasRole: (identity: { profile: { role: string } }, role: string) => identity.profile.role === role,
  resolveRequestIdentity: mocks.resolveRequestIdentity,
}));

import { GET, POST } from "./route";

const topicId = "10000000-0000-4000-8000-000000000001";
const identity = { profile: { id: "user-id", role: "ADMIN" }, user: {}, mode: "cookie" };

describe("admin flashcard collection", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = "https://admin.example";
    mocks.createFlashcard.mockReset();
    mocks.listAdminFlashcards.mockReset();
    mocks.resolveRequestIdentity.mockReset();
    mocks.resolveRequestIdentity.mockResolvedValue(identity);
  });

  it("rejects unknown list filters", async () => {
    const response = await GET(new Request("https://admin.example/api/v1/admin/flashcards?unknown=value"));
    expect(response.status).toBe(400);
    expect(mocks.listAdminFlashcards).not.toHaveBeenCalled();
  });

  it("rejects cross-origin cookie creation", async () => {
    const response = await POST(new Request("https://admin.example/api/v1/admin/flashcards", {
      method: "POST",
      headers: { host: "admin.example", origin: "https://evil.example", "content-type": "application/json" },
      body: JSON.stringify({ topicId, frontText: "Front", backText: "Back", displayOrder: 0 }),
    }));
    expect(response.status).toBe(403);
    expect(mocks.createFlashcard).not.toHaveBeenCalled();
  });

  it("creates from a same-origin cookie request with server-derived audit context", async () => {
    mocks.createFlashcard.mockResolvedValue({ id: "card-id" });
    const response = await POST(new Request("https://admin.example/api/v1/admin/flashcards", {
      method: "POST",
      headers: { host: "admin.example", origin: "https://admin.example", "content-type": "application/json" },
      body: JSON.stringify({ topicId, frontText: "Front", backText: "Back", displayOrder: 0 }),
    }));
    expect(response.status).toBe(201);
    expect(mocks.createFlashcard).toHaveBeenCalledWith(
      { topicId, frontText: "Front", backText: "Back", displayOrder: 0 },
      expect.objectContaining({ actorId: "user-id" }),
    );
  });
});
