import { describe, expect, it } from "vitest";

import { apiError, apiSuccess } from "@/lib/api/response";

describe("API responses", () => {
  it("returns the documented success envelope", async () => {
    const response = apiSuccess({ status: "ok" }, { requestId: "request-1" });
    expect(await response.json()).toEqual({
      success: true,
      data: { status: "ok" },
      meta: { requestId: "request-1" },
    });
  });

  it("returns a safe error envelope", async () => {
    const response = apiError("UNAUTHORIZED", "Authentication is required.", 401, "request-2");
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Authentication is required.", requestId: "request-2" },
    });
  });
});
