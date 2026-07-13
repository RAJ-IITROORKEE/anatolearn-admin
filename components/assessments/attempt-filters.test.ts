import { describe, expect, it } from "vitest";

import { parseAttemptFilters } from "./attempt-filters";

const systemId = "3e8e61fc-e9ad-48b0-b1ca-90e120caa9bc";

describe("parseAttemptFilters", () => {
  it("strictly parses URL filters and expands date bounds", () => {
    const parsed = parseAttemptFilters({
      q: "  learner@example.com  ", assessmentType: "TEST", organSystemId: systemId,
      status: "AUTO_SUBMITTED", from: "2026-07-01", to: "2026-07-13",
      sortBy: "scorePercentage", sortOrder: "asc", page: "3",
    });

    expect(parsed.input).toMatchObject({
      q: "learner@example.com", assessmentType: "TEST", organSystemId: systemId,
      status: "AUTO_SUBMITTED", sortBy: "scorePercentage", sortOrder: "asc", page: 3,
    });
    expect(parsed.input.from?.toISOString()).toBe("2026-07-01T00:00:00.000Z");
    expect(parsed.input.to?.toISOString()).toBe("2026-07-13T23:59:59.999Z");
    expect(parsed.values).toMatchObject({ from: "2026-07-01", to: "2026-07-13" });
    expect(parsed.hasFilters).toBe(true);
  });

  it("falls back to newest-started defaults when any URL value is invalid", () => {
    const parsed = parseAttemptFilters({ assessmentType: "PRACTICE", sortOrder: "sideways", page: "0" });

    expect(parsed.input).toMatchObject({ page: 1, pageSize: 20, sortBy: "startedAt", sortOrder: "desc" });
    expect(parsed.input.assessmentType).toBeUndefined();
    expect(parsed.hasFilters).toBe(false);
  });

  it("rejects array values instead of selecting an ambiguous value", () => {
    const parsed = parseAttemptFilters({ status: ["COMPLETED", "ABANDONED"] });

    expect(parsed.input.status).toBeUndefined();
    expect(parsed.hasFilters).toBe(false);
  });
});
