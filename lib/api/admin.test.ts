import type { Profile } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { resolveRequestIdentity } = vi.hoisted(() => ({ resolveRequestIdentity: vi.fn() }));
vi.mock("@/lib/auth/request", () => ({ resolveRequestIdentity }));

import { requireAdmin } from "./admin";

const profile = { id: "admin-id", role: "ADMIN", isActive: true } as Profile;

describe("requireAdmin", () => {
  beforeEach(() => resolveRequestIdentity.mockReset());

  it("rejects requests without an active identity", async () => {
    resolveRequestIdentity.mockResolvedValue(null);
    const result = await requireAdmin(new Request("https://admin.example/api"));
    expect(result.response?.status).toBe(401);
  });

  it("requires a same-origin header for cookie mutations", async () => {
    resolveRequestIdentity.mockResolvedValue({ profile, user: {}, mode: "cookie" });
    const result = await requireAdmin(new Request("https://admin.example/api", { method: "PATCH", headers: { host: "admin.example", origin: "https://evil.example" } }), true);
    expect(result.response?.status).toBe(403);
  });

  it("allows an authenticated bearer admin without browser origin headers", async () => {
    resolveRequestIdentity.mockResolvedValue({ profile, user: {}, mode: "bearer" });
    const result = await requireAdmin(new Request("https://admin.example/api", { method: "PATCH" }), true);
    expect(result.identity?.profile.id).toBe("admin-id");
  });

  it("maps unexpected identity failures to a request-scoped envelope", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    resolveRequestIdentity.mockRejectedValueOnce(new Error("auth unavailable"));
    const result = await requireAdmin(new Request("https://admin.example/api"));
    expect(result.response?.status).toBe(500);
    const body = await result.response!.json();
    expect(body).toMatchObject({ error: { code: "INTERNAL_ERROR", requestId: expect.any(String) } });
    const serialized = String(consoleError.mock.calls[0]?.[0]);
    expect(JSON.parse(serialized)).toMatchObject({ code: "IDENTITY_RESOLUTION_FAILED", status: 500, route: "/api" });
    expect(serialized).not.toContain("auth unavailable");
    consoleError.mockRestore();
  });
});
