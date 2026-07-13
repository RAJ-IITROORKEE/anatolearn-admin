import { describe, expect, it } from "vitest";

import { hasSafeOrigin } from "@/lib/security/origin";

describe("hasSafeOrigin", () => {
  it("accepts same-origin mutation requests", () => {
    expect(hasSafeOrigin(new Headers({ host: "localhost:3000", origin: "http://localhost:3000" }))).toBe(true);
  });

  it("rejects cross-origin and missing-origin mutation requests", () => {
    expect(hasSafeOrigin(new Headers({ host: "localhost:3000", origin: "https://evil.example" }))).toBe(false);
    expect(hasSafeOrigin(new Headers({ host: "localhost:3000" }))).toBe(false);
  });
});
