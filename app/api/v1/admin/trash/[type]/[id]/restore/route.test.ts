import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireAdmin: vi.fn(), restore: vi.fn() }));
vi.mock("@/lib/api/admin", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/features/trash/service", () => ({ restoreFromTrash: mocks.restore }));

import { POST } from "./route";

const id = crypto.randomUUID();
const context = { params: Promise.resolve({ type: "topic", id }) };

describe("trash restore route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ id: "request", identity: { mode: "cookie", profile: { id: "admin", role: "ADMIN" } } });
    mocks.restore.mockResolvedValue({ id, type: "topic", restored: true, status: "DRAFT" });
  });

  it("uses the admin mutation guard and accepts an empty body", async () => {
    const request = new Request("https://app.example/api/v1/admin/trash/topic/id/restore", { method: "POST" });
    expect((await POST(request, context)).status).toBe(200);
    expect(mocks.requireAdmin).toHaveBeenCalledWith(request, true);
    expect(mocks.restore).toHaveBeenCalledWith("topic", id, expect.objectContaining({ actorId: "admin" }));
  });

  it("rejects non-empty bodies", async () => {
    const response = await POST(new Request("https://app.example/api/v1/admin/trash/topic/id/restore", {
      method: "POST", body: JSON.stringify({ force: true }), headers: { "content-type": "application/json" },
    }), context);
    expect(response.status).toBe(400);
    expect(mocks.restore).not.toHaveBeenCalled();
  });

  it("returns an auth or origin denial before parsing", async () => {
    mocks.requireAdmin.mockResolvedValue({ id: "request", response: new Response(null, { status: 403 }) });
    expect((await POST(new Request("https://app.example/restore", { method: "POST" }), context)).status).toBe(403);
    expect(mocks.restore).not.toHaveBeenCalled();
  });
});
