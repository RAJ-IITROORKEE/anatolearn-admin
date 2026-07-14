import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ resolveRequestIdentity: vi.fn(), createFeedback: vi.fn() }));
vi.mock("@/lib/auth/request", () => ({ resolveRequestIdentity: mocks.resolveRequestIdentity }));
vi.mock("./service", () => ({
  createFeedback: mocks.createFeedback,
  listMyFeedback: vi.fn(),
  listAdminFeedback: vi.fn(),
  getAdminFeedback: vi.fn(),
  updateFeedback: vi.fn(),
}));

import { feedbackSubmitHandler } from "./route-handlers";

describe("feedback per-user rate limit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const profile = { id: crypto.randomUUID(), role: "USER", isActive: true };
    mocks.resolveRequestIdentity.mockResolvedValue({ profile, mode: "bearer", user: {} });
    mocks.createFeedback.mockResolvedValue({ id: crypto.randomUUID() });
  });

  it("cannot be bypassed by rotating a spoofed x-forwarded-for header", async () => {
    const statuses: number[] = [];
    let finalResponse: Response | undefined;
    for (let requestNumber = 1; requestNumber <= 6; requestNumber += 1) {
      finalResponse = await feedbackSubmitHandler(new Request("https://app.example/api/v1/feedback", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": `203.0.113.${requestNumber}`,
        },
        body: JSON.stringify({ type: "GENERAL", subject: "Subject", message: "Message" }),
      }));
      if (!finalResponse) throw new Error("Handler did not return a response.");
      statuses.push(finalResponse.status);
    }

    expect(statuses).toEqual([201, 201, 201, 201, 201, 429]);
    expect(finalResponse?.headers.get("Retry-After")).toBe("60");
    expect(mocks.createFeedback).toHaveBeenCalledTimes(5);
  });
});
