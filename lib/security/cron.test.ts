import { describe, expect, it } from "vitest";

import { hasValidCronAuthorization } from "./cron";

describe("cron authorization", () => {
  it("accepts only an exact bearer secret", () => {
    const secret = "a-secure-cron-secret-with-at-least-32-characters";
    expect(hasValidCronAuthorization(`Bearer ${secret}`, secret)).toBe(true);
    expect(hasValidCronAuthorization(`Bearer ${secret}x`, secret)).toBe(false);
    expect(hasValidCronAuthorization(null, secret)).toBe(false);
  });
});
