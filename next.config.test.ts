import { describe, expect, it } from "vitest";

import nextConfig, { createSecurityHeaders } from "./next.config";

describe("static security headers", () => {
  it("sets non-CSP browser hardening headers for every route", async () => {
    const entries = await nextConfig.headers!();
    const all = entries.find((entry) => entry.source === "/(.*)");
    const headers = Object.fromEntries(all!.headers.map(({ key, value }) => [key.toLowerCase(), value]));

    expect(headers).not.toHaveProperty("content-security-policy");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["permissions-policy"]).toContain("camera=()");
    const production = Object.fromEntries(createSecurityHeaders("production").map(({ key, value }) => [key.toLowerCase(), value]));
    expect(production["strict-transport-security"]).toContain("max-age=31536000");
  });

  it("allows server-action image forms up to the media upload limit", () => {
    expect(nextConfig.experimental?.serverActions?.bodySizeLimit).toBe("8mb");
  });
});
