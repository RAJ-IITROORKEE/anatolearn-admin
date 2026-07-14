import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireAdmin: vi.fn(), listLearners: vi.fn(), getLearner: vi.fn(), setLearnerActivity: vi.fn() }));
vi.mock("@/lib/api/admin", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("./service", () => ({ listLearners: mocks.listLearners, getLearner: mocks.getLearner, setLearnerActivity: mocks.setLearnerActivity }));

import { apiError } from "@/lib/api/response";
import { adminUserItemHandler, adminUserListHandler } from "./route-handlers";

const actorId = crypto.randomUUID();
const learnerId = crypto.randomUUID();
const context = { params: Promise.resolve({ id: learnerId }) };

describe("admin user handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ identity: { profile: { id: actorId, role: "ADMIN", isActive: true } }, id: "request-id" });
    mocks.listLearners.mockResolvedValue({ items: [], summary: { total: 0, active: 0, inactive: 0, joined30Days: 0 }, pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } });
    mocks.getLearner.mockResolvedValue({ id: learnerId });
    mocks.setLearnerActivity.mockResolvedValue({ id: learnerId, isActive: false });
  });

  it("rejects unknown list filters and exposes summary metadata", async () => {
    expect((await adminUserListHandler(new Request("https://app.example/api/v1/admin/users?role=ADMIN"))).status).toBe(400);
    const response = await adminUserListHandler(new Request("https://app.example/api/v1/admin/users?isActive=true"));
    expect(response.status).toBe(200);
    expect((await response.json()).meta.summary).toEqual({ total: 0, active: 0, inactive: 0, joined30Days: 0 });
    expect(mocks.listLearners).toHaveBeenCalledWith(expect.objectContaining({ isActive: true }));
  });

  it("uses the mutation admin/origin guard and strict activity body", async () => {
    mocks.requireAdmin.mockResolvedValueOnce({ response: apiError("INVALID_ORIGIN", "Request origin is not allowed.", 403, "request-id"), id: "request-id" });
    const denied = await adminUserItemHandler(new Request(`https://app.example/api/v1/admin/users/${learnerId}`, { method: "PATCH" }), context);
    expect(denied.status).toBe(403);
    expect(mocks.requireAdmin).toHaveBeenCalledWith(expect.any(Request), true);

    const invalid = await adminUserItemHandler(new Request(`https://app.example/api/v1/admin/users/${learnerId}`, {
      method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ isActive: false, role: "USER" }),
    }), context);
    expect(invalid.status).toBe(400);
    expect(mocks.setLearnerActivity).not.toHaveBeenCalled();
  });

  it("passes only server-derived actor context to the mutation service", async () => {
    const response = await adminUserItemHandler(new Request(`https://app.example/api/v1/admin/users/${learnerId}`, {
      method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ isActive: false }),
    }), context);
    expect(response.status).toBe(200);
    expect(mocks.setLearnerActivity).toHaveBeenCalledWith(learnerId, false, expect.objectContaining({ actorId, requestId: "request-id" }));
  });
});
