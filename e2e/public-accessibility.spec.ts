import { expect, test } from "@playwright/test";

import { expectNoHighImpactA11yViolations } from "./accessibility";

const publicPages = [
  { path: "/login", heading: "Welcome back" },
  { path: "/forgot-password", heading: "Reset your password" },
  { path: "/reset-password", heading: "Choose a new password" },
  { path: "/privacy", heading: "Privacy Policy" },
  { path: "/terms", heading: "Terms of Use" },
] as const;

for (const { path, heading } of publicPages) {
  test(`${path} has no serious or critical accessibility violations`, async ({ page }) => {
    await page.goto(path);

    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    await expectNoHighImpactA11yViolations(page);
  });
}

test("anonymous protected navigation lands on an accessible login page", async ({ page }) => {
  await page.goto("/users");

  await expect(page).toHaveURL(/\/login\?reason=session-required/);
  await expect(page.getByRole("heading", { level: 1, name: "Welcome back" })).toBeVisible();
  await expectNoHighImpactA11yViolations(page);
});
