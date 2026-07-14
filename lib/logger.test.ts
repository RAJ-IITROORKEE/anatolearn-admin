import { afterEach, describe, expect, it, vi } from "vitest";

import { logError } from "./logger";

describe("structured logger", () => {
  afterEach(() => vi.restoreAllMocks());

  it("serializes only allowlisted operational fields", () => {
    const output = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const secret = "Bearer top-secret-token";
    logError({
      requestId: "request-1",
      code: "INTERNAL_ERROR",
      status: 500,
      route: "/api/v1/auth/login",
      error: new Error(secret),
      body: { password: secret },
    });

    const serialized = String(output.mock.calls[0]?.[0]);
    expect(JSON.parse(serialized)).toEqual({
      level: "error",
      requestId: "request-1",
      code: "INTERNAL_ERROR",
      status: 500,
      route: "/api/v1/auth/login",
    });
    expect(serialized).not.toContain(secret);
    expect(serialized).not.toContain("password");
  });
});
