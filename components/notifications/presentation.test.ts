import { describe, expect, it } from "vitest";

import { deliveryEvidence, summarizeEvidence } from "./presentation";

describe("notification evidence presentation", () => {
  it("keeps provider tickets distinct from receipt-confirmed deliveries", () => {
    expect(deliveryEvidence("TICKETED")).toBe("Accepted by provider; receipt pending");
    expect(deliveryEvidence("SENT")).toBe("Delivery receipt confirmed by provider");
  });

  it("summarizes recipients, receipts, failures, and reads without implying display", () => {
    expect(summarizeEvidence(
      [{ readAt: new Date(), _count: { deliveries: 2 } }, { readAt: null, _count: { deliveries: 1 } }],
      [{ status: "SENT" }, { status: "TICKETED" }, { status: "FAILED" }],
    )).toEqual({ recipients: 2, deliveries: 3, receiptConfirmed: 1, ticketed: 1, failed: 1, read: 1 });
  });
});
