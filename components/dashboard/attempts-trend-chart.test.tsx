import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AttemptsTrendChart } from "./attempts-trend-chart";

const trend = Array.from({ length: 90 }, (_, index) => ({
  date: new Date(Date.UTC(2026, 0, index + 1)).toISOString().slice(0, 10),
  quizAttempts: index + 1,
  testAttempts: 0,
}));

function rect(left: number, width: number) {
  return { bottom: 300, height: 260, left, right: left + width, top: 40, width, x: left, y: 40, toJSON: () => ({}) };
}

describe("AttemptsTrendChart pointer inspection", () => {
  it.each([
    ["first", 0],
    ["middle", 45],
    ["final", 89],
  ] as const)("selects the %s day from the SVG plot bounds in a 90-day range", (_position, index) => {
    const { container } = render(<AttemptsTrendChart data={trend} days={90} />);
    const inspector = screen.getByRole("slider", { name: "Inspect daily attempt values" });
    const svg = container.querySelector("svg");
    if (!svg) throw new Error("Chart SVG was not rendered.");
    vi.spyOn(inspector, "getBoundingClientRect").mockReturnValue(rect(100, 1000) as DOMRect);
    vi.spyOn(svg, "getBoundingClientRect").mockReturnValue(rect(120, 800) as DOMRect);

    const plotX = 38 + (index / 89) * 746;
    fireEvent(inspector, new MouseEvent("pointermove", { bubbles: true, clientX: 120 + plotX }));

    expect(inspector).toHaveAttribute("aria-valuenow", String(index));
    expect(inspector).toHaveAttribute("aria-valuetext", expect.stringContaining(`${index + 1} quiz`));
  });
});
