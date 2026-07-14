import { defineConfig, devices } from "@playwright/test";

const adminStorageState = "test-results/.auth/admin.json";
const hasAdminCredentials = Boolean(
  process.env.E2E_ADMIN_EMAIL && process.env.E2E_ADMIN_PASSWORD,
);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      testIgnore: [/auth\.setup\.ts/, /authenticated\.spec\.ts/],
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chromium",
      testIgnore: [/auth\.setup\.ts/, /authenticated\.spec\.ts/],
      use: {
        ...devices["Desktop Chrome"],
        hasTouch: true,
        isMobile: true,
        viewport: { width: 390, height: 844 },
      },
    },
    {
      name: "admin-auth-setup",
      testMatch: /auth\.setup\.ts/,
      use: { trace: "off" },
    },
    {
      name: "admin-chromium",
      dependencies: hasAdminCredentials ? ["admin-auth-setup"] : [],
      testMatch: /authenticated\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        storageState: hasAdminCredentials ? adminStorageState : undefined,
      },
    },
    {
      name: "admin-mobile-chromium",
      dependencies: hasAdminCredentials ? ["admin-auth-setup"] : [],
      testMatch: /authenticated\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        hasTouch: true,
        isMobile: true,
        storageState: hasAdminCredentials ? adminStorageState : undefined,
        viewport: { width: 390, height: 844 },
      },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
  },
});
