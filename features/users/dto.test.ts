import { describe, expect, it } from "vitest";

import { adminUserDetailDto, adminUserListItemDto } from "./dto";

const profile = {
  id: crypto.randomUUID(), fullName: "Learner", email: "learner@example.com",
  emailNormalized: "hidden@example.com", role: "USER" as const, avatarUrl: null,
  avatarMediaId: null, isActive: true, lastLoginAt: null, createdAt: new Date("2026-01-01Z"),
  updatedAt: new Date("2026-01-02Z"), deviceTokens: [{ expoPushToken: "secret" }],
};

describe("user DTOs", () => {
  it("allowlists safe profile fields", () => {
    const dto = adminUserListItemDto(profile);
    expect(dto).not.toHaveProperty("emailNormalized");
    expect(dto).not.toHaveProperty("deviceTokens");
    expect(dto).not.toHaveProperty("role");
  });

  it("adds only the explicit activity summary", () => {
    const dto = adminUserDetailDto(profile, { attempts: 3, submittedAttempts: 2, feedback: 1, lastAttemptAt: null });
    expect(dto.activity).toEqual({ attempts: 3, submittedAttempts: 2, feedback: 1, lastAttemptAt: null });
  });
});
