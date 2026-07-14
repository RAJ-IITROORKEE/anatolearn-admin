import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolveRequestIdentity: vi.fn(),
  getUserProgress: vi.fn(),
  getUserDashboard: vi.fn(),
  updateLessonProgress: vi.fn(),
}));

vi.mock("@/lib/auth/request", () => ({ resolveRequestIdentity: mocks.resolveRequestIdentity }));
vi.mock("./service", () => ({ getUserProgress: mocks.getUserProgress, getUserDashboard: mocks.getUserDashboard }));
vi.mock("./lesson-service", () => ({ updateLessonProgress: mocks.updateLessonProgress }));

import { dashboardHandler, lessonProgressHandler, progressDetailHandler, progressListHandler } from "./route-handlers";

const uuid = "10000000-0000-4000-8000-000000000001";
const identity = { profile: { id: "owner" }, user: {}, mode: "bearer" };

describe("progress route handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example";
    mocks.resolveRequestIdentity.mockResolvedValue(identity);
  });

  it("requires active authentication for reports", async () => {
    mocks.resolveRequestIdentity.mockResolvedValue(null);
    expect((await progressListHandler(new Request("https://app.example/api/v1/progress"))).status).toBe(401);
  });

  it("dispatches owner-only progress and dashboard reads", async () => {
    mocks.getUserProgress.mockResolvedValue([{ id: uuid }]);
    mocks.getUserDashboard.mockResolvedValue({ attempts: { total: 0 } });
    const detail = await progressDetailHandler(new Request(`https://app.example/api/v1/progress/${uuid}`), { params: Promise.resolve({ organSystemId: uuid }) });
    const dashboard = await dashboardHandler(new Request("https://app.example/api/v1/dashboard/me"));
    expect(detail.status).toBe(200);
    expect(dashboard.status).toBe(200);
    expect(mocks.getUserProgress).toHaveBeenCalledWith("owner", uuid);
    expect(mocks.getUserDashboard).toHaveBeenCalledWith("owner");
  });

  it("requires a safe origin and strict body for cookie lesson mutations", async () => {
    mocks.resolveRequestIdentity.mockResolvedValue({ ...identity, mode: "cookie" });
    const request = new Request(`https://app.example/api/v1/content-lessons/${uuid}/progress`, {
      method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ completed: true, userId: "other" }),
    });
    expect((await lessonProgressHandler(request, { params: Promise.resolve({ id: uuid }) })).status).toBe(403);
    expect(mocks.updateLessonProgress).not.toHaveBeenCalled();
  });

  it("updates lesson progress for the authenticated cookie owner with a same-origin request", async () => {
    mocks.resolveRequestIdentity.mockResolvedValue({ ...identity, mode: "cookie" });
    mocks.updateLessonProgress.mockResolvedValue({ contentLessonId: uuid, completed: true });
    const request = new Request(`https://app.example/api/v1/content-lessons/${uuid}/progress`, {
      method: "PUT",
      headers: { "content-type": "application/json", origin: "https://app.example", host: "app.example" },
      body: JSON.stringify({ completed: true }),
    });
    const response = await lessonProgressHandler(request, { params: Promise.resolve({ id: uuid }) });
    expect(response.status).toBe(200);
    expect(mocks.updateLessonProgress).toHaveBeenCalledWith(uuid, "owner", { completed: true });
  });
});
