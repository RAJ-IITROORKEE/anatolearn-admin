import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

export async function expectNoHighImpactA11yViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const violations = results.violations.filter(
    ({ impact }) => impact === "serious" || impact === "critical",
  );

  expect(
    violations,
    violations
      .map(({ help, id, nodes }) => `${id}: ${help} (${nodes.length} node(s))`)
      .join("\n"),
  ).toEqual([]);
}
