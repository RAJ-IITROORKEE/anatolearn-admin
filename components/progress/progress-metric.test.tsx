import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ProgressMetric } from "./progress-metric";

describe("ProgressMetric", () => {
  it("presents absent samples as no data rather than poor performance", () => {
    render(<ProgressMetric label="Quiz accuracy" metric={{ numerator: 0, denominator: 0, percentage: 0 }} />);

    expect(screen.getByText("No data")).toBeVisible();
    expect(screen.queryByText("0%", { exact: true })).not.toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("shows weighted counts and an accessible percentage when samples exist", () => {
    render(<ProgressMetric label="Quiz accuracy" metric={{ numerator: 8, denominator: 10, percentage: 80 }} />);

    expect(screen.getByText("80%")).toBeVisible();
    expect(screen.getByText("8 of 10")).toBeVisible();
    expect(screen.getByRole("progressbar", { name: "Quiz accuracy: 80%" })).toBeVisible();
  });
});
