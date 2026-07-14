import { describe, expect, it } from "vitest";

import {
  campaignCreateSchema,
  campaignScheduleSchema,
  deviceTokenSchema,
} from "./schemas";

const userId = "00000000-0000-4000-8000-000000000001";

describe("notification schemas", () => {
  it.each(["ExponentPushToken[abc_123-XYZ]", "ExpoPushToken[abc_123-XYZ]"])(
    "accepts the Expo token format %s",
    (expoPushToken) => {
      expect(deviceTokenSchema.parse({ expoPushToken, platform: "IOS" })).toEqual({
        expoPushToken,
        platform: "IOS",
      });
    },
  );

  it("requires a strict unique selected audience of at most 500 learners", () => {
    const base = { type: "ANNOUNCEMENT", title: "Title", message: "Message" };
    expect(
      campaignCreateSchema.parse({ ...base, target: { type: "SELECTED_USERS", userIds: [userId] } }),
    ).toBeTruthy();
    expect(() =>
      campaignCreateSchema.parse({
        ...base,
        target: { type: "SELECTED_USERS", userIds: [userId, userId] },
      }),
    ).toThrow();
    expect(() =>
      campaignCreateSchema.parse({ ...base, target: { type: "ALL_ACTIVE_USERS", userIds: [userId] } }),
    ).toThrow();
  });

  it("requires scheduling at least 60 seconds after supplied database time", () => {
    const databaseNow = new Date("2026-07-14T12:00:00.000Z");
    expect(() =>
      campaignScheduleSchema.parse({ scheduledAt: "2026-07-14T12:00:59.999Z" }).scheduledAt,
    ).not.toThrow();
    const scheduledAt = campaignScheduleSchema.parse({
      scheduledAt: "2026-07-14T12:01:00.000Z",
    }).scheduledAt;
    expect(scheduledAt.getTime() - databaseNow.getTime()).toBe(60_000);
  });
});
