import { describe, expect, it } from "vitest";

import { parseFeedbackFilters, parseUserFilters } from "./filters";

describe("Phase 6 list filters", () => {
  it("parses user URL filters and expands inclusive date bounds", () => {
    const parsed = parseUserFilters({
      q: " Ada ", isActive: "true", createdFrom: "2026-07-01", createdTo: "2026-07-14",
      sortBy: "fullName", sortOrder: "asc", page: "2",
    });

    expect(parsed.input).toMatchObject({ q: "Ada", isActive: true, page: 2, sortBy: "fullName", sortOrder: "asc" });
    expect(parsed.input.createdFrom?.toISOString()).toBe("2026-07-01T00:00:00.000Z");
    expect(parsed.input.createdTo?.toISOString()).toBe("2026-07-14T23:59:59.999Z");
    expect(parsed.hasFilters).toBe(true);
  });

  it("falls back safely when user URL values are invalid", () => {
    const parsed = parseUserFilters({ page: "nope", isActive: "maybe" });
    expect(parsed.input).toMatchObject({ page: 1, pageSize: 20, sortBy: "createdAt", sortOrder: "desc" });
    expect(parsed.hasFilters).toBe(false);
  });

  it("maps feedback tabs and filters to the service schema", () => {
    const parsed = parseFeedbackFilters({
      tab: "reviewed", q: " login ", type: "BUG_REPORT", createdFrom: "2026-07-01",
      sortBy: "type", sortOrder: "asc", page: "3",
    });
    expect(parsed.input).toMatchObject({ status: "REVIEWED", q: "login", type: "BUG_REPORT", page: 3, sortBy: "type", sortOrder: "asc" });
    expect(parsed.values.tab).toBe("reviewed");
    expect(parsed.hasFilters).toBe(true);
  });

  it("treats the all feedback tab as no status filter", () => {
    const parsed = parseFeedbackFilters({ tab: "all" });
    expect(parsed.input.status).toBeUndefined();
    expect(parsed.hasFilters).toBe(false);
  });
});
