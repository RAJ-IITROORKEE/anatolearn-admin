import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireAdmin: vi.fn(), getAdminDashboard: vi.fn() }));
vi.mock("@/lib/api/admin", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/features/admin-dashboard/service", () => ({ getAdminDashboard: mocks.getAdminDashboard }));

import { apiError } from "@/lib/api/response";
import { GET } from "./route";

describe("admin dashboard route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ identity: { profile: { role: "ADMIN", isActive: true } }, id: "request-id" });
    mocks.getAdminDashboard.mockResolvedValue({ generatedAt: new Date("2026-07-14T00:00:00Z") });
  });

  it("denies unauthenticated, inactive, and non-admin identities through the admin guard", async () => {
    for (const status of [401, 403]) {
      mocks.requireAdmin.mockResolvedValueOnce({
        response: apiError(status === 401 ? "UNAUTHORIZED" : "FORBIDDEN", "Denied", status, "request-id"),
        id: "request-id",
      });
      expect((await GET(new Request("https://app.example/api/v1/admin/dashboard"))).status).toBe(status);
    }
    expect(mocks.getAdminDashboard).not.toHaveBeenCalled();
  });

  it("defaults to 30 days and makes one service call", async () => {
    const response = await GET(new Request("https://app.example/api/v1/admin/dashboard"));
    expect(response.status).toBe(200);
    expect(mocks.getAdminDashboard).toHaveBeenCalledOnce();
    expect(mocks.getAdminDashboard).toHaveBeenCalledWith({ days: 30 });
  });

  it("accepts supported windows and strictly rejects invalid or unknown query input", async () => {
    expect((await GET(new Request("https://app.example/api/v1/admin/dashboard?days=7"))).status).toBe(200);
    expect(mocks.getAdminDashboard).toHaveBeenLastCalledWith({ days: 7 });

    expect((await GET(new Request("https://app.example/api/v1/admin/dashboard?days=14"))).status).toBe(400);
    expect((await GET(new Request("https://app.example/api/v1/admin/dashboard?days=30&extra=true"))).status).toBe(400);
    expect((await GET(new Request("https://app.example/api/v1/admin/dashboard?days=7&days=90"))).status).toBe(400);
    expect(mocks.getAdminDashboard).toHaveBeenCalledOnce();
  });
});
