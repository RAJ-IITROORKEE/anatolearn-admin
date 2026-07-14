import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireAdmin: vi.fn(), create: vi.fn(), list: vi.fn() }));
vi.mock("@/lib/api/admin", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/features/notifications/service", () => ({ createCampaign: mocks.create, listCampaigns: mocks.list }));

import { GET, POST } from "./route";

describe("admin notification routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ id: "request", identity: { mode: "bearer", profile: { id: "00000000-0000-4000-8000-000000000001", role: "ADMIN" } } });
    mocks.list.mockResolvedValue({ items: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } });
    mocks.create.mockResolvedValue({ id: "campaign" });
  });

  it("requires admin authentication for reads", async () => {
    mocks.requireAdmin.mockResolvedValue({ id: "request", response: new Response(null, { status: 403 }) });
    expect((await GET(new Request("https://app.example/api/v1/admin/notifications"))).status).toBe(403);
    expect(mocks.list).not.toHaveBeenCalled();
  });

  it("requests cookie-origin enforcement for mutations", async () => {
    const response = await POST(new Request("https://app.example/api/v1/admin/notifications", { method: "POST", body: JSON.stringify({ type: "ANNOUNCEMENT", title: "Title", message: "Message", target: { type: "ALL_ACTIVE_USERS" } }) }));
    expect(response.status).toBe(201);
    expect(mocks.requireAdmin).toHaveBeenCalledWith(expect.any(Request), true);
  });
});
