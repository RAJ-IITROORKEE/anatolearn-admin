import { describe, expect, it } from "vitest";

import { canAccessAdmin } from "@/lib/auth/permissions";

describe("canAccessAdmin", () => {
  it("allows only active administrators", () => {
    expect(canAccessAdmin({ role: "ADMIN", isActive: true })).toBe(true);
    expect(canAccessAdmin({ role: "USER", isActive: true })).toBe(false);
    expect(canAccessAdmin({ role: "ADMIN", isActive: false })).toBe(false);
    expect(canAccessAdmin(null)).toBe(false);
  });
});
