import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import { FeedbackList } from "./feedback-list";
import { FeedbackTabs } from "./feedback-tabs";

const item = {
  id: crypto.randomUUID(), subject: "Login issue", message: "The app signed me out.", type: "BUG_REPORT", status: "NEW",
  createdAt: new Date("2026-07-14T12:00:00Z"), submitter: { fullName: "Ada Learner", email: "ada@example.com" },
};

describe("feedback admin list", () => {
  it("renders a semantic desktop table and mobile card content", () => {
    render(<FeedbackList bulkTrashAction={vi.fn()} items={[item]} trashAction={vi.fn()} />);
    expect(screen.getByRole("table", { name: "Submitted feedback" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Login issue" })).toHaveLength(2);
  });

  it("synchronizes responsive row selection and confirms row and bulk Delete", async () => {
    const user = userEvent.setup();
    const bulkTrashAction = vi.fn().mockResolvedValue({ success: "Moved" });
    const trashAction = vi.fn().mockResolvedValue({ success: "Moved" });
    render(<FeedbackList bulkTrashAction={bulkTrashAction} items={[item]} trashAction={trashAction} />);

    const selections = screen.getAllByRole("checkbox", { name: "Select Login issue" });
    await user.click(selections[0]);
    expect(selections[1]).toBeChecked();
    expect(screen.getByRole("toolbar", { name: "Bulk actions" })).toHaveTextContent("1 feedback item selected");

    await user.click(screen.getByRole("button", { name: "Clear selection" }));
    expect(selections[0]).not.toBeChecked();
    await user.click(screen.getAllByRole("button", { name: "Delete Login issue" })[0]);
    expect(screen.getByRole("alertdialog", { name: "Move feedback to Trash?" })).toHaveTextContent("restored from Settings > Trash for 30 days");
    await user.click(screen.getByRole("button", { name: "Move to Trash" }));
    await waitFor(() => expect(trashAction).toHaveBeenCalled());

    await user.click(selections[0]);
    await user.click(screen.getByRole("button", { name: "Delete selected" }));
    await user.click(screen.getByRole("button", { name: "Move 1 feedback item to Trash" }));
    await waitFor(() => expect(bulkTrashAction).toHaveBeenCalled());
  });

  it("renders counted status tabs and preserves active filters", () => {
    render(<FeedbackTabs counts={{ all: 7, new: 3, reviewed: 2, resolved: 2 }} values={{ tab: "new", q: "login", type: "BUG_REPORT", createdFrom: "", createdTo: "", sortBy: "createdAt", sortOrder: "desc" }} />);
    const nav = screen.getByRole("navigation", { name: "Feedback status" });
    expect(within(nav).getByRole("link", { name: "New 3" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "Resolved 2" })).toHaveAttribute("href", expect.stringContaining("q=login"));
  });
});
