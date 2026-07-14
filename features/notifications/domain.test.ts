import { describe, expect, it } from "vitest";

import { campaignAuditSnapshot, finalCampaignStatus } from "./domain";

describe("notification lifecycle", () => {
  it("requires receipt-confirmed delivery for a fully sent campaign", () => {
    expect(finalCampaignStatus([{ statuses: ["SENT"] }])).toBe("SENT");
    expect(finalCampaignStatus([{ statuses: ["TICKETED"] }])).toBe("FAILED");
    expect(finalCampaignStatus([{ statuses: ["SENT"] }, { statuses: ["FAILED"] }])).toBe("PARTIAL");
    expect(finalCampaignStatus([])).toBe("FAILED");
    expect(finalCampaignStatus([{ statuses: [] }])).toBe("FAILED");
  });

  it("redacts campaign content, user IDs, and tokens from audit snapshots", () => {
    const snapshot = campaignAuditSnapshot({
      status: "SCHEDULED",
      type: "ANNOUNCEMENT",
      title: "secret title",
      message: "secret body",
      targetFilter: { type: "SELECTED_USERS", userIds: ["secret-user"] },
      recipientCount: 3,
    });
    expect(snapshot).toEqual({
      status: "SCHEDULED",
      type: "ANNOUNCEMENT",
      audienceType: "SELECTED_USERS",
      recipientCount: 3,
    });
    expect(JSON.stringify(snapshot)).not.toContain("secret");
  });
});
