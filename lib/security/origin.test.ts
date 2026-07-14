import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { hasSafeOrigin } from "@/lib/security/origin";

describe("hasSafeOrigin", () => {
  const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;

  beforeEach(() => { process.env.NEXT_PUBLIC_APP_URL = "https://admin.example:8443"; });
  afterEach(() => { process.env.NEXT_PUBLIC_APP_URL = originalAppUrl; });

  it("accepts same-origin mutation requests", () => {
    expect(hasSafeOrigin(new Headers({ origin: "https://admin.example:8443" }))).toBe(true);
  });

  it.each([
    "http://admin.example:8443",
    "https://evil.example:8443",
    "https://admin.example",
  ])("rejects scheme, host, and port mismatches: %s", (origin) => {
    expect(hasSafeOrigin(new Headers({ origin }))).toBe(false);
  });

  it("ignores spoofable request host headers", () => {
    expect(hasSafeOrigin(new Headers({
      origin: "https://evil.example",
      host: "evil.example",
      "x-forwarded-host": "evil.example",
    }))).toBe(false);
    expect(hasSafeOrigin(new Headers())).toBe(false);
  });
});
