import { describe, expect, it } from "vitest";

import { changePasswordSchema, deviceTokenSchema, profileUpdateSchema } from "./api-schemas";

describe("authentication API schemas", () => {
  it("rejects an unchanged password", () => {
    expect(changePasswordSchema.safeParse({ currentPassword: "same-password", newPassword: "same-password" }).success).toBe(false);
  });

  it("accepts only supported Expo device tokens", () => {
    expect(deviceTokenSchema.safeParse({ expoPushToken: "ExponentPushToken[device_123]", platform: "IOS" }).success).toBe(true);
    expect(deviceTokenSchema.safeParse({ expoPushToken: "not-a-token", platform: "IOS" }).success).toBe(false);
  });

  it("does not allow account fields in profile updates", () => {
    expect(profileUpdateSchema.safeParse({ fullName: "Alex Admin", role: "ADMIN" }).success).toBe(false);
  });
});
