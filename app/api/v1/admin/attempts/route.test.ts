import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireAdmin: vi.fn(), listAdminAttempts: vi.fn() }));
vi.mock("@/lib/api/admin", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/features/assessments/admin-service", () => ({ listAdminAttempts: mocks.listAdminAttempts }));

import { apiError } from "@/lib/api/response";
import { GET } from "./route";

describe("admin attempts route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ identity: { profile: { role: "ADMIN" } }, id: "request-id" });
    mocks.listAdminAttempts.mockResolvedValue({ items: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } });
  });

  it("returns the admin guard response for unauthorized roles", async () => {
    mocks.requireAdmin.mockResolvedValue({ response: apiError("FORBIDDEN", "Administrator access is required.", 403, "request-id"), id: "request-id" });
    expect((await GET(new Request("https://app.example/api/v1/admin/attempts"))).status).toBe(403);
    expect(mocks.listAdminAttempts).not.toHaveBeenCalled();
  });

  it("rejects unknown query parameters", async () => {
    const response = await GET(new Request("https://app.example/api/v1/admin/attempts?unknown=value"));
    expect(response.status).toBe(400);
    expect(mocks.listAdminAttempts).not.toHaveBeenCalled();
  });

  it("allows read-only cookie GET requests without an Origin header", async () => {
    const response = await GET(new Request("https://app.example/api/v1/admin/attempts?assessmentType=QUIZ"));
    expect(response.status).toBe(200);
    expect(mocks.requireAdmin).toHaveBeenCalledWith(expect.any(Request));
    expect(mocks.listAdminAttempts).toHaveBeenCalledWith(expect.objectContaining({ assessmentType: "QUIZ" }));
  });
});
