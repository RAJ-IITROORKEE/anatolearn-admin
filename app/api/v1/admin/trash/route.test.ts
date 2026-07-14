import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireAdmin: vi.fn(), listTrash: vi.fn() }));
vi.mock("@/lib/api/admin", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/features/trash/service", () => ({ listTrash: mocks.listTrash }));

import { GET } from "./route";

describe("admin trash list route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ id: "request", identity: { profile: { id: "admin", role: "ADMIN" } } });
    mocks.listTrash.mockResolvedValue({ items: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } });
  });

  it("requires admin authentication", async () => {
    mocks.requireAdmin.mockResolvedValue({ id: "request", response: new Response(null, { status: 401 }) });
    expect((await GET(new Request("https://app.example/api/v1/admin/trash"))).status).toBe(401);
    expect(mocks.listTrash).not.toHaveBeenCalled();
  });

  it("rejects unknown query keys", async () => {
    const response = await GET(new Request("https://app.example/api/v1/admin/trash?unknown=true"));
    expect(response.status).toBe(400);
    expect(mocks.listTrash).not.toHaveBeenCalled();
  });
});
