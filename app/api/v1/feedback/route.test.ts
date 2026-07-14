import { describe, expect, it, vi } from "vitest";

const handler = vi.hoisted(() => vi.fn(async () => new Response(null, { status: 201 })));
vi.mock("@/features/feedback/route-handlers", () => ({ feedbackSubmitHandler: handler }));

import { POST } from "./route";

describe("feedback route", () => {
  it("delegates to the thin feature handler", async () => {
    const request = new Request("https://app.example/api/v1/feedback", { method: "POST" });
    const response = await POST(request);
    expect(response).toBeDefined();
    if (!response) throw new Error("Route did not return a response.");
    expect(response.status).toBe(201);
    expect(handler).toHaveBeenCalledWith(request);
  });
});
