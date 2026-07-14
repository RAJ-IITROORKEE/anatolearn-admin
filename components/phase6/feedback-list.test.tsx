import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FeedbackList } from "./feedback-list";
import { FeedbackTabs } from "./feedback-tabs";

const item = {
  id: crypto.randomUUID(), subject: "Login issue", message: "The app signed me out.", type: "BUG_REPORT", status: "NEW",
  createdAt: new Date("2026-07-14T12:00:00Z"), submitter: { fullName: "Ada Learner", email: "ada@example.com" },
};

describe("feedback admin list", () => {
  it("renders a semantic desktop table and mobile card content", () => {
    render(<FeedbackList items={[item]} />);
    expect(screen.getByRole("table", { name: "Submitted feedback" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Login issue" })).toHaveLength(2);
  });

  it("renders counted status tabs and preserves active filters", () => {
    render(<FeedbackTabs counts={{ all: 7, new: 3, reviewed: 2, resolved: 2 }} values={{ tab: "new", q: "login", type: "BUG_REPORT", createdFrom: "", createdTo: "", sortBy: "createdAt", sortOrder: "desc" }} />);
    const nav = screen.getByRole("navigation", { name: "Feedback status" });
    expect(within(nav).getByRole("link", { name: "New 3" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "Resolved 2" })).toHaveAttribute("href", expect.stringContaining("q=login"));
  });
});
