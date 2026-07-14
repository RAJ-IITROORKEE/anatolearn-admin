import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolveRequestIdentity: vi.fn(), startAssessment: vi.fn(), submitAttempt: vi.fn(), retakeAttempt: vi.fn(), updateAttemptAnswer: vi.fn(),
}));
vi.mock("@/lib/auth/request", () => ({ resolveRequestIdentity: mocks.resolveRequestIdentity }));
vi.mock("./service", () => ({
  startAssessment: mocks.startAssessment, submitAttempt: mocks.submitAttempt, updateAttemptAnswer: mocks.updateAttemptAnswer,
  getAttempt: vi.fn(), getAttemptResult: vi.fn(), retakeAttempt: mocks.retakeAttempt, listAttempts: vi.fn(),
}));

import { assessmentStartHandler, attemptAnswerHandler, attemptRetakeHandler, attemptSubmitHandler } from "./route-handlers";

const id = "10000000-0000-4000-8000-000000000001";
const identity = { profile: { id: "owner" }, user: {}, mode: "cookie" };

describe("assessment route handlers", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("requires active authentication", async () => {
    mocks.resolveRequestIdentity.mockResolvedValue(null);
    const response = await assessmentStartHandler(new Request("https://app.example/api/v1/assessments/start", { method: "POST" }));
    expect(response.status).toBe(401);
  });

  it("enforces same-origin cookie mutations", async () => {
    mocks.resolveRequestIdentity.mockResolvedValue(identity);
    const response = await attemptSubmitHandler(new Request(`https://app.example/api/v1/attempts/${id}/submit`, { method: "POST" }), { params: Promise.resolve({ attemptId: id }) });
    expect(response.status).toBe(403);
    expect(mocks.submitAttempt).not.toHaveBeenCalled();
  });

  it("dispatches answers with the authenticated owner, never a body user", async () => {
    mocks.resolveRequestIdentity.mockResolvedValue({ ...identity, mode: "bearer" });
    mocks.updateAttemptAnswer.mockResolvedValue({ id: "aq" });
    const request = new Request(`https://app.example/api/v1/attempts/${id}/answers/${id}`, {
      method: "PUT", headers: { authorization: "Bearer token", "content-type": "application/json" }, body: JSON.stringify({ answeredOptionKey: null }),
    });
    const response = await attemptAnswerHandler(request, { params: Promise.resolve({ attemptId: id, attemptQuestionId: id }) });
    expect(response.status).toBe(200);
    expect(mocks.updateAttemptAnswer).toHaveBeenCalledWith(id, id, "owner", { answeredOptionKey: null });
  });

  it.each([
    [attemptSubmitHandler, mocks.submitAttempt],
    [attemptRetakeHandler, mocks.retakeAttempt],
  ])("rejects non-empty JSON on bodyless assessment mutations", async (handler, service) => {
    mocks.resolveRequestIdentity.mockResolvedValue({ ...identity, mode: "bearer" });
    const response = await handler(new Request(`https://app.example/api/v1/attempts/${id}/mutation`, {
      method: "POST", headers: { authorization: "Bearer token", "content-type": "application/json" }, body: JSON.stringify({ unexpected: true }),
    }), { params: Promise.resolve({ attemptId: id }) });
    expect(response.status).toBe(400);
    expect(service).not.toHaveBeenCalled();
  });
});
