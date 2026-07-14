import { describe, expect, it } from "vitest";

import { deliveryDto, deviceTokenDto } from "./dto";

describe("notification DTO privacy", () => {
  it("never exposes raw or snapshotted tokens", () => {
    const token = deviceTokenDto({ id: "token-id", platform: "IOS", isActive: true, lastSeenAt: new Date(0), expoPushToken: "ExpoPushToken[secret]" });
    const delivery = deliveryDto({ id: "delivery-id", status: "FAILED", attemptCount: 1, providerErrorCode: "DeviceNotRegistered", createdAt: new Date(0), updatedAt: new Date(0), tokenSnapshot: "ExpoPushToken[secret]" });
    expect(token).not.toHaveProperty("expoPushToken");
    expect(delivery).not.toHaveProperty("tokenSnapshot");
    expect(JSON.stringify([token, delivery])).not.toContain("secret");
  });
});
