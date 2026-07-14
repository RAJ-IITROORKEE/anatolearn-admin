import { mkdir } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";

import {
  hasAdminCredentials,
  missingAdminCredentialsReason,
} from "./fixtures/admin";

const storageStatePath = path.join("test-results", ".auth", "admin.json");

test("authenticate an existing administrator", async ({ page }) => {
  test.skip(!hasAdminCredentials, missingAdminCredentialsReason);

  await page.goto("/login");
  await page.getByLabel("Email address").fill(process.env.E2E_ADMIN_EMAIL!);
  await page.getByLabel("Password", { exact: true }).fill(process.env.E2E_ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard(?:\?|$)/, { timeout: 30_000 });

  await mkdir(path.dirname(storageStatePath), { recursive: true });
  await page.context().storageState({ path: storageStatePath });
});
