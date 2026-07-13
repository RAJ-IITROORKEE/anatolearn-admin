import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AssessmentTypeBadge, AttemptStatusBadge } from "./badges";

describe("assessment badges", () => {
  it("identifies quiz and test modes with readable text", () => {
    const { rerender } = render(<AssessmentTypeBadge type="QUIZ" />);
    expect(screen.getByText("Quiz")).toBeVisible();

    rerender(<AssessmentTypeBadge type="TEST" />);
    expect(screen.getByText("Test")).toBeVisible();
  });

  it("renders every attempt state as human-readable text", () => {
    const { rerender } = render(<AttemptStatusBadge status="IN_PROGRESS" />);
    expect(screen.getByText("In progress")).toBeVisible();

    rerender(<AttemptStatusBadge status="AUTO_SUBMITTED" />);
    expect(screen.getByText("Auto-submitted")).toBeVisible();

    rerender(<AttemptStatusBadge status="COMPLETED" />);
    expect(screen.getByText("Completed")).toBeVisible();
  });
});
