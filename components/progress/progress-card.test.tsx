import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";

import { ProgressCard } from "./progress-card";

const metric = { numerator: 1, denominator: 2, percentage: 50 };

it("uses sequential headings for progress topics", () => {
  render(<ProgressCard system={{ id: "system", name: "Cardiovascular", content: metric, flashcards: metric, quiz: metric, test: metric, topics: [{ id: "topic", title: "Heart", content: metric, flashcards: metric, quiz: metric, test: metric }] }} />);
  expect(screen.getByRole("heading", { level: 3, name: "Topics" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { level: 4, name: "Heart" })).toBeInTheDocument();
});
