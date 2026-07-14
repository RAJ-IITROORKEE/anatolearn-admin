import { expect, test } from "@playwright/test";

test("HTML responses include browser security headers", async ({ page }) => {
  const response = await page.goto("/login");

  expect(response).not.toBeNull();
  const headers = response!.headers();
  expect(headers["content-security-policy"]).toContain("default-src 'self'");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["permissions-policy"]).toContain("camera=()");
});

test("auth API responses are private and traceable", async ({ request }) => {
  const response = await request.post("/api/v1/auth/login", { data: {} });

  expect(response.status()).toBe(400);
  expect(response.headers()["cache-control"]).toContain("no-store");
  expect(response.headers()["x-request-id"]).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
});

test("anonymous admin requests redirect to sign in", async ({ request }) => {
  const response = await request.get("/dashboard", { maxRedirects: 0 });

  expect(response.status()).toBe(307);
  expect(response.headers().location).toBe("/login?reason=session-required");
});
