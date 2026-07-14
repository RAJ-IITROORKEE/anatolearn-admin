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
    expect(response.headers.get("x-request-id")).toBe("request-1");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("vary")).toBe("Authorization, Cookie");
  });

  it("returns a safe error envelope", async () => {
    const response = apiError("UNAUTHORIZED", "Authentication is required.", 401, "request-2");
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Authentication is required.", requestId: "request-2" },
    });
    expect(response.headers.get("x-request-id")).toBe("request-2");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("allows an explicitly public cache policy", () => {
    const response = apiSuccess({ status: "ok" }, { requestId: "public-1" }, 200, {
      cacheControl: "public, max-age=60",
      vary: undefined,
    });
    expect(response.headers.get("cache-control")).toBe("public, max-age=60");
    expect(response.headers.has("vary")).toBe(false);
  });
});
