import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";

import { MiniPagination } from "./campaign-detail";

it("does not expose disabled notification pagination as a link", () => {
  render(<MiniPagination campaignId="campaign" current={1} kind="recipientPage" pages={2} />);
  expect(screen.queryByRole("link", { name: "Previous" })).not.toBeInTheDocument();
  expect(screen.getByText("Previous")).toHaveAttribute("aria-disabled", "true");
  expect(screen.getByRole("link", { name: "Next" })).toHaveAttribute("href", "/notifications/campaign?recipientPage=2");
});
