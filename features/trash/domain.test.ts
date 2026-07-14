import { describe, expect, it } from "vitest";

import {
  blockerSummary,
  retentionState,
  trashEligibility,
} from "./domain";

describe("trash domain", () => {
  const deadline = new Date("2026-08-13T12:00:00.000Z");

  it("allows restore only strictly before the exact deadline", () => {
    expect(retentionState(new Date(deadline.getTime() - 1), deadline)).toBe("RESTORABLE");
    expect(retentionState(deadline, deadline)).toBe("EXPIRED");
    expect(retentionState(new Date(deadline.getTime() + 1), deadline)).toBe("EXPIRED");
  });

  it("does not make an item purge eligible before its deadline", () => {
    expect(trashEligibility(new Date(deadline.getTime() - 1), deadline, 0)).toBe("PENDING");
    expect(trashEligibility(deadline, deadline, 0)).toBe("ELIGIBLE");
    expect(trashEligibility(deadline, deadline, 2)).toBe("BLOCKED");
  });

  it("bounds safe blocker details", () => {
    expect(blockerSummary("Referenced by learner progress and historical attempts", 12)).toEqual({
      reason: "Referenced by learner progress and historical attempts",
      count: 12,
    });
    expect(blockerSummary("x".repeat(400), 100_000)).toEqual({
      reason: "x".repeat(157) + "...",
      count: 9_999,
    });
  });
});
