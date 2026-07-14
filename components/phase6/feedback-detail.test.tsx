import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

vi.mock("@/app/(admin)/phase6-actions", () => ({ changeFeedbackStatusAction: vi.fn(), updateFeedbackNotesAction: vi.fn() }));

import { FeedbackDetail } from "./feedback-detail";

const base = {
  id: crypto.randomUUID(), type: "GENERAL", subject: "Study request", message: "Please add a detailed anatomy lesson.\nThank you.", status: "NEW", adminNotes: null,
  createdAt: new Date("2026-07-01Z"), updatedAt: new Date("2026-07-02Z"), reviewedAt: null, resolvedAt: null, submitter: null, reviewer: null, resolver: null,
};

it("shows the full message, private notes editor, and only the next feedback transition", () => {
  render(<FeedbackDetail feedback={base} />);
  expect(screen.getByText(/Please add a detailed anatomy lesson/)).toHaveClass("whitespace-pre-wrap");
  expect(screen.getByRole("textbox", { name: "Notes" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Mark reviewed" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /resolve feedback/i })).not.toBeInTheDocument();
});
