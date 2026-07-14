import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  bulkSetFlashcardStatus: vi.fn(),
  getAdminFlashcard: vi.fn(),
  setFlashcardStatus: vi.fn(),
  updateFlashcard: vi.fn(),
  resolveRequestIdentity: vi.fn(),
  moveToTrash: vi.fn(),
}));

vi.mock("@/features/flashcards/service", () => ({
  bulkSetFlashcardStatus: mocks.bulkSetFlashcardStatus,
  createFlashcard: vi.fn(),
  getAdminFlashcard: mocks.getAdminFlashcard,
  listAdminFlashcards: vi.fn(),
  reorderFlashcards: vi.fn(),
  setFlashcardStatus: mocks.setFlashcardStatus,
  updateFlashcard: mocks.updateFlashcard,
}));
vi.mock("@/lib/auth/request", () => ({
  hasRole: (identity: { profile: { role: string } }, role: string) => identity.profile.role === role,
  resolveRequestIdentity: mocks.resolveRequestIdentity,
}));
vi.mock("@/features/trash/service", () => ({ moveToTrash: mocks.moveToTrash }));

import { GET as itemGet, PATCH as itemPatch } from "./[id]/route";
import { POST as archivePost } from "./[id]/archive/route";
import { PATCH as statusPatch } from "./[id]/status/route";
import { PATCH as bulkPatch } from "./bulk-status/route";

const id = "20000000-0000-4000-8000-000000000002";
const otherId = "30000000-0000-4000-8000-000000000003";
const context = { params: Promise.resolve({ id }) };
const admin = { profile: { id: "user-id", role: "ADMIN" }, user: {}, mode: "cookie" };

function mutation(url: string, body: unknown, origin = "https://admin.example") {
  return new Request(url, {
    method: "PATCH",
    headers: { host: "admin.example", origin, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("admin flashcard item and lifecycle routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = "https://admin.example";
    mocks.resolveRequestIdentity.mockResolvedValue(admin);
  });

  it("requires authentication for item reads", async () => {
    mocks.resolveRequestIdentity.mockResolvedValue(null);
    expect((await itemGet(new Request(`https://admin.example/api/v1/admin/flashcards/${id}`), context)).status).toBe(401);
    expect(mocks.getAdminFlashcard).not.toHaveBeenCalled();
  });

  it("dispatches item updates but rejects malformed bodies", async () => {
    mocks.updateFlashcard.mockResolvedValue({ id });
    expect((await itemPatch(mutation(`https://admin.example/api/v1/admin/flashcards/${id}`, { frontText: "Updated" }), context)).status).toBe(200);
    expect(mocks.updateFlashcard).toHaveBeenCalledWith(id, { frontText: "Updated" }, expect.objectContaining({ actorId: "user-id" }));

    expect((await itemPatch(mutation(`https://admin.example/api/v1/admin/flashcards/${id}`, { unknown: true }), context)).status).toBe(400);
  });

  it("rejects unsafe cookie origins for status and archive", async () => {
    expect((await statusPatch(mutation(`https://admin.example/api/v1/admin/flashcards/${id}/status`, { status: "PUBLISHED" }, "https://evil.example"), context)).status).toBe(403);
    expect((await archivePost(mutation(`https://admin.example/api/v1/admin/flashcards/${id}/archive`, {}, "https://evil.example"), context)).status).toBe(403);
    expect(mocks.setFlashcardStatus).not.toHaveBeenCalled();
  });

  it("dispatches explicit status and archive actions", async () => {
    mocks.setFlashcardStatus.mockResolvedValue({ id });
    mocks.moveToTrash.mockResolvedValue({ id });
    expect((await statusPatch(mutation(`https://admin.example/api/v1/admin/flashcards/${id}/status`, { status: "PUBLISHED" }), context)).status).toBe(200);
    expect((await archivePost(mutation(`https://admin.example/api/v1/admin/flashcards/${id}/archive`, {}), context)).status).toBe(200);
    expect(mocks.setFlashcardStatus).toHaveBeenNthCalledWith(1, id, "PUBLISHED", expect.objectContaining({ actorId: "user-id" }));
    expect(mocks.moveToTrash).toHaveBeenCalledWith("flashcard", id, expect.objectContaining({ actorId: "user-id" }));
  });

  it("validates and dispatches bulk status atomically", async () => {
    mocks.bulkSetFlashcardStatus.mockResolvedValue([]);
    expect((await bulkPatch(mutation("https://admin.example/api/v1/admin/flashcards/bulk-status", { ids: [id], status: "INVALID" }))).status).toBe(400);
    expect((await bulkPatch(mutation("https://admin.example/api/v1/admin/flashcards/bulk-status", { ids: [id, otherId], status: "ARCHIVED" }))).status).toBe(200);
    expect(mocks.bulkSetFlashcardStatus).toHaveBeenCalledWith([id, otherId], "ARCHIVED", expect.objectContaining({ actorId: "user-id" }));
  });
});
