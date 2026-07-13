import { describe, expect, it } from "vitest";

import { loginSchema, passwordSchema, safeNextPath } from "@/features/auth/schemas";

describe("auth schemas", () => {
  it("normalizes login email and rejects short passwords", () => {
    expect(loginSchema.parse({ email: " Admin@Example.com ", password: "long-password" }).email).toBe(
      "admin@example.com",
    );
    expect(() => loginSchema.parse({ email: "admin@example.com", password: "short" })).toThrow();
  });

  it("requires a strong confirmation-matching password", () => {
    expect(
      passwordSchema.parse({ password: "a-strong-password", confirmPassword: "a-strong-password" }),
    ).toBeTruthy();
    expect(() =>
      passwordSchema.parse({ password: "a-strong-password", confirmPassword: "different-password" }),
    ).toThrow();
  });

  it("allows only local post-auth redirects", () => {
    expect(safeNextPath("/settings/profile")).toBe("/settings/profile");
    expect(safeNextPath("https://evil.example/path")).toBe("/dashboard");
    expect(safeNextPath("//evil.example/path")).toBe("/dashboard");
  });
});
