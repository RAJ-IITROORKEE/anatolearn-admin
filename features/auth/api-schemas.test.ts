import { describe, expect, it } from "vitest";

import { changePasswordSchema, deviceTokenSchema, emailSchema, loginSchema, profileUpdateSchema, registerSchema, verifySignupOtpSchema } from "./api-schemas";

describe("authentication API schemas", () => {
  it("keeps strength rules for new passwords but accepts a short existing password", () => {
    expect(registerSchema.safeParse({ email: "user@example.com", password: "short", fullName: "User" }).success).toBe(false);
    expect(changePasswordSchema.safeParse({ currentPassword: "short", newPassword: "new-secure-password" }).success).toBe(true);
  });

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

  it("accepts only a normalized email and six-digit signup OTP", () => {
    expect(verifySignupOtpSchema.parse({ email: " User@Example.COM ", otp: "123456" })).toEqual({
      email: "user@example.com",
      otp: "123456",
    });
    expect(verifySignupOtpSchema.safeParse({ email: "user@example.com", otp: "12345" }).success).toBe(false);
    expect(verifySignupOtpSchema.safeParse({ email: "user@example.com", otp: "abcdef" }).success).toBe(false);
    expect(verifySignupOtpSchema.safeParse({ email: "user@example.com", otp: "123456", role: "ADMIN" }).success).toBe(false);
  });

  it.each([
    [loginSchema, { email: "user@example.com", password: "valid-password", role: "ADMIN" }],
    [registerSchema, { email: "user@example.com", password: "valid-password", fullName: "User", role: "ADMIN" }],
    [emailSchema, { email: "user@example.com", redirectTo: "https://evil.example" }],
  ])("rejects unknown authentication input fields", (schema, value) => {
    expect(schema.safeParse(value).success).toBe(false);
  });
});
