import { describe, expect, it } from "vitest";

import { GET as health } from "./health/route";
import { GET as meta } from "./v1/meta/route";

describe("explicit public API cache policies", () => {
  it("allows only health and metadata responses to opt into public caching", () => {
    for (const response of [health(), meta()]) {
      expect(response.headers.get("cache-control")).toMatch(/^public, max-age=/);
      expect(response.headers.has("vary")).toBe(false);
      expect(response.headers.get("x-request-id")).toBeTruthy();
    }
  });
});
