import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import { LearnerPicker } from "./learner-picker";

it("searches beyond the initial page and preserves selected learner labels and IDs", async () => {
  const initial = { items: [{ id: "00000000-0000-4000-8000-000000000001", fullName: "Initial Learner", email: "initial@example.com" }], pagination: { page: 1, pageSize: 20, total: 40, totalPages: 2 } };
  const searched = { items: [{ id: "00000000-0000-4000-8000-000000000099", fullName: "Remote Learner", email: "remote@example.com" }], pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 } };
  const search = vi.fn().mockResolvedValue(searched);
  render(<LearnerPicker initial={initial} initialSelected={[]} searchAction={search} />);

  fireEvent.change(screen.getByLabelText("Search active learners"), { target: { value: "remote" } });
  fireEvent.click(screen.getByRole("button", { name: "Search" }));
  await screen.findByText("Remote Learner");
  fireEvent.click(screen.getByLabelText(/Remote Learner/));
  expect(screen.getByText("1 learner selected")).toBeInTheDocument();
  expect(document.querySelector('input[name="userIds"][value="00000000-0000-4000-8000-000000000099"]')).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText("Search active learners"), { target: { value: "other" } });
  fireEvent.click(screen.getByRole("button", { name: "Search" }));
  await waitFor(() => expect(search).toHaveBeenLastCalledWith("other", 1));
  expect(screen.getByLabelText("Selected learners")).toHaveTextContent("Remote Learner");
});
