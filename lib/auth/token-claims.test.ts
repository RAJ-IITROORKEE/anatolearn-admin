import { describe, expect, it } from "vitest";

import { hasRecoveryMethod } from "./token-claims";

function token(payload: object) {
  return `header.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.signature`;
}

describe("hasRecoveryMethod", () => {
  it("accepts recovery authentication claims", () => {
    expect(hasRecoveryMethod(token({ amr: [{ method: "recovery", timestamp: 1 }] }))).toBe(true);
  });

  it("rejects normal and malformed access tokens", () => {
    expect(hasRecoveryMethod(token({ amr: [{ method: "password" }] }))).toBe(false);
    expect(hasRecoveryMethod("not-a-token")).toBe(false);
  });
});
