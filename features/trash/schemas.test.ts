import { describe, expect, it } from "vitest";

import { trashListSchema, trashTypeSchema } from "./schemas";

describe("trash schemas", () => {
  it("parses strict list filters and defaults", () => {
    expect(trashListSchema.parse({})).toEqual({
      page: 1,
      pageSize: 20,
      expiry: "all",
      eligibility: "all",
      sort: "trashedAt-desc",
    });
    expect(trashListSchema.parse({
      page: "2",
      pageSize: "50",
      q: "heart",
      type: "organ-system",
      expiry: "expired",
      eligibility: "blocked",
      sort: "purgeAfter-asc",
    })).toMatchObject({ page: 2, pageSize: 50, q: "heart", type: "organ-system" });
  });

  it("rejects unknown filters and invalid resource types", () => {
    expect(() => trashListSchema.parse({ page: "1", unknown: "value" })).toThrow();
    expect(() => trashTypeSchema.parse("profile")).toThrow();
  });

  it("accepts feedback as a recoverable Trash resource", () => {
    expect(trashTypeSchema.parse("feedback")).toBe("feedback");
  });
});
