import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ resolveRequestIdentity: vi.fn(), allowRequest: vi.fn(), requestClientKey: vi.fn((request: Request) => `feedback:${request.headers.get("x-forwarded-for") ?? "unknown"}`), createFeedback: vi.fn(), listMine: vi.fn(), listAdmin: vi.fn(), getAdmin: vi.fn(), updateFeedback: vi.fn() }));
vi.mock("@/lib/auth/request", () => ({ resolveRequestIdentity: mocks.resolveRequestIdentity }));
vi.mock("@/lib/rate-limit", () => ({ allowRequest: mocks.allowRequest, requestClientKey: mocks.requestClientKey }));
vi.mock("./service", () => ({ createFeedback: mocks.createFeedback, listMyFeedback: mocks.listMine, listAdminFeedback: mocks.listAdmin, getAdminFeedback: mocks.getAdmin, updateFeedback: mocks.updateFeedback }));

import { adminFeedbackItemHandler, adminFeedbackListHandler, feedbackMineHandler, feedbackSubmitHandler } from "./route-handlers";

const profile = { id: crypto.randomUUID(), role: "USER", isActive: true };
const id = crypto.randomUUID();
const context = { params: Promise.resolve({ id }) };

function required(response: Response | undefined) {
  expect(response).toBeDefined();
  if (!response) throw new Error("Handler did not return a response.");
  return response;
}

describe("feedback handlers", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.allowRequest.mockReturnValue(true); mocks.resolveRequestIdentity.mockResolvedValue({ profile, mode: "bearer", user: {} }); mocks.createFeedback.mockResolvedValue({ id }); mocks.listMine.mockResolvedValue({ items: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } }); });

  it("enforces authentication, cookie origin, strict validation and owner derivation", async () => {
    mocks.resolveRequestIdentity.mockResolvedValueOnce(null);
    expect(required(await feedbackSubmitHandler(new Request("https://app.example/api/v1/feedback", { method: "POST" }))).status).toBe(401);
    mocks.resolveRequestIdentity.mockResolvedValueOnce({ profile, mode: "cookie", user: {} });
    expect(required(await feedbackSubmitHandler(new Request("https://app.example/api/v1/feedback", { method: "POST", headers: { origin: "https://evil.example", host: "app.example" } }))).status).toBe(403);
    const response = required(await feedbackSubmitHandler(new Request("https://app.example/api/v1/feedback", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type: "GENERAL", subject: "Subject", message: "Message" }) })));
    expect(response.status).toBe(201);
    expect(mocks.createFeedback).toHaveBeenCalledWith(profile.id, expect.objectContaining({ subject: "Subject" }));
  });

  it("returns Retry-After on the process-local submission limit", async () => {
    mocks.allowRequest.mockReturnValue(false);
    const response = required(await feedbackSubmitHandler(new Request("https://app.example/api/v1/feedback", { method: "POST" })));
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("60");
  });

  it("uses only the verified user ID even when x-forwarded-for is rotated", async () => {
    const body = JSON.stringify({ type: "GENERAL", subject: "Subject", message: "Message" });
    await feedbackSubmitHandler(new Request("https://app.example/api/v1/feedback", {
      method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "198.51.100.1" }, body,
    }));
    await feedbackSubmitHandler(new Request("https://app.example/api/v1/feedback", {
      method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.9" }, body,
    }));

    expect(mocks.allowRequest).toHaveBeenNthCalledWith(1, `feedback:user:${profile.id}`, 5, 60_000);
    expect(mocks.allowRequest).toHaveBeenNthCalledWith(2, `feedback:user:${profile.id}`, 5, 60_000);
    expect(mocks.requestClientKey).not.toHaveBeenCalled();
  });

  it("scopes learner reads and requires active admin guards for admin operations", async () => {
    await feedbackMineHandler(new Request("https://app.example/api/v1/feedback/mine?status=NEW"));
    expect(mocks.listMine).toHaveBeenCalledWith(profile.id, expect.objectContaining({ status: "NEW" }));
    mocks.resolveRequestIdentity.mockResolvedValue({ profile: { ...profile, role: "USER" }, mode: "bearer", user: {} });
    expect(required(await adminFeedbackListHandler(new Request("https://app.example/api/v1/admin/feedback"))).status).toBe(403);
    expect(required(await adminFeedbackItemHandler(new Request(`https://app.example/api/v1/admin/feedback/${id}`, { method: "PATCH" }), context)).status).toBe(403);
  });
});
