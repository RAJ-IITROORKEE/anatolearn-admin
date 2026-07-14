import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/notifications/new" }));

import { CampaignEditor } from "./campaign-editor";

const learners = [
  { id: crypto.randomUUID(), fullName: "Avery Learner", email: "avery@example.com" },
];
const learnerResult = { items: learners, pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 } };

it("uses strict audience controls, counters, preview, and disables send when the provider is unavailable", () => {
  render(<CampaignEditor action={vi.fn()} learners={learnerResult} providerReady={false} searchAction={vi.fn()} />);

  expect(screen.getByText("0 / 100")).toBeInTheDocument();
  expect(screen.getByText("0 / 1000")).toBeInTheDocument();
  expect(screen.queryByLabelText(/json/i)).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Send now" })).toBeDisabled();
  expect(screen.getByText(/delivery provider is not ready/i)).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Study reminder" } });
  fireEvent.change(screen.getByLabelText("Message"), { target: { value: "Review the cardiovascular module." } });
  expect(screen.getByRole("heading", { name: "Study reminder" })).toBeInTheDocument();
  expect(screen.getByLabelText("Notification preview")).toHaveTextContent("Review the cardiovascular module.");

  fireEvent.click(screen.getByLabelText("Selected active learners"));
  expect(screen.getByLabelText(/Avery Learner/)).toBeInTheDocument();
});
