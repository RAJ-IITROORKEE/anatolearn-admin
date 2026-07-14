import { expect, test } from "@playwright/test";

test("protected admin routes redirect anonymous users", async ({ page }) => {
  await page.goto("/dashboard");

  await expect(page).toHaveURL(/\/login\?reason=session-required/);
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
});

test("login remains usable on narrow screens", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile"), "Mobile auth check");
  await page.goto("/login");

  await expect(page.getByLabel("Email address")).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
});
