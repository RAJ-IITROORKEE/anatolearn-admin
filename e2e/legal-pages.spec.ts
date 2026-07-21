import { expect, test } from "@playwright/test";

test("privacy policy is public and describes AnatoLearn data practices", async ({ page }) => {
  await page.goto("/privacy");

  await expect(page).toHaveURL(/\/privacy$/);
  await expect(page.getByRole("heading", { level: 1, name: "Privacy Policy" })).toBeVisible();
  await expect(page.getByText("Effective date: July 22, 2026")).toBeVisible();

  await expect(page.getByRole("heading", { name: "Information we collect" })).toBeVisible();
  await expect(page.getByText(/account, profile, and avatar/i)).toBeVisible();
  await expect(page.getByText(/learning progress/i)).toBeVisible();
  await expect(page.getByText(/assessments, answers, and scores/i)).toBeVisible();
  await expect(page.getByText(/feedback/i).first()).toBeVisible();
  await expect(page.getByText(/notification and device data/i)).toBeVisible();
  await expect(page.getByText(/security, audit, and technical data/i)).toBeVisible();

  await expect(page.getByText(/Supabase Auth/i)).toBeVisible();
  await expect(page.getByText(/private storage/i).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Service providers and sharing" })).toBeVisible();
  await expect(page.getByText(/do not sell your personal information/i)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Retention and deletion" })).toBeVisible();
  await expect(page.getByText(/not a substitute for professional medical education or advice/i)).toBeVisible();

  await expect(page.getByRole("link", { name: "rajrabidas001@gmail.com" })).toHaveAttribute(
    "href",
    "mailto:rajrabidas001@gmail.com",
  );
  await expect(page.getByRole("link", { name: "Terms of Use" })).toHaveAttribute("href", "/terms");
  await expect(page.getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/login");
});

test("terms are public and state the conditions for using AnatoLearn", async ({ page }) => {
  await page.goto("/terms");

  await expect(page).toHaveURL(/\/terms$/);
  await expect(page.getByRole("heading", { level: 1, name: "Terms of Use" })).toBeVisible();
  await expect(page.getByText("Effective date: July 22, 2026")).toBeVisible();

  await expect(page.getByRole("heading", { name: "Educational service only" })).toBeVisible();
  await expect(page.getByText(/not a substitute for professional medical education or advice/i)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Acceptable use" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Account security" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Content and intellectual property" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Availability and changes to the service" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Suspension and termination" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Disclaimers" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Limitation of liability" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Changes to these terms" })).toBeVisible();

  await expect(page.getByRole("link", { name: "rajrabidas001@gmail.com" })).toHaveAttribute(
    "href",
    "mailto:rajrabidas001@gmail.com",
  );
  await expect(page.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute("href", "/privacy");
  await expect(page.getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/login");
});
