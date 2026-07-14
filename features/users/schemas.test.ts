import { describe, expect, it } from "vitest";

import { adminUserListSchema, updateUserActivitySchema } from "./schemas";

describe("user schemas", () => {
  it("parses filters and caps page size", () => {
    expect(adminUserListSchema.parse({ isActive: "false", sortBy: "email" })).toMatchObject({
      page: 1, pageSize: 20, isActive: false, sortBy: "email", sortOrder: "desc",
    });
    expect(() => adminUserListSchema.parse({ pageSize: "101" })).toThrow();
  });

  it("rejects unknown fields and invalid date ranges", () => {
    expect(() => adminUserListSchema.parse({ role: "ADMIN" })).toThrow();
    expect(() => adminUserListSchema.parse({ createdFrom: "2026-02-02T00:00:00Z", createdTo: "2026-01-01T00:00:00Z" })).toThrow();
    expect(() => updateUserActivitySchema.parse({ isActive: false, role: "USER" })).toThrow();
  });
});
