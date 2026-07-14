import { describe, expect, it } from "vitest";

import { adminDashboardQuerySchema, parseAdminDashboardQuery } from "./schemas";

describe("admin dashboard query schema", () => {
  it("defaults to 30 days and accepts only supported windows", () => {
    expect(adminDashboardQuerySchema.parse({})).toEqual({ days: 30 });
    expect(adminDashboardQuerySchema.parse({ days: "7" })).toEqual({ days: 7 });
    expect(adminDashboardQuerySchema.parse({ days: "90" })).toEqual({ days: 90 });
  });

  it("rejects unsupported values and unknown query parameters", () => {
    expect(() => adminDashboardQuerySchema.parse({ days: "14" })).toThrow();
    expect(() => adminDashboardQuerySchema.parse({ days: "30", extra: "value" })).toThrow();
    expect(() => parseAdminDashboardQuery(new URLSearchParams("days=7&days=90"))).toThrow();
  });
});
