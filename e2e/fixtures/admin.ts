import { test as base, expect } from "@playwright/test";

export const missingAdminCredentialsReason =
  "Authenticated E2E skipped: set both E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD.";

export const hasAdminCredentials = Boolean(
  process.env.E2E_ADMIN_EMAIL && process.env.E2E_ADMIN_PASSWORD,
);

export const test = base.extend<{ adminCredentials: void }>({
  adminCredentials: [
    async ({}, use) => {
      base.skip(!hasAdminCredentials, missingAdminCredentialsReason);
      await use();
    },
    { auto: true },
  ],
});

export { expect };
