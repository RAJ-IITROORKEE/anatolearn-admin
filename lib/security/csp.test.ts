import { describe, expect, it } from "vitest";

import { createContentSecurityPolicy } from "./csp";

describe("nonce content security policy", () => {
  it("uses a strict nonce policy in production", () => {
    const policy = createContentSecurityPolicy("nonce-value", "production");
    const scriptDirective = policy.split("; ").find((directive) => directive.startsWith("script-src"));
    expect(scriptDirective).toBe("script-src 'self' 'nonce-nonce-value' 'strict-dynamic'");
    expect(policy).toContain("style-src 'self' 'unsafe-inline'");
    expect(policy).toContain("https://*.supabase.co");
    expect(scriptDirective).not.toContain("'unsafe-inline'");
    expect(policy).not.toContain("'unsafe-eval'");
    expect(policy).not.toContain("wasm-unsafe-eval");
  });

  it("allows unsafe eval only for the Next development runtime", () => {
    expect(createContentSecurityPolicy("nonce", "development")).toContain("'unsafe-eval'");
    expect(createContentSecurityPolicy("nonce", "test")).not.toContain("'unsafe-eval'");
  });
});
