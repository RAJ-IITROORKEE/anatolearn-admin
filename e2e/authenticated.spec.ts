import { expectNoHighImpactA11yViolations } from "./accessibility";
import { expect, test } from "./fixtures/admin";

const adminPages = [
  { path: "/dashboard", heading: "Dashboard" },
  { path: "/users", heading: "Users" },
  { path: "/content", heading: "Content review" },
  { path: "/questions/quiz", heading: "Quiz questions" },
  { path: "/notifications", heading: "Notifications" },
] as const;

for (const { path, heading } of adminPages) {
  test(`${path} has an accessible responsive page structure`, async ({ page }) => {
    await page.goto(path);

    await expect(page).toHaveURL(new RegExp(`${path.replaceAll("/", "\\/")}(?:\\?|$)`));
    await expect(page.locator("main#main-content")).toHaveCount(1);
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    await expect(page.getByRole("link", { name: "Skip to main content" })).toHaveAttribute(
      "href",
      "#main-content",
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);
    await expectNoHighImpactA11yViolations(page);
  });
}

test("skip link moves keyboard focus to the main landmark", async ({ page }) => {
  await page.goto("/dashboard");

  await page.keyboard.press("Tab");
  const skipLink = page.getByRole("link", { name: "Skip to main content" });
  await expect(skipLink).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("main#main-content")).toBeFocused();
});
