import { render, screen, within } from "@testing-library/react";
import { expect, it } from "vitest";

import { CampaignList } from "./campaign-list";

it("provides campaign table caption and header scopes", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  render(<CampaignList campaigns={[{ id, type: "ANNOUNCEMENT", title: "New module", status: "DRAFT", target: { type: "ALL_ACTIVE" }, scheduledAt: null, sentAt: null, createdAt: new Date() }]} evidence={{ [id]: { recipients: 0, deliveries: 0, pending: 0, receiptConfirmed: 0, ticketed: 0, failed: 0, cancelled: 0, read: 0 } }} />);

  const table = screen.getByRole("table", { name: "Notification campaigns" });
  expect(within(table).getAllByRole("columnheader")).toHaveLength(5);
  for (const header of within(table).getAllByRole("columnheader")) expect(header).toHaveAttribute("scope", "col");
  expect(within(table).getByRole("rowheader", { name: /new module/i })).toHaveAttribute("scope", "row");
});
